/**
 * Tests for localStorage utilities (utils/storage.js).
 */

import {
  generateId,
  loadConfigs,
  saveConfigs,
  upsertConfig,
  deleteConfig,
  appendRunHistory,
  createDefaultConfig,
} from "./storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides = {}) {
  return {
    id: "test-id-1",
    name: "Test",
    facesPerRun: 10,
    minAge: 0,
    maxAge: 100,
    genders: [0, 1],
    races: [0, 1, 2, 3, 4],
    resolutions: ["low", "medium", "high"],
    datasets: ["cropped", "wild"],
    history: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 20 }, generateId));
    expect(ids.size).toBe(20);
  });

  it("returns a UUID-formatted string", () => {
    const id = generateId();
    // Standard UUID format: 8-4-4-4-12
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

// ---------------------------------------------------------------------------
// loadConfigs / saveConfigs
// ---------------------------------------------------------------------------

describe("loadConfigs", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty array when storage is empty", () => {
    expect(loadConfigs()).toEqual([]);
  });

  it("returns parsed configs after saving", () => {
    const configs = [makeConfig()];
    saveConfigs(configs);
    expect(loadConfigs()).toEqual(configs);
  });

  it("returns empty array on corrupted JSON", () => {
    localStorage.setItem("ageguesser_configs", "not-valid-json{{");
    expect(loadConfigs()).toEqual([]);
  });

  it("preserves multiple configurations", () => {
    const configs = [makeConfig({ id: "a" }), makeConfig({ id: "b" })];
    saveConfigs(configs);
    const loaded = loadConfigs();
    expect(loaded).toHaveLength(2);
    expect(loaded.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// upsertConfig
// ---------------------------------------------------------------------------

describe("upsertConfig", () => {
  beforeEach(() => localStorage.clear());

  it("adds a new config when id does not exist", () => {
    upsertConfig(makeConfig({ id: "new-1" }));
    expect(loadConfigs()).toHaveLength(1);
    expect(loadConfigs()[0].id).toBe("new-1");
  });

  it("updates existing config in-place", () => {
    upsertConfig(makeConfig({ id: "x", name: "Old" }));
    upsertConfig(makeConfig({ id: "x", name: "Updated" }));
    const configs = loadConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe("Updated");
  });

  it("preserves order when updating", () => {
    upsertConfig(makeConfig({ id: "a" }));
    upsertConfig(makeConfig({ id: "b" }));
    upsertConfig(makeConfig({ id: "a", name: "A-updated" }));
    const ids = loadConfigs().map((c) => c.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("appends to existing list", () => {
    upsertConfig(makeConfig({ id: "1" }));
    upsertConfig(makeConfig({ id: "2" }));
    expect(loadConfigs()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// deleteConfig
// ---------------------------------------------------------------------------

describe("deleteConfig", () => {
  beforeEach(() => localStorage.clear());

  it("removes the config with the given id", () => {
    saveConfigs([makeConfig({ id: "keep" }), makeConfig({ id: "remove" })]);
    deleteConfig("remove");
    const configs = loadConfigs();
    expect(configs).toHaveLength(1);
    expect(configs[0].id).toBe("keep");
  });

  it("does nothing when id does not exist", () => {
    saveConfigs([makeConfig({ id: "only" })]);
    deleteConfig("nonexistent");
    expect(loadConfigs()).toHaveLength(1);
  });

  it("results in empty array when deleting last config", () => {
    saveConfigs([makeConfig({ id: "last" })]);
    deleteConfig("last");
    expect(loadConfigs()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// appendRunHistory
// ---------------------------------------------------------------------------

describe("appendRunHistory", () => {
  beforeEach(() => localStorage.clear());

  it("appends a history entry with date and avgDistance", () => {
    saveConfigs([makeConfig({ id: "cfg1", history: [] })]);
    appendRunHistory("cfg1", 7.5);
    const config = loadConfigs()[0];
    expect(config.history).toHaveLength(1);
    expect(config.history[0].avgDistance).toBe(7.5);
    expect(config.history[0].date).toBeTruthy();
  });

  it("accumulates multiple history entries", () => {
    saveConfigs([makeConfig({ id: "cfg1", history: [] })]);
    appendRunHistory("cfg1", 5.0);
    appendRunHistory("cfg1", 3.5);
    expect(loadConfigs()[0].history).toHaveLength(2);
  });

  it("initialises history array if missing", () => {
    const cfg = makeConfig({ id: "cfg1" });
    delete cfg.history;
    saveConfigs([cfg]);
    appendRunHistory("cfg1", 4.0);
    expect(loadConfigs()[0].history).toHaveLength(1);
  });

  it("does nothing if configId not found", () => {
    saveConfigs([makeConfig({ id: "real" })]);
    appendRunHistory("nonexistent", 5.0);
    expect(loadConfigs()[0].history).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createDefaultConfig
// ---------------------------------------------------------------------------

describe("createDefaultConfig", () => {
  it("has required fields", () => {
    const cfg = createDefaultConfig("My Config");
    expect(cfg.name).toBe("My Config");
    expect(typeof cfg.id).toBe("string");
    expect(cfg.facesPerRun).toBeGreaterThan(0);
    expect(Array.isArray(cfg.genders)).toBe(true);
    expect(Array.isArray(cfg.races)).toBe(true);
    expect(Array.isArray(cfg.resolutions)).toBe(true);
    expect(Array.isArray(cfg.datasets)).toBe(true);
    expect(Array.isArray(cfg.history)).toBe(true);
  });

  it("defaults name when not provided", () => {
    const cfg = createDefaultConfig();
    expect(cfg.name).toBeTruthy();
  });

  it("age range is valid (minAge < maxAge)", () => {
    const cfg = createDefaultConfig();
    expect(cfg.minAge).toBeLessThan(cfg.maxAge);
  });

  it("returns unique ids on each call", () => {
    const id1 = createDefaultConfig().id;
    const id2 = createDefaultConfig().id;
    expect(id1).not.toBe(id2);
  });

  it("includes all genders by default", () => {
    expect(createDefaultConfig().genders).toEqual(expect.arrayContaining([0, 1]));
  });

  it("includes all 5 races by default", () => {
    expect(createDefaultConfig().races).toHaveLength(5);
  });

  it("includes all 3 resolutions by default", () => {
    expect(createDefaultConfig().resolutions).toEqual(
      expect.arrayContaining(["low", "medium", "high"])
    );
  });

  it("includes both datasets by default", () => {
    expect(createDefaultConfig().datasets).toContain("cropped");
    expect(createDefaultConfig().datasets).toContain("wild");
  });
});
