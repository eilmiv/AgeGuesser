/**
 * Tests for RunView component.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import RunView from "./RunView";

// ---------------------------------------------------------------------------
// Helpers / mocks
// ---------------------------------------------------------------------------

function makeConfig(overrides = {}) {
  return {
    id: "cfg-1",
    name: "Test Config",
    facesPerRun: 3,
    minAge: 0,
    maxAge: 100,
    genders: [0, 1],
    races: [0, 1, 2, 3, 4],
    datasets: ["cropped"],
    ...overrides,
  };
}

function makeImageResponse(age = 30) {
  return {
    dataset: "cropped",
    filename: `${age}_0_0_date.jpg`,
    age,
    gender: 0,
    race: 0,
    url: `/api/image/cropped/${age}_0_0_date.jpg`,
  };
}

/** Build a fetch mock that returns images with the given ages in sequence. */
function buildFetchMock(ages) {
  let callCount = 0;
  return jest.fn(() => {
    const age = ages[callCount % ages.length];
    callCount++;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(makeImageResponse(age)),
    });
  });
}

function buildFailingFetchMock(errorMsg = "No images match") {
  return jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: errorMsg }),
    })
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("RunView loading state", () => {
  beforeEach(() => {
    global.fetch = buildFetchMock([25]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows loading indicator initially", () => {
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows progress info", async () => {
    render(<RunView config={makeConfig({ facesPerRun: 5 })} onComplete={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.getByText(/1 \/ 5/i)).toBeInTheDocument();
  });

  it("shows AgeSelector after image loads", async () => {
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("RunView error state", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows error message when fetch fails", async () => {
    global.fetch = buildFailingFetchMock("No images match the given criteria");
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/could not load image/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/No images match/i)).toBeInTheDocument();
  });

  it("shows hint with download command on error", async () => {
    global.fetch = buildFailingFetchMock("HTTP 500");
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/python manage\.py download/i)).toBeInTheDocument()
    );
  });

  it("shows retry button on error", async () => {
    global.fetch = buildFailingFetchMock("HTTP 404");
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    );
  });

  it("retries fetch when Try Again is clicked", async () => {
    global.fetch = buildFailingFetchMock("HTTP 404");
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    );
    // Now let the next fetch succeed
    global.fetch = buildFetchMock([30]);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() =>
      expect(screen.queryByText(/could not load image/i)).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Guess flow
// ---------------------------------------------------------------------------

describe("RunView guess flow", () => {
  beforeEach(() => {
    global.fetch = buildFetchMock([30, 25, 40]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("AgeSelector becomes disabled after guessing", async () => {
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    // Simulate a guess by triggering AgeSelector's onSelect
    const bar = screen.getByRole("slider");
    bar.getBoundingClientRect = jest.fn(() => ({ left: 0, width: 100 }));
    fireEvent.click(bar, { clientX: 30 });

    // AgeSelector should now show disabled state
    await waitFor(() =>
      expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    );
  });

  it("shows result overlay after guessing", async () => {
    render(<RunView config={makeConfig()} onComplete={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const bar = screen.getByRole("slider");
    bar.getBoundingClientRect = jest.fn(() => ({ left: 0, width: 100 }));
    fireEvent.click(bar, { clientX: 30 });

    await waitFor(() =>
      expect(screen.getByText(/you said/i)).toBeInTheDocument()
    );
  });

  it("advances to next image when clicking image wrapper after reveal", async () => {
    render(<RunView config={makeConfig({ facesPerRun: 3 })} onComplete={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const bar = screen.getByRole("slider");
    bar.getBoundingClientRect = jest.fn(() => ({ left: 0, width: 100 }));
    fireEvent.click(bar, { clientX: 30 });

    await waitFor(() => expect(screen.getByText(/click image to continue/i)).toBeInTheDocument());

    // Click the image wrapper to advance
    const imageWrapper = document.querySelector(".run-image-wrapper.clickable");
    fireEvent.click(imageWrapper);

    await waitFor(() => expect(screen.getByText(/2 \/ 3/i)).toBeInTheDocument());
  });

  it("shows running avg distance after first guess", async () => {
    render(<RunView config={makeConfig({ facesPerRun: 3 })} onComplete={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    const bar = screen.getByRole("slider");
    bar.getBoundingClientRect = jest.fn(() => ({ left: 0, width: 100 }));
    fireEvent.click(bar, { clientX: 30 });

    const imageWrapper = document.querySelector(".run-image-wrapper.clickable");
    fireEvent.click(imageWrapper);

    await waitFor(() => expect(screen.getByText(/avg distance/i)).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Run completion
// ---------------------------------------------------------------------------

describe("RunView completion", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls onComplete with results after all faces are guessed", async () => {
    const onComplete = jest.fn();
    global.fetch = buildFetchMock([30, 25]);

    render(<RunView config={makeConfig({ facesPerRun: 2 })} onComplete={onComplete} />);

    for (let i = 0; i < 2; i++) {
      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      );

      const bar = screen.getByRole("slider");
      bar.getBoundingClientRect = jest.fn(() => ({ left: 0, width: 100 }));
      fireEvent.click(bar, { clientX: 50 });

      await waitFor(() => expect(screen.getByText(/you said/i)).toBeInTheDocument());

      if (i < 1) {
        const wrapper = document.querySelector(".run-image-wrapper.clickable");
        fireEvent.click(wrapper);
      } else {
        const wrapper = document.querySelector(".run-image-wrapper.clickable");
        fireEvent.click(wrapper);
      }
    }

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty("image");
    expect(results[0]).toHaveProperty("guess");
    expect(results[0]).toHaveProperty("distance");
  });
});
