import { useState } from "react";
import { useAuth } from "../AuthContext";

export function AuthPage() {
  const { login, signup, resetPassword, sessionMessage } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: "login" | "signup" | "reset") {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setRecoveryCode("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode !== "login" && password !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
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
    <main className="page auth-page">
      <div className="auth-pitch">
        <div className="auth-wordmark">
          <img src="/favicon.svg" alt="" className="auth-bolt" />
          <h1>Spark</h1>
        </div>
        <p className="tagline">Everything a DM needs to prep and run a session, ready for the table</p>
        <ul className="auth-pitch-points">
          <li>
            <strong>One tool, prep to table.</strong> Build your world, then run it live — encounters, dice, HP, and party chat sync to every player's phone as you play.
          </li>
          <li>
            <strong>No AI, ever.</strong> Every generator is hand-curated and deterministic. Nothing about your campaign is sent to a language model — not your notes, not your players' characters, nothing.
          </li>
          <li>
            <strong>Real-time sync, free.</strong> Live combat, chat, and party tracking aren't a paid tier here — they're just how the app works.
          </li>
        </ul>
      </div>

      <div className="panel auth-panel">
        {sessionMessage && <p className="error">{sessionMessage}</p>}

        {mode !== "reset" && (
          <div className="tabs forge-mode-tabs">
            <button className={mode === "login" ? "active" : ""} aria-current={mode === "login" ? "true" : undefined} onClick={() => switchMode("login")}>Log In</button>
            <button className={mode === "signup" ? "active" : ""} aria-current={mode === "signup" ? "true" : undefined} onClick={() => switchMode("signup")}>Sign Up</button>
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
          {mode !== "login" && (
            <label className="field">
              <span>{mode === "reset" ? "Confirm new password" : "Confirm password"}</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
            </label>
          )}
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

        <p className="hint auth-legal-links">
          By continuing you agree to our <a href="/terms">Terms of Service</a> and{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
