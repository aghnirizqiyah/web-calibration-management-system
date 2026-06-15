import React, { createContext, useContext, useState, useCallback } from "react";
import { setRole } from "../lib/api";

export type UserRole = "admin" | "user";

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  username: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => UserRole | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    role: null,
    username: null,
  });

const login = useCallback((username: string, password: string): UserRole | null => {
  const uname = username.trim();

  if (uname === "admin" && password === "admin1234") {
    setState({ isAuthenticated: true, role: "admin", username: uname });
    setRole("admin"); 
    return "admin";
  }

  if (uname === "user" && password === "user1234") {
    setState({ isAuthenticated: true, role: "user", username: uname });
    setRole("user");
    return "user";
  }

  return null;
}, []);

  const logout = useCallback(() => {
    setState({ isAuthenticated: false, role: null, username: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};