import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";

const mockDeleteAccount = vi.fn();
const mockLogout = vi.fn();
const mockRegenerateRecoveryCode = vi.fn();

vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "testdm", tier: "free", role: "user" },
    logout: mockLogout,
    regenerateRecoveryCode: mockRegenerateRecoveryCode,
    deleteAccount: mockDeleteAccount,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  mockDeleteAccount.mockReset();
  mockLogout.mockReset();
  mockRegenerateRecoveryCode.mockReset();
});

describe("ProfilePage change password", () => {
  it("blocks submission and shows an error when the confirmation doesn't match", () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "oldpass1" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "typo" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(screen.getByText("New password and confirmation don't match.")).toBeInTheDocument();
  });
});

describe("ProfilePage danger zone", () => {
  it("requires a confirm() before deleting, and does nothing if the user cancels", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "mypassword" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("calls deleteAccount with the entered password once confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDeleteAccount.mockResolvedValue(undefined);
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "mypassword" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith("mypassword"));
  });

  it("shows the server's error message if deletion fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDeleteAccount.mockRejectedValue(new Error("Incorrect password."));
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    expect(await screen.findByText("Incorrect password.")).toBeInTheDocument();
  });
});
