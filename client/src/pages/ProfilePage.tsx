import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useTheme } from "../useTheme";
import { useLocalStorage } from "../useLocalStorage";
import { api } from "../api";
import { LegacyPanel } from "../components/LegacyPanel";

export function ProfilePage() {
  const { user, logout, regenerateRecoveryCode, deleteAccount, updateDisplayName } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [notifyEnabled, setNotifyEnabled] = useLocalStorage("spark-notify-my-turn", false);
  const [notifyBlocked, setNotifyBlocked] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameStatus, setDisplayNameStatus] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  async function handleSaveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    setDisplayNameError(null);
    setDisplayNameStatus(null);
    setSavingDisplayName(true);
    try {
      await updateDisplayName(displayName);
      setDisplayNameStatus("Saved.");
    } catch (e) {
      setDisplayNameError((e as Error).message);
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordStatus(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordStatus("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
    } catch (e) {
      setPasswordError((e as Error).message);
    }
  }

  function handleGetRecoveryCode() {
    if (!confirm("This replaces your current recovery code. The old one will stop working. Continue?")) return;
    regenerateRecoveryCode();
  }

  // Mirrors PlayerCompanionView.tsx's own notification toggle exactly —
  // both read/write the same "spark-notify-my-turn" key, so this and the
  // mobile companion view's toggle stay in sync with no extra plumbing.
  async function handleToggleNotify() {
    if (notifyEnabled) {
      setNotifyEnabled(false);
      return;
    }
    if (typeof Notification === "undefined") {
      setNotifyBlocked(true);
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      setNotifyEnabled(true);
      setNotifyBlocked(false);
    } else {
      setNotifyBlocked(true);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (!confirm("This permanently deletes your account and everything in it: worlds, characters, published homebrew, all of it. This cannot be undone. Continue?")) return;
    try {
      await deleteAccount(deletePassword);
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  }

  if (!user) return null;

  return (
    <div className="page">
      <div className="panel">
        <h2>Profile</h2>
        <p className="entity-meta">
          Signed in as {user.displayName ? `${user.displayName} (${user.username})` : user.username}
          {user.role === "admin" ? " (admin)" : ""}
        </p>

        <h3 className="section-heading">Display Name</h3>
        <div className="save-panel">
          <p className="hint">Shown instead of your login username on party ledgers, shop transactions, and anywhere else your name appears to others. Leave blank to use your username.</p>
          <form className="account-change-password" onSubmit={handleSaveDisplayName}>
            <label className="field">
              <span>Display name</span>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user.username} maxLength={40} />
            </label>
            {displayNameError && <p className="error">{displayNameError}</p>}
            {displayNameStatus && <p className="success">{displayNameStatus}</p>}
            <button className="btn-primary" type="submit" disabled={savingDisplayName}>{savingDisplayName ? "Saving…" : "Save Display Name"}</button>
          </form>
        </div>

        <LegacyPanel />

        <h3 className="section-heading">Account</h3>
        <div className="save-panel">
          <div className="button-row">
            <button className="btn-secondary" onClick={() => setChangingPassword((c) => !c)}>Change Password</button>
            <button className="btn-secondary" onClick={handleGetRecoveryCode}>Get Recovery Code</button>
            <a className="btn-secondary" href="https://github.com/EviePuffRoo/Spark/issues" target="_blank" rel="noreferrer">Send Feedback</a>
            <button className="btn-secondary" onClick={() => logout()}>Log Out</button>
          </div>

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
              <label className="field">
                <span>Confirm new password</span>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
              </label>
              {passwordError && <p className="error">{passwordError}</p>}
              <button className="btn-primary" type="submit">Update Password</button>
            </form>
          )}
          {passwordStatus && <p className="success">{passwordStatus}</p>}
        </div>

        <h3 className="section-heading">Preferences</h3>
        <div className="save-panel">
          <div className="button-row">
            <button className="btn-secondary" onClick={toggleTheme}>
              {isDark ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}
            </button>
            <button className="btn-secondary" onClick={handleToggleNotify}>
              {notifyEnabled ? "🔔 Notify on my turn: On" : "🔕 Notify on my turn: Off"}
            </button>
          </div>
          {notifyBlocked && (
            <p className="hint">Notifications are blocked in your browser. Allow them for this site to enable turn alerts.</p>
          )}
          <p className="hint">Turn notifications fire while you're in Player View during live combat.</p>
        </div>

        <div className="danger-zone">
          <h3 className="section-heading">Danger Zone</h3>
          <p className="hint">Permanently delete your account and everything in it. This cannot be undone.</p>
          <form className="account-change-password" onSubmit={handleDeleteAccount}>
            <label className="field">
              <span>Password</span>
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" required />
            </label>
            {deleteError && <p className="error">{deleteError}</p>}
            <button className="btn-danger" type="submit">Delete My Account</button>
          </form>
        </div>
      </div>
    </div>
  );
}
