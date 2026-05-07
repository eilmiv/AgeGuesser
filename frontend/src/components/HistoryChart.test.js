/**
 * Tests for HistoryChart component.
 *
 * Note: recharts' ResponsiveContainer requires a real layout engine to render
 * SVG content. In JSDOM all elements have zero dimensions, so we test that the
 * component mounts without errors and that its wrapping element is present.
 * The recharts internal SVG rendering itself is tested by the recharts library.
 */

import React from "react";
import { render } from "@testing-library/react";
import HistoryChart from "./HistoryChart";

// Recharts uses ResizeObserver; provide a simple stub.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("HistoryChart", () => {
  const history = [
    { date: "2024-01-01T00:00:00Z", avgDistance: 12 },
    { date: "2024-01-02T00:00:00Z", avgDistance: 9 },
    { date: "2024-01-03T00:00:00Z", avgDistance: 6 },
  ];

  it("renders without crashing", () => {
    const { container } = render(<HistoryChart history={history} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders a recharts ResponsiveContainer wrapper", () => {
    const { container } = render(<HistoryChart history={history} />);
    // recharts ResponsiveContainer renders a div wrapper
    expect(container.querySelector("div")).toBeInTheDocument();
  });

  it("renders with a single data point without crashing", () => {
    expect(() =>
      render(<HistoryChart history={[{ date: "2024-01-01", avgDistance: 5 }]} />)
    ).not.toThrow();
  });

  it("renders with an empty history array without crashing", () => {
    expect(() => render(<HistoryChart history={[]} />)).not.toThrow();
  });

  it("renders with large history without crashing", () => {
    const largeHistory = Array.from({ length: 50 }, (_, i) => ({
      date: new Date(2024, 0, i + 1).toISOString(),
      avgDistance: Math.random() * 20,
    }));
    expect(() => render(<HistoryChart history={largeHistory} />)).not.toThrow();
  });
});
