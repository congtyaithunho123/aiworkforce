const API_BASE = "/api";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  organizationId: number;
}

export interface AuthOrganization {
  id: number;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  organization: AuthOrganization;
}

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "auth_user";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");

  let res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(input, { ...init, headers });
    }
  }

  return res;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = await res.json() as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  referralCode?: string;
}): Promise<AuthResponse> {
  const { referralCode, ...body } = data;
  const url = referralCode
    ? `${API_BASE}/auth/register?ref=${encodeURIComponent(referralCode)}`
    : `${API_BASE}/auth/register`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Registration failed");
  }

  return res.json() as Promise<AuthResponse>;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Login failed");
  }

  return res.json() as Promise<AuthResponse>;
}

export async function logout(): Promise<void> {
  const token = getAccessToken();
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {}
  }
  clearTokens();
}

export async function forgotPassword(email: string): Promise<{ message: string; debug_token?: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Request failed");
  }

  return res.json() as Promise<{ message: string; debug_token?: string }>;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Reset failed");
  }
}

export async function getMe(): Promise<AuthResponse> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json() as Promise<AuthResponse>;
}
