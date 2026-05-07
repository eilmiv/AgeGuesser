/**
 * Tests for ConfigForm component.
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigForm from "./ConfigForm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(props = {}) {
  const defaults = {
    initial: null,
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };
  return render(<ConfigForm {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ConfigForm rendering", () => {
  it('shows "New Configuration" heading when creating', () => {
    renderForm();
    expect(screen.getByText("New Configuration")).toBeInTheDocument();
  });

  it('shows "Edit Configuration" heading when editing', () => {
    const initial = {
      id: "x",
      name: "My Config",
      facesPerRun: 5,
      minAge: 20,
      maxAge: 60,
      genders: [0],
      races: [0, 1],
      datasets: ["cropped"],
      history: [],
    };
    renderForm({ initial });
    expect(screen.getByText("Edit Configuration")).toBeInTheDocument();
  });

  it("pre-fills form with initial values", () => {
    const initial = {
      id: "x",
      name: "Existing Name",
      facesPerRun: 5,
      minAge: 20,
      maxAge: 60,
      genders: [0],
      races: [0, 1],
      datasets: ["cropped"],
      history: [],
    };
    renderForm({ initial });
    expect(screen.getByDisplayValue("Existing Name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
  });

  it("renders all gender checkboxes", () => {
    renderForm();
    expect(screen.getByLabelText("Male")).toBeInTheDocument();
    expect(screen.getByLabelText("Female")).toBeInTheDocument();
  });

  it("renders all race checkboxes", () => {
    renderForm();
    expect(screen.getByLabelText("White")).toBeInTheDocument();
    expect(screen.getByLabelText("Black")).toBeInTheDocument();
    expect(screen.getByLabelText("Asian")).toBeInTheDocument();
    expect(screen.getByLabelText("Indian")).toBeInTheDocument();
    expect(screen.getByLabelText("Other")).toBeInTheDocument();
  });

  it("renders dataset checkboxes", () => {
    renderForm();
    expect(screen.getByLabelText("Cropped faces")).toBeInTheDocument();
    expect(screen.getByLabelText("In-the-wild faces")).toBeInTheDocument();
  });

  it("renders resolution checkboxes", () => {
    renderForm();
    expect(screen.getByLabelText("Low")).toBeInTheDocument();
    expect(screen.getByLabelText("Medium")).toBeInTheDocument();
    expect(screen.getByLabelText("High")).toBeInTheDocument();
  });

  it("renders Save and Cancel buttons", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("ConfigForm validation", () => {
  it("shows error when name is empty", () => {
    renderForm();
    const nameInput = screen.getByPlaceholderText(/e\.g\. Young adults/i);
    userEvent.clear(nameInput);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it("shows error when max age <= min age", () => {
    renderForm();
    const minInput = screen.getByPlaceholderText("Min");
    const maxInput = screen.getByPlaceholderText("Max");
    // Set minAge > maxAge
    userEvent.clear(minInput);
    userEvent.type(minInput, "50");
    userEvent.clear(maxInput);
    userEvent.type(maxInput, "30");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/max age must be greater/i)).toBeInTheDocument();
  });

  it("shows error when no gender is selected", () => {
    renderForm();
    // Uncheck both genders
    userEvent.click(screen.getByLabelText("Male"));
    userEvent.click(screen.getByLabelText("Female"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/select at least one gender/i)).toBeInTheDocument();
  });

  it("shows error when no race is selected", () => {
    renderForm();
    // Uncheck all races
    ["White", "Black", "Asian", "Indian", "Other"].forEach((label) => {
      userEvent.click(screen.getByLabelText(label));
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/select at least one race/i)).toBeInTheDocument();
  });

  it("shows error when no dataset is selected", () => {
    renderForm();
    userEvent.click(screen.getByLabelText("Cropped faces"));
    userEvent.click(screen.getByLabelText("In-the-wild faces"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/select at least one dataset/i)).toBeInTheDocument();
  });

  it("shows error when no resolution is selected", () => {
    renderForm();
    userEvent.click(screen.getByLabelText("Low"));
    userEvent.click(screen.getByLabelText("Medium"));
    userEvent.click(screen.getByLabelText("High"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/select at least one resolution/i)).toBeInTheDocument();
  });

  it("clears field error when field is corrected", () => {
    renderForm();
    const nameInput = screen.getByPlaceholderText(/e\.g\. Young adults/i);
    userEvent.clear(nameInput);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    userEvent.type(nameInput, "Fixed Name");
    expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

describe("ConfigForm submission", () => {
  it("calls onSave with form data when valid", () => {
    const onSave = jest.fn();
    renderForm({ onSave });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.id).toBeTruthy();
    expect(saved.history).toEqual([]);
    expect(Array.isArray(saved.genders)).toBe(true);
    expect(Array.isArray(saved.races)).toBe(true);
    expect(Array.isArray(saved.resolutions)).toBe(true);
  });

  it("calls onSave with updated name", () => {
    const onSave = jest.fn();
    renderForm({ onSave });
    const nameInput = screen.getByPlaceholderText(/e\.g\. Young adults/i);
    userEvent.clear(nameInput);
    userEvent.type(nameInput, "Seniors");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave.mock.calls[0][0].name).toBe("Seniors");
  });

  it("preserves id and history when editing", () => {
    const onSave = jest.fn();
    const initial = {
      id: "existing-id",
      name: "Old Name",
      facesPerRun: 5,
      minAge: 0,
      maxAge: 80,
      genders: [0, 1],
      races: [0, 1, 2, 3, 4],
      resolutions: ["medium", "high"],
      datasets: ["cropped"],
      history: [{ date: "2024-01-01", avgDistance: 5 }],
    };
    renderForm({ initial, onSave });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    const saved = onSave.mock.calls[0][0];
    expect(saved.id).toBe("existing-id");
    expect(saved.history).toEqual(initial.history);
    expect(saved.resolutions).toEqual(["medium", "high"]);
  });

  it("fills default resolutions for old config without resolutions field", () => {
    const onSave = jest.fn();
    const initial = {
      id: "old-id",
      name: "Old Config",
      facesPerRun: 5,
      minAge: 0,
      maxAge: 80,
      genders: [0, 1],
      races: [0, 1, 2, 3, 4],
      datasets: ["cropped"],
      history: [],
      // no resolutions field
    };
    renderForm({ initial, onSave });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    const saved = onSave.mock.calls[0][0];
    expect(saved.resolutions).toEqual(["low", "medium", "high"]);
  });

  it("does not call onSave when form is invalid", () => {
    const onSave = jest.fn();
    renderForm({ onSave });
    const nameInput = screen.getByPlaceholderText(/e\.g\. Young adults/i);
    userEvent.clear(nameInput);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

describe("ConfigForm cancel", () => {
  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = jest.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Checkbox toggles
// ---------------------------------------------------------------------------

describe("ConfigForm checkbox toggles", () => {
  it("toggling a gender checkbox updates selection", () => {
    renderForm();
    const maleCheckbox = screen.getByLabelText("Male");
    expect(maleCheckbox).toBeChecked();
    userEvent.click(maleCheckbox);
    expect(maleCheckbox).not.toBeChecked();
  });

  it("toggling a race checkbox updates selection", () => {
    renderForm();
    const asianCheckbox = screen.getByLabelText("Asian");
    expect(asianCheckbox).toBeChecked();
    userEvent.click(asianCheckbox);
    expect(asianCheckbox).not.toBeChecked();
    userEvent.click(asianCheckbox);
    expect(asianCheckbox).toBeChecked();
  });

  it("toggling a dataset checkbox updates selection", () => {
    renderForm();
    const croppedCheckbox = screen.getByLabelText("Cropped faces");
    expect(croppedCheckbox).toBeChecked();
    userEvent.click(croppedCheckbox);
    expect(croppedCheckbox).not.toBeChecked();
  });

  it("toggling a resolution checkbox updates selection", () => {
    renderForm();
    const lowCheckbox = screen.getByLabelText("Low");
    expect(lowCheckbox).toBeChecked();
    userEvent.click(lowCheckbox);
    expect(lowCheckbox).not.toBeChecked();
    userEvent.click(lowCheckbox);
    expect(lowCheckbox).toBeChecked();
  });
});
