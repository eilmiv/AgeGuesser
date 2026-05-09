import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminView from "./AdminView";

describe("AdminView", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("shows login form when admin is not logged in", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logged_in: false, username: null }),
    });

    render(<AdminView onBack={jest.fn()} />);
    expect(await screen.findByText(/Admin login/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
  });

  it("loads datasets after successful login", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logged_in: false, username: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, username: "admin" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logged_in: true, username: "admin" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          datasets: [{ name: "cropped", count: 1, is_default: true }],
        }),
      });

    render(<AdminView onBack={jest.fn()} />);
    await screen.findByText(/Admin login/i);
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "supersecret" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Logged in as admin/i)).toBeInTheDocument();
      expect(screen.getByText(/1 images/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
    });
  });
});
