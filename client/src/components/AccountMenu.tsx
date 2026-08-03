import { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";

export function AccountMenu() {
  const { user, logout, regenerateRecoveryCode } = useAuth();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Don't leave a half-filled password form sitting around once the menu closes.
  useEffect(() => {
    if (open) return;
    setChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setStatus(null);
    setError(null);
  }, [open]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setStatus("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setChangingPassword(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleGetRecoveryCode() {
    if (!confirm("This replaces your current recovery code — the old one will stop working. Continue?")) return;
    regenerateRecoveryCode();
  }

  if (!user) return null;

  return (
    <div className="account-menu" ref={containerRef}>
      <button className="btn-secondary" onClick={() => setOpen((o) => !o)}>{user.username}</button>
      {open && (
        <div className="account-menu-dropdown">
          <a href="https://github.com/EviePuffRoo/Spark/issues" target="_blank" rel="noreferrer">Send Feedback</a>
          <button onClick={() => setChangingPassword((c) => !c)}>Change Password</button>
          <button onClick={handleGetRecoveryCode}>Get Recovery Code</button>
          <button onClick={() => logout()}>Log Out</button>

          {changingPassword && (
            <form className="account-change-password" onSubmit={handleChangePassword}>
              <label className="field">
                <span>Current password</span>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </label>
              <label className="field">
                <span>New password</span>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn-primary" type="submit">Update Password</button>
            </form>
          )}
          {status && <p className="success">{status}</p>}
        </div>
      )}
    </div>
  );
}
