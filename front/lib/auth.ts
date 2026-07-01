import { apiFetch, clearStoredToken, setStoredToken } from "@/lib/api";
import type { CurrentUser, LoginCredentials, LoginResponse, UserRole } from "@/types/auth";

const TOKEN_COOKIE_NAME = "califapp_token";

export async function login(credentials: LoginCredentials) {
  const response = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  const token = getTokenFromLoginResponse(response);

  if (!token) {
    throw new Error("La respuesta de login no incluyó token de sesión.");
  }

  setStoredToken(token);
  setAuthCookie(token);

  return response;
}

export async function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

export function logout() {
  clearStoredToken();
  clearAuthCookie();
}

export function getRoleRedirectPath(role: UserRole) {
  if (role === "SUPER_ADMIN") return "/schools";
  if (role === "TEACHER") return "/my-subjects";
  return "/dashboard";
}

function getTokenFromLoginResponse(response: LoginResponse) {
  return response.accessToken ?? response.token ?? response.session?.access_token ?? null;
}

function setAuthCookie(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=604800; samesite=lax`;
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}
