/**
 * Tests for SummaryView component.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SummaryView from "./SummaryView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(age, guess, dataset = "cropped") {
  return {
    image: {
      filename: `${age}_0_0_date.jpg`,
      dataset,
      age,
    },
    guess,
    distance: Math.abs(age - guess),
  };
}

function makeConfig() {
  return {
    id: "c1",
    name: "My Config",
    facesPerRun: 5,
    minAge: 0,
    maxAge: 100,
    genders: [0, 1],
    races: [0, 1, 2, 3, 4],
    datasets: ["cropped"],
    history: [],
  };
}

function renderSummary(results, props = {}) {
  const defaults = {
    config: makeConfig(),
    onDone: jest.fn(),
    onRunAgain: jest.fn(),
  };
  return render(<SummaryView results={results} {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("SummaryView empty state", () => {
  it("shows empty message and back button when no results", () => {
    renderSummary(null);
    expect(screen.getByText(/no results to display/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("calls onDone when back button is clicked in empty state", () => {
    const onDone = jest.fn();
    renderSummary(null, { onDone });
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("handles empty array the same as null", () => {
    renderSummary([]);
    expect(screen.getByText(/no results to display/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe("SummaryView stats", () => {
  it('shows "Run Complete!" heading', () => {
    renderSummary([makeResult(25, 28)]);
    expect(screen.getByText("Run Complete!")).toBeInTheDocument();
  });

  it("shows correct average distance", () => {
    // distances: 3, 5 → avg 4.0
    renderSummary([makeResult(25, 28), makeResult(40, 45)]);
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("shows best guess (smallest distance)", () => {
    renderSummary([makeResult(25, 28), makeResult(40, 40)]);
    // distances: 3, 0 → best = 0
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows worst guess (largest distance)", () => {
    renderSummary([makeResult(25, 40), makeResult(30, 31)]);
    // distances: 15, 1 → worst = 15
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("shows count of perfect guesses", () => {
    renderSummary([
      makeResult(25, 25),
      makeResult(30, 25),
      makeResult(40, 40),
    ]);
    // 2 perfect guesses
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

describe("SummaryView actions", () => {
  it("calls onDone when back button is clicked", () => {
    const onDone = jest.fn();
    renderSummary([makeResult(25, 28)], { onDone });
    fireEvent.click(screen.getByRole("button", { name: /back to configurations/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onRunAgain when Run Again is clicked", () => {
    const onRunAgain = jest.fn();
    renderSummary([makeResult(25, 28)], { onRunAgain });
    fireEvent.click(screen.getByRole("button", { name: /run again/i }));
    expect(onRunAgain).toHaveBeenCalledTimes(1);
  });

  it("does not show Run Again button when config is null", () => {
    renderSummary([makeResult(25, 28)], { config: null });
    expect(screen.queryByRole("button", { name: /run again/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Results grid
// ---------------------------------------------------------------------------

describe("SummaryView results grid", () => {
  it("renders one card per result", () => {
    renderSummary([makeResult(20, 22), makeResult(30, 35), makeResult(50, 48)]);
    // Each card shows actual age
    expect(screen.getAllByText(/\d+ yrs/).length).toBeGreaterThanOrEqual(3);
  });

  it("shows actual and guessed ages in each card", () => {
    renderSummary([makeResult(25, 30)]);
    expect(screen.getByText(/25 yrs/)).toBeInTheDocument();
    expect(screen.getByText(/30 yrs/)).toBeInTheDocument();
  });

  it('shows "Excellent" badge for distance <= 2', () => {
    renderSummary([makeResult(25, 26)]);
    expect(screen.getByText(/excellent/i)).toBeInTheDocument();
  });

  it('shows "Good" badge for distance 3-5', () => {
    renderSummary([makeResult(25, 29)]);
    expect(screen.getByText(/good/i)).toBeInTheDocument();
  });

  it('shows "Close" badge for distance 6-10', () => {
    renderSummary([makeResult(25, 32)]);
    expect(screen.getByText(/close/i)).toBeInTheDocument();
  });

  it('shows "Far off" badge for distance > 10', () => {
    renderSummary([makeResult(25, 40)]);
    expect(screen.getByText(/far off/i)).toBeInTheDocument();
  });

  it("shows off-by detail for non-zero distance", () => {
    renderSummary([makeResult(25, 28)]);
    expect(screen.getByText(/off by 3/i)).toBeInTheDocument();
  });

  it("does not show off-by detail for perfect guess", () => {
    renderSummary([makeResult(25, 25)]);
    expect(screen.queryByText(/off by/i)).not.toBeInTheDocument();
  });
});
