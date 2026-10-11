"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { clearLegacyAuth, logout } from "@/lib/auth";
import {
  SESSION_IDLE_MS,
  SESSION_IDLE_MINUTES,
  SESSION_LAST_ACTIVITY_KEY,
  SESSION_WARNING_AT_MS,
  SESSION_WARNING_AFTER_MINUTES,
} from "@/lib/session-config";
import { supabase } from "@/lib/supabase-client";

const ACTIVITY_WRITE_INTERVAL_MS = 5_000;

export function SessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    let hasSession = false;
    let endingSession = false;
    let authUserId: string | null = null;

    const endSession = async () => {
      if (endingSession) return;
      endingSession = true;
      setSecondsRemaining(null);
      queryClient.clear();
      try {
        await logout();
      } catch {
        // Aunque Supabase no responda, no se permite continuar usando esta sesión.
      } finally {
        if (mounted) router.replace("/login?reason=inactive");
      }
    };

    const check = () => {
      if (!hasSession || endingSession) return;
      const lastActivity = Number(window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY));
      if (!lastActivity) {
        window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
        setSecondsRemaining(null);
        return;
      }

      const elapsed = Date.now() - lastActivity;
      if (elapsed >= SESSION_IDLE_MS) {
        void endSession();
      } else {
        setSecondsRemaining(
          elapsed >= SESSION_WARNING_AT_MS
            ? Math.ceil((SESSION_IDLE_MS - elapsed) / 1_000)
            : null,
        );
      }
    };

    const onActivity = () => {
      if (!hasSession || endingSession) return;
      const lastActivity = Number(window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY));
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= SESSION_IDLE_MS) {
        void endSession();
      } else if (elapsed < SESSION_WARNING_AT_MS && elapsed >= ACTIVITY_WRITE_INTERVAL_MS) {
        window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_LAST_ACTIVITY_KEY) check();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      queueMicrotask(() => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          hasSession = false;
          authUserId = null;
          window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
          queryClient.clear();
          setSecondsRemaining(null);
          if (pathname !== "/login") router.replace("/login");
          return;
        }
        if (session) {
          if (event === "SIGNED_IN" && authUserId && authUserId !== session.user.id && pathname !== "/login") {
            queryClient.clear();
            window.location.reload();
            return;
          }
          authUserId = session.user.id;
          hasSession = true;
          clearLegacyAuth();
          check();
        }
      });
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || error || !data.session) return;
      authUserId = data.session.user.id;
      hasSession = true;
      clearLegacyAuth();
      check();
    });

    const timer = window.setInterval(check, 1_000);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, queryClient, router]);

  function continueSession() {
    window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
    setSecondsRemaining(null);
  }

  if (secondsRemaining === null) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        aria-describedby="session-warning-description"
        aria-labelledby="session-warning-title"
        aria-modal="true"
        className="admin-card w-full max-w-md space-y-4"
        role="dialog"
      >
        <h2 className="text-xl font-semibold text-primary" id="session-warning-title">
          Tu sesión está por terminar
        </h2>
        <p id="session-warning-description">
          Por seguridad, la sesión se cerrará tras {SESSION_IDLE_MINUTES} minutos sin actividad. Quedan {minutes}:
          {String(seconds).padStart(2, "0")}. Puedes continuar trabajando o cerrar sesión.
        </p>
        <p className="text-sm text-institutional-gray">
          Este aviso aparece tras {SESSION_WARNING_AFTER_MINUTES} minutos de inactividad.
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-md border border-border px-4 py-2"
            onClick={() => void logout()
              .then(() => router.replace("/login"))
              .catch(() => toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo."))}
            type="button"
          >
            Cerrar sesión
          </button>
          <button
            autoFocus
            className="rounded-md bg-primary px-4 py-2 text-white"
            onClick={continueSession}
            type="button"
          >
            Continuar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
