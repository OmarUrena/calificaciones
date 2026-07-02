"use client";

import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  UserRound,
  UsersRound,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data: stats, isLoading } = useDashboardStats(user);

  return (
    <section>
      <div className="mb-6">
        <h1 className="institutional-title">Dashboard</h1>
        <p className="institutional-subtitle">
          Resumen inicial de la actividad escolar y accesos principales.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-institutional-gray">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando resumen...
        </div>
      ) : null}

      {user?.role === "SUPER_ADMIN" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Escuelas"
            value={formatValue(stats?.schools)}
            description="Instituciones registradas"
            icon={Building2}
          />
        </div>
      ) : null}

      {user?.role === "ADMIN" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Año escolar activo"
            value={stats?.activeSchoolYear ?? "No definido"}
            description="Periodo actual de trabajo"
            icon={CalendarDays}
          />
          <StatCard title="Cursos" value={formatValue(stats?.courses)} icon={GraduationCap} />
          <StatCard title="Estudiantes" value={formatValue(stats?.students)} icon={UsersRound} />
          <StatCard title="Maestros" value={formatValue(stats?.teachers)} icon={UserRound} />
          <StatCard title="Asignaturas" value={formatValue(stats?.subjects)} icon={BookOpen} />
          <StatCard
            title="Cursos sin titular"
            value={formatValue(stats?.coursesWithoutTitular)}
            icon={ClipboardCheck}
            tone="yellow"
          />
          <StatCard
            title="Asignaciones"
            value={formatValue(stats?.assignments)}
            description="Relaciones docente, curso y asignatura"
            icon={ClipboardCheck}
            tone="gray"
          />
          <StatCard
            title="Calificaciones incompletas"
            value="Pendiente"
            description="Se conectará al motor de calificaciones"
            icon={ClipboardCheck}
            tone="gray"
          />
        </div>
      ) : null}

      {user?.role === "TEACHER" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Asignaturas que imparte"
            value={formatValue(stats?.assignments)}
            icon={BookOpen}
          />
          <StatCard
            title="Cursos donde imparte"
            value={formatValue(stats?.teacherCourses)}
            icon={GraduationCap}
          />
          <StatCard
            title="Cursos donde es titular"
            value={formatValue(stats?.titularCourses)}
            icon={ClipboardCheck}
            tone="green"
          />
          <StatCard
            title="Acceso rápido"
            value="Notas"
            description="Usa Mis asignaturas para registrar calificaciones"
            icon={ClipboardCheck}
            tone="gray"
          />
        </div>
      ) : null}
    </section>
  );
}

function formatValue(value?: number | null) {
  return typeof value === "number" ? value : "No disponible";
}
