import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { AuthPage } from "./AuthPage";

// In login mode the mode-switch tab and the form's submit button both read
// "Log In" — scope to the <form> to get the submit button unambiguously.
function submitButton() {
  return within(document.querySelector("form")!).getByRole("button");
}

const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockResetPassword = vi.fn();

vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
    resetPassword: mockResetPassword,
    sessionMessage: null,
  }),
}));

beforeEach(() => {
  mockLogin.mockReset();
  mockSignup.mockReset();
  mockResetPassword.mockReset();
});

describe("AuthPage", () => {
  it("defaults to login mode and submits username/password to login()", async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "gary" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("gary", "password123"));
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("switches to signup mode and shows the minimum-length hint", () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("submits to signup() in signup mode", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(mockSignup).toHaveBeenCalledWith("newuser", "password123"));
  });

  it("blocks signup submission and shows an error when the confirmation doesn't match", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newuser" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "typo" } });
    fireEvent.click(submitButton());

    expect(await screen.findByText("New password and confirmation don't match.")).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("switches to reset mode via Forgot password?, showing a recovery code field and hiding the mode tabs", () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByLabelText("Recovery code")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign Up" })).not.toBeInTheDocument();
    expect(submitButton()).toHaveTextContent("Reset Password");
  });

  it("submits username/recoveryCode/newPassword to resetPassword() in reset mode", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "gary" } });
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "ABCD-EFGH-IJKL-MNOP" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "brandnewpass1" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith("gary", "ABCD-EFGH-IJKL-MNOP", "brandnewpass1"));
  });

  it("blocks reset submission and shows an error when the confirmation doesn't match", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "gary" } });
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "ABCD-EFGH-IJKL-MNOP" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "typo" } });
    fireEvent.click(submitButton());

    expect(await screen.findByText("New password and confirmation don't match.")).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("shows the error message when login() rejects", async () => {
    mockLogin.mockRejectedValue(new Error("Incorrect username or password."));
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "gary" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Incorrect username or password.")).toBeInTheDocument();
  });
});
