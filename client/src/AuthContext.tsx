import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@spark/shared";
import { api } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  pendingRecoveryCode: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  resetPassword: (username: string, recoveryCode: string, newPassword: string) => Promise<void>;
  regenerateRecoveryCode: () => Promise<void>;
  acknowledgeRecoveryCode: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const loggedInUser = await api.login(username, password);
    setUser(loggedInUser);
  }

  async function signup(username: string, password: string) {
    const { recoveryCode, ...newUser } = await api.signup(username, password);
    setUser(newUser);
    setPendingRecoveryCode(recoveryCode);
  }

  async function resetPassword(username: string, recoveryCode: string, newPassword: string) {
    const { recoveryCode: nextRecoveryCode, ...loggedInUser } = await api.resetPassword(username, recoveryCode, newPassword);
    setUser(loggedInUser);
    setPendingRecoveryCode(nextRecoveryCode);
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

  return (
    <AuthContext.Provider value={{ user, loading, pendingRecoveryCode, login, signup, resetPassword, regenerateRecoveryCode, acknowledgeRecoveryCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
