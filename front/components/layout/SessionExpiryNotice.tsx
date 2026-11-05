"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { login } from "@/lib/auth";
import { refreshAccessToken, supabase } from "@/lib/session";

type Notice = { token: string; expired: boolean };

// The native modal keeps keyboard focus inside and makes the page behind it inert.
// A stable ref avoids reopening it when loading or error messages change.
function openSessionDialog(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  dialog.showModal();
  return () => dialog.close();
}

export function SessionExpiryNotice({ email }: { email: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;
    let disposed = false;
    let receivedEvent = false;
    let initialized = false;
    let checking = false;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: { access_token: string; expires_at?: number } | null = null;

    function updateNotice() {
      if (disposed || !initialized) return;
      clearTimeout(timer);
      const remaining = current?.expires_at === undefined
        ? null
        : current.expires_at - Date.now() / 1000;
      if (current && (remaining === null || remaining > 0)) {
        setNotice(null);
        // Token expiry is not session expiry: let Supabase renew silently first.
        if (remaining !== null) {
          timer = setTimeout(updateNotice, Math.min(remaining * 1000 + 50, 2_147_483_647));
        }
      } else if (!checking) {
        // Never call Auth methods inside onAuthStateChange: it holds the Auth lock.
        timer = setTimeout(() => void checkExpiredSession(), 0);
      }
    }

    async function checkExpiredSession() {
      if (disposed || checking) return;
      checking = true;
      const startedAtRevision = revision;
      try {
        // getSession refreshes expired tokens and reuses renewals from other tabs.
        const { data, error: sessionError } = await auth.getSession();
        if (disposed || revision !== startedAtRevision) return;
        const session = data.session;
        if (!sessionError && session &&
          (session.expires_at === undefined || session.expires_at > Date.now() / 1000)) {
          acceptSession(session);
        } else {
          setNotice({ token: current?.access_token ?? "", expired: true });
        }
      } catch {
        if (!disposed && revision === startedAtRevision) {
          setNotice({ token: current?.access_token ?? "", expired: true });
        }
      } finally {
        checking = false;
        if (!disposed && revision !== startedAtRevision) updateNotice();
      }
    }

    function acceptSession(session: typeof current) {
      if (disposed) return;
      revision++;
      current = session;
      initialized = true;
      setError(null);
      if (session) {
        setNeedsLogin(false);
        setPassword("");
      }
      updateNotice();
    }

    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      acceptSession(session);
    });
    void auth.getSession().then(({ data, error: sessionError }) => {
      if (!receivedEvent && !sessionError) acceptSession(data.session);
    }).catch(() => {
      // Auth events remain subscribed if session retrieval temporarily fails.
    });
    // Recalculate after sleep or a background tab whose timers were throttled.
    const onVisible = () => {
      if (document.visibilityState === "visible") updateNotice();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", updateNotice);
    window.addEventListener("online", updateNotice);
    return () => {
      disposed = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", updateNotice);
      window.removeEventListener("online", updateNotice);
    };
  }, []);

  async function continueSession() {
    if (!notice || isRenewing) return;
    setIsRenewing(true);
    setError(null);
    try {
      const token = await refreshAccessToken(notice.token);
      if (!token) {
        setNeedsLogin(true);
        setError("La sesión ya no se puede renovar. Confirma tu contraseña aquí para continuar sin perder las notas pendientes.");
        return;
      }
      setNotice(null);
      toast.success("Sesión renovada. Puedes continuar trabajando.");
    } catch {
      setError("No se pudo renovar la sesión. Revisa tu conexión y vuelve a intentarlo en un minuto, o confirma tu contraseña aquí. No recargues esta página.");
    } finally {
      setIsRenewing(false);
    }
  }

  async function signInAgain() {
    if (!password || isRenewing) return;
    setIsRenewing(true);
    setError(null);
    try {
      await login({ email, password });
      setNotice(null);
      setNeedsLogin(false);
      toast.success("Sesión restablecida. Puedes continuar trabajando.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setPassword("");
      setIsRenewing(false);
    }
  }

  if (!notice) return null;

  return (
    <dialog
      ref={openSessionDialog}
      aria-labelledby="session-expiry-title"
      aria-describedby="session-expiry-description"
      onCancel={(event) => event.preventDefault()}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-blue-200 bg-white p-6 text-institutional-gray-dark shadow-xl backdrop:bg-slate-900/50"
    >
      <form className="flex flex-col gap-6" onSubmit={(event) => {
        event.preventDefault();
        void (needsLogin ? signInAgain() : continueSession());
      }}>
        <div className="min-w-0" role="status" aria-live="polite">
          <h2 id="session-expiry-title" className="text-xl font-semibold text-balance">
            {notice.expired ? "Tu sesión necesita renovarse" : "Tu sesión está próxima a vencer"}
          </h2>
          <p id="session-expiry-description" className="mt-3 text-base text-pretty">
            {needsLogin ? "Confirma tu contraseña para recuperar la sesión de esta cuenta." : "Continúa la sesión para seguir trabajando."} Las notas pendientes se conservan en esta página y se envían al pulsar Guardar.
          </p>
        </div>
        {needsLogin ? (
          <div className="flex flex-col gap-3">
            <label className="text-sm" htmlFor="session-email">Cuenta</label>
            <input id="session-email" name="username" type="email" autoComplete="username" value={email} readOnly className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-base" />
            <label className="text-sm" htmlFor="session-password">Contraseña</label>
            <input id="session-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={isRenewing} className="rounded-md border border-slate-300 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-blue-700" />
          </div>
        ) : null}
        <button
          type="submit"
          disabled={isRenewing}
          className="rounded-md bg-blue-700 px-3 py-2 text-base font-semibold text-white hover:bg-blue-800 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isRenewing ? "Recuperando sesión..." : needsLogin ? "Iniciar sesión y continuar" : "Continuar sesión"}
        </button>
        {!needsLogin ? (
          <button type="button" onClick={() => { setNeedsLogin(true); setError(null); }} className="text-sm text-blue-700 underline hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700">
            Confirmar contraseña para recuperar la sesión
          </button>
        ) : null}
      </form>
      {error ? <p role="alert" className="mt-3 text-sm text-red-800 text-pretty">{error}</p> : null}
    </dialog>
  );
}
