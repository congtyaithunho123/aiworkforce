import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  getStoredUser,
  setStoredUser,
  setTokens,
  clearTokens,
  getAccessToken,
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  getMe,
  type AuthUser,
  type AuthOrganization,
} from "@/lib/auth-client";

interface AuthState {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: getStoredUser(),
    organization: null,
    isAuthenticated: !!getAccessToken(),
    isLoading: true,
  });

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setState((s) => ({ ...s, isLoading: false, isAuthenticated: false, user: null, organization: null }));
      return;
    }
    try {
      const { user, organization } = await getMe();
      setStoredUser(user);
      setState({ user, organization, isAuthenticated: true, isLoading: false });
    } catch {
      clearTokens();
      setState({ user: null, organization: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user, organization } = await authLogin(email, password);
    setTokens(accessToken, refreshToken);
    setStoredUser(user);
    setState({ user, organization, isAuthenticated: true, isLoading: false });
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; organizationName: string }) => {
    const { accessToken, refreshToken, user, organization } = await authRegister(data);
    setTokens(accessToken, refreshToken);
    setStoredUser(user);
    setState({ user, organization, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setState({ user: null, organization: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
