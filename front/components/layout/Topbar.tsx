"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { CurrentUser } from "@/types/auth";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  TEACHER: "Docente",
};

export function Topbar({ user }: { user?: CurrentUser | null }) {
  const { logout } = useAuth();

  return (
    <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border bg-white px-4 py-4 md:px-6">
      <div className="min-w-0">
        <p className="text-base font-semibold text-primary">CalifApp</p>
        <p className="truncate text-sm text-institutional-gray">
          {user?.school?.name ?? "Escuela no seleccionada"} ·{" "}
          {user?.activeSchoolYear?.name ?? "Año escolar no definido"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-base font-medium text-institutional-gray-dark">
            {user?.fullName ?? "Usuario"}
          </p>
          <p className="text-sm text-institutional-gray">
            {user?.role ? ROLE_LABELS[user.role] : "Rol"}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut aria-hidden="true" />
          Salir
        </Button>
      </div>
    </header>
  );
}
