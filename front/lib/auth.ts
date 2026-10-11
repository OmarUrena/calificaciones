import { ApiError, apiFetch } from "@/lib/api";
import { SESSION_LAST_ACTIVITY_KEY } from "@/lib/session-config";
import { supabase } from "@/lib/supabase-client";
import type { CurrentUser, LoginCredentials, UserRole } from "@/types/auth";

export async function login(credentials: LoginCredentials) {
  if (!supabase) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const previousActivity = window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
  window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error || !data.session?.access_token) {
    if (previousActivity) window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, previousActivity);
    throw new Error(error?.message ?? "No se pudo iniciar sesión con Supabase.");
  }

  window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
  try {
    const user = await getCurrentUser();
    clearLegacyAuth();

    return {
      user,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
      await supabase.auth.signOut({ scope: "local" });
      window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    }
    throw error;
  }
}

export async function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

export async function logout() {
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    clearLegacyAuth();
  }
}

export function getRoleRedirectPath(role: UserRole) {
  if (role === "SUPER_ADMIN") return "/schools";
  if (role === "TEACHER") return "/my-subjects";
  return "/dashboard";
}

export function clearLegacyAuth() {
  if (typeof document === "undefined") return;
  window.localStorage.removeItem("califapp_token");
  document.cookie = "califapp_token=; path=/; max-age=0; samesite=lax";
}
