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
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn: AuthState["signIn"] = ({ token, user }) => {
    setToken(token);
    client.clear();
    setUser(user);
  };
  const signOut = () => {
    setToken(null);
    client.clear();
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}
