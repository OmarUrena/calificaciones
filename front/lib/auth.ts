import { createClient } from "@supabase/supabase-js";

import { apiFetch, clearStoredToken, setStoredToken } from "@/lib/api";
import type { CurrentUser, LoginCredentials, UserRole } from "@/types/auth";

const TOKEN_COOKIE_NAME = "califapp_token";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function login(credentials: LoginCredentials) {
  if (!supabase) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error || !data.session?.access_token) {
    throw new Error(error?.message ?? "No se pudo iniciar sesión con Supabase.");
  }

  const token = data.session.access_token;
  setStoredToken(token);
  setAuthCookie(token);

  const user = await getCurrentUser();

  return {
    accessToken: token,
    user,
  };
}

export async function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

export function logout() {
  void supabase?.auth.signOut();
  clearStoredToken();
  clearAuthCookie();
}

export function getRoleRedirectPath(role: UserRole) {
  if (role === "SUPER_ADMIN") return "/schools";
  if (role === "TEACHER") return "/my-subjects";
  return "/dashboard";
}

function setAuthCookie(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=604800; samesite=lax`;
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}
