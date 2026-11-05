"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { ApiError } from "@/lib/api";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { SessionExpiryNotice } from "./SessionExpiryNotice";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError, error, refetch } = useCurrentUser();

  useEffect(() => {
    // A background session check must not unmount an editor with unsaved work.
    if (isError && !user && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, user, error, router]);

  if (isLoading) {
    return (
      <main className="institutional-page flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-institutional-gray">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando sesión...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="institutional-page flex items-center justify-center p-6">
        <div className="admin-card max-w-md space-y-3 text-center">
          <p>No se pudo verificar la sesión. Comprueba tu conexión e inténtalo de nuevo.</p>
          <button className="underline" onClick={() => void refetch()} type="button">Reintentar</button>
        </div>
      </main>
    );
  }

  return (
    <div className="institutional-page flex">
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        {user ? <SessionExpiryNotice /> : null}
        <main className="flex-1 p-4 md:p-6">
          {isError && !(error instanceof ApiError && error.status === 401) && (
            <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              No se pudo actualizar la sesión. <button className="underline" onClick={() => void refetch()} type="button">Reintentar</button>
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
