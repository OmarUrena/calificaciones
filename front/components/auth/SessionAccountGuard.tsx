"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/session";

export function SessionAccountGuard({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let disposed = false;
    let receivedEvent = false;
    let accountId: string | null = null;
    let redirecting = false;

    function leave(reason: string) {
      if (disposed || redirecting) return;
      redirecting = true;
      setLeaving(true);
      void queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace(`/login?reason=${reason}`);
    }

    function acceptAccount(id: string | undefined) {
      if (disposed || !id) return;
      if (accountId && accountId !== id && window.location.pathname !== "/login") {
        leave("account-changed");
      } else {
        accountId = id;
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      // Keep callbacks synchronous; defer React/cache work until Auth releases its lock.
      queueMicrotask(() => acceptAccount(session?.user.id));
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!receivedEvent) acceptAccount(data.session?.user.id);
    }).catch(() => undefined);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "califapp_logout" && event.newValue) leave("signed-out");
    };
    window.addEventListener("storage", onStorage);
    return () => {
      disposed = true;
      subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [queryClient]);

  // Same-account renewal and temporary expiry keep editors and drafts mounted.
  return leaving ? null : children;
}
