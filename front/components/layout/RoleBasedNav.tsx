"use client";

import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileDown,
  GraduationCap,
  Home,
  Import,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";

import type { CurrentUser, UserRole } from "@/types/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { href: "/schools", label: "Escuelas", icon: Building2 },
    { href: "/users", label: "Usuarios", icon: UsersRound },
    { href: "/settings", label: "Configuración", icon: Settings },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/school-years", label: "Año escolar", icon: CalendarDays },
    { href: "/courses", label: "Cursos", icon: GraduationCap },
    { href: "/students", label: "Estudiantes", icon: UsersRound },
    { href: "/teachers", label: "Maestros", icon: UserRound },
    { href: "/subjects", label: "Asignaturas", icon: BookOpen },
    { href: "/assignments", label: "Asignaciones docentes", icon: ClipboardList },
    { href: "/grades/academic", label: "Calificaciones", icon: ClipboardList },
    { href: "/imports", label: "Importaciones", icon: Import },
    { href: "/reports", label: "Boletines", icon: FileDown },
    { href: "/settings", label: "Configuración", icon: Settings },
  ],
  TEACHER: [
    { href: "/my-subjects", label: "Mis asignaturas", icon: BookOpen },
    { href: "/grades/academic", label: "Calificaciones", icon: ClipboardList },
    { href: "/imports", label: "Importar calificaciones", icon: Import },
  ],
};

export function getNavItems(user?: CurrentUser | null) {
  if (!user) return [];
  return NAV_BY_ROLE[user.role] ?? [];
}
