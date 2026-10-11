"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useCurrentUser } from "@/hooks/use-current-user";
import { logout } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();
  const isUnauthorized =
    isError && error instanceof ApiError && error.code === "UNAUTHENTICATED";

  useEffect(() => {
    if (!isUnauthorized || redirecting.current) return;
    redirecting.current = true;
    void logout()
      .catch(() => undefined)
      .finally(() => {
        queryClient.clear();
        router.replace("/login");
      });
  }, [isUnauthorized, queryClient, router]);

  if (isPending || isUnauthorized) {
    return (
      <main className="institutional-page flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-institutional-gray">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando sesión...
        </div>
      </main>
    );
  }

  if (isError && !user) {
    return (
      <main className="institutional-page flex items-center justify-center p-6">
        <div className="admin-card max-w-md space-y-3 text-center">
          <p>No se pudo verificar la sesión. Comprueba tu conexión e inténtalo de nuevo.</p>
          <button className="underline" onClick={() => void refetch()} type="button">
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="institutional-page flex">
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-4 md:p-6">
          {isError && (
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
