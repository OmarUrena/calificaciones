import { apiFetch, clearStoredToken, setStoredToken } from "@/lib/api";
import { supabase } from "@/lib/session";
import type { CurrentUser, LoginCredentials, UserRole } from "@/types/auth";

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

  try {
    const user = await getCurrentUser();

    return {
      accessToken: token,
      user,
    };
  } catch (error) {
    clearStoredToken();
    void supabase.auth.signOut();
    throw error;
  }
}

export async function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

export function logout() {
  void supabase?.auth.signOut();
  clearStoredToken();
}

export function getRoleRedirectPath(role: UserRole) {
  if (role === "SUPER_ADMIN") return "/schools";
  if (role === "TEACHER") return "/my-subjects";
  return "/dashboard";
}
