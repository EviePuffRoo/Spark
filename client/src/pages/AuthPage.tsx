import { useState } from "react";
import { useAuth } from "../AuthContext";

export function AuthPage() {
  const { login, signup, resetPassword, sessionMessage } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: "login" | "signup" | "reset") {
    setMode(next);
    setError(null);
    setPassword("");
    setRecoveryCode("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username, password);
      } else if (mode === "signup") {
        await signup(username, password);
      } else {
        await resetPassword(username, recoveryCode, password);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="panel auth-panel">
        <h1>Spark</h1>
        <p className="tagline">Everything a DM needs to prep and run a session, ready for the table</p>

        {sessionMessage && <p className="error">{sessionMessage}</p>}

        {mode !== "reset" && (
          <div className="tabs forge-mode-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Log In</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign Up</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>

          {mode === "reset" && (
            <label className="field">
              <span>Recovery code</span>
              <input type="text" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" required />
            </label>
          )}

          <label className="field">
            <span>{mode === "reset" ? "New password" : "Password"}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>
          {mode !== "login" && <p className="hint">At least 8 characters.</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : "Reset Password"}
          </button>
        </form>

        {mode === "login" && (
          <button className="link-button" onClick={() => switchMode("reset")}>Forgot password?</button>
        )}
        {mode === "reset" && (
          <button className="link-button" onClick={() => switchMode("login")}>← Back to log in</button>
        )}
      </div>
    </div>
  );
}
