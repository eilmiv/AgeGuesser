/**
 * Tests for ConfigList component.
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ConfigList from "./ConfigList";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides = {}) {
  return {
    id: "cfg-1",
    name: "Test Config",
    facesPerRun: 10,
    minAge: 0,
    maxAge: 100,
    genders: [0, 1],
    races: [0, 1, 2, 3, 4],
    datasets: ["cropped", "wild"],
    history: [],
    ...overrides,
  };
}

function renderList(configs = [], props = {}) {
  const defaults = {
    onNew: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onRun: jest.fn(),
  };
  return render(<ConfigList configs={configs} {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("ConfigList empty state", () => {
  it("shows empty state message when no configs", () => {
    renderList([]);
    expect(screen.getByText(/no configurations yet/i)).toBeInTheDocument();
  });

  it("shows new configuration button", () => {
    renderList([]);
    expect(
      screen.getByRole("button", { name: /new configuration/i })
    ).toBeInTheDocument();
  });

  it("calls onNew when new button is clicked", () => {
    const onNew = jest.fn();
    renderList([], { onNew });
    fireEvent.click(screen.getByRole("button", { name: /new configuration/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Config cards
// ---------------------------------------------------------------------------

describe("ConfigList config cards", () => {
  it("renders a card for each config", () => {
    renderList([makeConfig({ id: "a", name: "A" }), makeConfig({ id: "b", name: "B" })]);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows age range and faces count in card", () => {
    renderList([makeConfig({ minAge: 10, maxAge: 60, facesPerRun: 15 })]);
    expect(screen.getByText(/10.+60/)).toBeInTheDocument();
    expect(screen.getByText(/15 faces/)).toBeInTheDocument();
  });

  it("shows run, edit, and delete buttons", () => {
    renderList([makeConfig()]);
    expect(screen.getByTitle("Start a run")).toBeInTheDocument();
    expect(screen.getByTitle("Edit configuration")).toBeInTheDocument();
    expect(screen.getByTitle("Delete configuration")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

describe("ConfigList actions", () => {
  it("calls onRun when run button is clicked", () => {
    const onRun = jest.fn();
    const config = makeConfig({ id: "run-me" });
    renderList([config], { onRun });
    fireEvent.click(screen.getByTitle("Start a run"));
    expect(onRun).toHaveBeenCalledWith(config);
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = jest.fn();
    const config = makeConfig({ id: "edit-me" });
    renderList([config], { onEdit });
    fireEvent.click(screen.getByTitle("Edit configuration"));
    expect(onEdit).toHaveBeenCalledWith(config);
  });

  it("calls onDelete after confirmation", () => {
    const onDelete = jest.fn();
    window.confirm = jest.fn(() => true);
    renderList([makeConfig({ id: "del-me" })], { onDelete });
    fireEvent.click(screen.getByTitle("Delete configuration"));
    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith("del-me");
  });

  it("does not call onDelete when confirmation is cancelled", () => {
    const onDelete = jest.fn();
    window.confirm = jest.fn(() => false);
    renderList([makeConfig({ id: "del-me" })], { onDelete });
    fireEvent.click(screen.getByTitle("Delete configuration"));
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Expand / collapse
// ---------------------------------------------------------------------------

describe("ConfigList expand/collapse", () => {
  it("does not show detail panel initially", () => {
    renderList([makeConfig()]);
    expect(screen.queryByText(/genders:/i)).not.toBeInTheDocument();
  });

  it("shows detail panel when card header is clicked", () => {
    renderList([makeConfig({ name: "My Config" })]);
    fireEvent.click(screen.getByText("My Config"));
    expect(screen.getByText(/genders:/i)).toBeInTheDocument();
  });

  it("shows datasets in detail panel", () => {
    renderList([makeConfig({ datasets: ["cropped"] })]);
    fireEvent.click(screen.getByText("Test Config"));
    expect(screen.getByText(/datasets:/i)).toBeInTheDocument();
    expect(screen.getByText("cropped")).toBeInTheDocument();
  });

  it("collapses when header is clicked again", () => {
    renderList([makeConfig()]);
    const header = screen.getByText("Test Config");
    fireEvent.click(header);
    expect(screen.getByText(/genders:/i)).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.queryByText(/genders:/i)).not.toBeInTheDocument();
  });

  it("shows no-history message when history is empty", () => {
    renderList([makeConfig({ history: [] })]);
    fireEvent.click(screen.getByText("Test Config"));
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });

  it("renders history chart when history is non-empty", () => {
    const config = makeConfig({
      history: [
        { date: "2024-01-01T00:00:00Z", avgDistance: 5 },
        { date: "2024-01-02T00:00:00Z", avgDistance: 4 },
      ],
    });
    renderList([config]);
    fireEvent.click(screen.getByText("Test Config"));
    // HistoryChart renders a div container (recharts wraps in div)
    expect(screen.getByText(/learning progress/i)).toBeInTheDocument();
  });
});
