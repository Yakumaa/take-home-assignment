/**
 * context/AuthContext.jsx
 *
 * Provides { user, token, login, logout } to the entire app.
 *
 * The JWT payload is decoded client-side (no jwt-decode library needed —
 * we just base64-decode the middle segment). The role embedded in the
 * token was set server-side at login and is read-only here.
 */

import { createContext, useContext, useState, useCallback } from "react";
import * as api from "@/api/client";

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    // Base64url → Base64 → JSON
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getStoredUser() {
  const token = localStorage.getItem("access_token");
  if (!token) return { token: null, user: null };
  const payload = decodeJwt(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    localStorage.removeItem("access_token");
    return { token: null, user: null };
  }
  return {
    token,
    user: { id: Number(payload.sub), role: payload.role },
  };
}

export function AuthProvider({ children }) {
  const initial = getStoredUser();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    const { access_token } = res.data;
    localStorage.setItem("access_token", access_token);
    const payload = decodeJwt(access_token);
    setToken(access_token);
    setUser({ id: Number(payload.sub), role: payload.role });
    return payload.role;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}