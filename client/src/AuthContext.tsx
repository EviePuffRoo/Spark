import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@spark/shared";
import { api, setSessionExpiredHandler } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  pendingRecoveryCode: string | null;
  sessionMessage: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  resetPassword: (username: string, recoveryCode: string, newPassword: string) => Promise<void>;
  regenerateRecoveryCode: () => Promise<void>;
  acknowledgeRecoveryCode: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setSessionMessage("Your session expired — please log in again.");
    });
  }, []);

  async function login(username: string, password: string) {
    const loggedInUser = await api.login(username, password);
    setUser(loggedInUser);
    setSessionMessage(null);
  }

  async function signup(username: string, password: string) {
    const { recoveryCode, ...newUser } = await api.signup(username, password);
    setUser(newUser);
    setPendingRecoveryCode(recoveryCode);
    setSessionMessage(null);
  }

  async function resetPassword(username: string, recoveryCode: string, newPassword: string) {
    const { recoveryCode: nextRecoveryCode, ...loggedInUser } = await api.resetPassword(username, recoveryCode, newPassword);
    setUser(loggedInUser);
    setPendingRecoveryCode(nextRecoveryCode);
    setSessionMessage(null);
  }

  async function regenerateRecoveryCode() {
    const { recoveryCode } = await api.regenerateRecoveryCode();
    setPendingRecoveryCode(recoveryCode);
  }

  function acknowledgeRecoveryCode() {
    setPendingRecoveryCode(null);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  // Re-fetches the current user — used after returning from a Stripe
  // Checkout/Portal redirect, since the tier flip lands via webhook and may
  // not have landed by the time the browser comes back.
  async function refreshUser() {
    const freshUser = await api.me().catch(() => null);
    if (freshUser) setUser(freshUser);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, pendingRecoveryCode, sessionMessage,
      login, signup, resetPassword, regenerateRecoveryCode, acknowledgeRecoveryCode, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
