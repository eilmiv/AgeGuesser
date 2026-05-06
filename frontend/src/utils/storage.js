/**
 * localStorage utilities for AgeGuesser configurations.
 *
 * All application state is persisted in the browser – no database required.
 */

const STORAGE_KEY = "ageguesser_configs";

/** Generate a simple UUID-like string. */
export function generateId() {
  return (
    Math.random().toString(36).substring(2, 11) +
    Math.random().toString(36).substring(2, 11)
  );
}

/** Load all configurations from localStorage. */
export function loadConfigs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist all configurations to localStorage. */
export function saveConfigs(configs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

/** Add or update a single configuration. */
export function upsertConfig(config) {
  const configs = loadConfigs();
  const idx = configs.findIndex((c) => c.id === config.id);
  if (idx >= 0) {
    configs[idx] = config;
  } else {
    configs.push(config);
  }
  saveConfigs(configs);
}

/** Delete a configuration by id. */
export function deleteConfig(id) {
  const configs = loadConfigs().filter((c) => c.id !== id);
  saveConfigs(configs);
}

/** Append a run result to the configuration's history. */
export function appendRunHistory(configId, avgDistance) {
  const configs = loadConfigs();
  const config = configs.find((c) => c.id === configId);
  if (!config) return;
  if (!config.history) config.history = [];
  config.history.push({
    date: new Date().toISOString(),
    avgDistance,
  });
  saveConfigs(configs);
}

/**
 * Create a default configuration object.
 * @param {string} name
 * @returns {object}
 */
export function createDefaultConfig(name = "New Configuration") {
  return {
    id: generateId(),
    name,
    facesPerRun: 10,
    minAge: 0,
    maxAge: 100,
    genders: [0, 1],
    races: [0, 1, 2, 3, 4],
    datasets: ["cropped", "wild"],
    history: [],
  };
}
