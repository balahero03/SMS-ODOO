import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (result: { token: string; user: User }) => void;
  signOut: () => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthState>(null as never);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  const client = useQueryClient();

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then((r) => setUser(r.user))
      // api() drops the token on a 401. Keep it through an outage, so a refresh later restores the session.
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signIn: AuthState["signIn"] = ({ token, user }) => {
    setToken(token);
    client.clear();
    setUser(user);
  };
  const clearSession = () => {
    setToken(null);
    client.clear();
    setUser(null);
  };
  const signOut = () => {
    // api() reads the token before this returns. If the call fails, the token still expires on schedule.
    api("/auth/logout", { body: {} }).catch(() => {});
    clearSession();
  };
  return <AuthContext.Provider value={{ user, loading, signIn, signOut, clearSession }}>{children}</AuthContext.Provider>;
}
