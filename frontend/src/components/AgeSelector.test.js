/**
 * Tests for AgeSelector component.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AgeSelector from "./AgeSelector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSelector(props = {}) {
  const defaults = {
    minAge: 0,
    maxAge: 100,
    selectedAge: null,
    correctAge: null,
    disabled: false,
    onSelect: jest.fn(),
  };
  return render(<AgeSelector {...defaults} {...props} />);
}

// Mock getBoundingClientRect for the bar element
function mockBarRect(barEl, { left = 0, width = 100 } = {}) {
  barEl.getBoundingClientRect = jest.fn(() => ({
    left,
    width,
    top: 0,
    right: left + width,
    bottom: 10,
    x: left,
    y: 0,
  }));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("AgeSelector rendering", () => {
  it("shows prompt label when not disabled", () => {
    renderSelector();
    expect(screen.getByText(/click to guess the age/i)).toBeInTheDocument();
  });

  it("shows result label when disabled", () => {
    renderSelector({ disabled: true, selectedAge: 30 });
    expect(screen.getByText(/click the image to continue/i)).toBeInTheDocument();
  });

  it("renders min and max age labels", () => {
    renderSelector({ minAge: 20, maxAge: 80 });
    // These values appear in both tick labels and range labels – just confirm they're present
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
    expect(screen.getAllByText("80").length).toBeGreaterThan(0);
  });

  it("renders tick marks for age range", () => {
    renderSelector({ minAge: 0, maxAge: 100 });
    // range=100 → tickInterval=20 → ticks at 0, 20, 40, 60, 80, 100
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("40").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);
  });

  it("renders narrow-range ticks every 5 years", () => {
    renderSelector({ minAge: 0, maxAge: 30 });
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("has role=slider when not disabled", () => {
    renderSelector();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("does not have role=slider when disabled", () => {
    renderSelector({ disabled: true, selectedAge: 50, correctAge: 45 });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("shows selected age marker when selectedAge is set", () => {
    renderSelector({ selectedAge: 40, correctAge: 35, disabled: true });
    // The selected age value appears in the marker label
    expect(screen.getAllByText("40").length).toBeGreaterThan(0);
  });

  it("shows correct age marker with checkmark when correctAge is set", () => {
    renderSelector({ selectedAge: 40, correctAge: 35, disabled: true });
    expect(screen.getByText("✓", { exact: false })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

describe("AgeSelector interaction", () => {
  it("calls onSelect when bar is clicked", () => {
    const onSelect = jest.fn();
    const { container } = renderSelector({ onSelect });
    const bar = container.querySelector(".age-bar");
    mockBarRect(bar, { left: 0, width: 100 });
    // Click at 50% → age = 50
    fireEvent.click(bar, { clientX: 50 });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(50);
  });

  it("clamps click at left edge to minAge", () => {
    const onSelect = jest.fn();
    const { container } = renderSelector({ onSelect, minAge: 10, maxAge: 90 });
    const bar = container.querySelector(".age-bar");
    mockBarRect(bar, { left: 0, width: 200 });
    fireEvent.click(bar, { clientX: -50 }); // before the bar
    expect(onSelect).toHaveBeenCalledWith(10); // clamped to minAge
  });

  it("clamps click at right edge to maxAge", () => {
    const onSelect = jest.fn();
    const { container } = renderSelector({ onSelect, minAge: 0, maxAge: 100 });
    const bar = container.querySelector(".age-bar");
    mockBarRect(bar, { left: 0, width: 100 });
    fireEvent.click(bar, { clientX: 200 }); // beyond the bar
    expect(onSelect).toHaveBeenCalledWith(100); // clamped to maxAge
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = jest.fn();
    const { container } = renderSelector({
      disabled: true,
      onSelect,
      selectedAge: 30,
    });
    const bar = container.querySelector(".age-bar");
    mockBarRect(bar, { left: 0, width: 100 });
    fireEvent.click(bar, { clientX: 50 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows hover age on mouse move", () => {
    const { container } = renderSelector({ minAge: 0, maxAge: 100 });
    const bar = container.querySelector(".age-bar");
    mockBarRect(bar, { left: 0, width: 100 });
    fireEvent.mouseMove(bar, { clientX: 30 });
    // hover age 30 should appear as label
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
  });

  it("removes hover indicator on mouse leave", () => {
    const { container } = renderSelector({ minAge: 0, maxAge: 100 });
    const bar = container.querySelector(".age-bar");
    mockBarRect(bar, { left: 0, width: 100 });
    fireEvent.mouseMove(bar, { clientX: 70 });
    fireEvent.mouseLeave(bar);
    // "70" tick label may still exist, but hover-specific .age-marker-hover should be gone
    expect(container.querySelector(".age-marker-hover")).not.toBeInTheDocument();
  });
});
