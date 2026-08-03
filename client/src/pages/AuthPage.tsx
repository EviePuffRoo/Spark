import { useState } from "react";
import { useAuth } from "../AuthContext";

export function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await signup(username, password);
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

        <div className="tabs forge-mode-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Log In</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>
          {mode === "signup" && <p className="hint">At least 8 characters.</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
