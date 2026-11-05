import { createClient } from "@supabase/supabase-js";

import { createAuthFetch } from "@/lib/auth-fetch";

const TOKEN_KEY = "califapp_token";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: { autoRefreshToken: true, persistSession: true },
      global: { fetch: createAuthFetch(url) },
    })
  : null;

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=604800; samesite=lax`;
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}

// Keep the routing cookie in sync, including refreshes and changes in other tabs.
// This callback must stay synchronous: calling auth methods here can deadlock.
supabase?.auth.onAuthStateChange((event, session) => {
  if (session) setStoredToken(session.access_token);
  else if (event === "SIGNED_OUT") clearStoredToken();
});

export async function getAccessToken(): Promise<string | null> {
  if (!supabase || typeof window === "undefined") return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token ?? null;
  if (token) setStoredToken(token);
  return token;
}

let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(rejectedToken: string): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const currentToken = await getAccessToken();
    if (!currentToken || !supabase) return null;
    if (currentToken !== rejectedToken) return currentToken;
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    const token = data.session?.access_token ?? null;
    if (token) setStoredToken(token);
    return token;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
