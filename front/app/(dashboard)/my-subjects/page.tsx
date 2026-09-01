"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { BookOpen, FileUp, Loader2, PencilLine } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useTeacherAssignments } from "@/hooks/use-teacher-assignments";
import { cn } from "@/lib/utils";
import type { TeacherAssignment } from "@/types/assignment";

const EMPTY_ASSIGNMENTS: TeacherAssignment[] = [];

export default function MySubjectsPage() {
  const { data: user, isLoading: isLoadingUser } = useCurrentUser();
  const { data: assignments = EMPTY_ASSIGNMENTS, isLoading: isLoadingAssignments } =
    useTeacherAssignments();

  const isTeacher = user?.role === "TEACHER";
  const visibleAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.isActive &&
          (!user?.activeSchoolYear || assignment.schoolYearId === user.activeSchoolYear.id),
      ),
    [assignments, user?.activeSchoolYear],
  );

  const columns = useMemo<ColumnDef<TeacherAssignment>[]>(
    () => [
      {
        header: "Curso",
        accessorKey: "course",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-institutional-gray-dark">
              {row.original.course?.name ?? "Curso no disponible"}
            </p>
            <p className="text-sm text-institutional-gray">
              {row.original.schoolYear?.name ?? "Año escolar no disponible"}
            </p>
          </div>
        ),
      },
      {
        header: "Asignatura",
        accessorKey: "subject",
        cell: ({ row }) => (
          <span className="font-medium text-institutional-gray-dark">
            {row.original.subject?.name ?? "Asignatura no disponible"}
          </span>
        ),
      },
      {
        header: "Tipo",
        id: "type",
        cell: ({ row }) => <SubjectTypeBadge assignment={row.original} />,
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => <AssignmentActions assignment={row.original} />,
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visibleAssignments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const isLoading = isLoadingUser || isLoadingAssignments;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="institutional-title">Mis asignaturas</h1>
        <p className="institutional-subtitle">
          Consulta tus cursos asignados y accede al registro o importación de calificaciones.
        </p>
      </div>

      {!isLoading && !isTeacher ? (
        <div className="admin-card">
          <p className="text-base font-medium text-institutional-gray-dark">
            Esta vista está disponible únicamente para docentes.
          </p>
          <p className="mt-1 text-sm text-institutional-gray">
            Los usuarios administrativos pueden gestionar todas las asignaciones desde el menú
            Asignaciones docentes.
          </p>
        </div>
      ) : null}

      {isTeacher && !user?.teacherId ? (
        <div className="admin-card border-amber-300 bg-amber-50">
          <p className="font-medium text-amber-900">Tu usuario no está vinculado a un maestro.</p>
          <p className="mt-1 text-sm text-amber-800">
            Solicita a un administrador que vincule tu cuenta para poder ver tus asignaturas.
          </p>
        </div>
      ) : null}

      {isTeacher ? (
        <div className="admin-card overflow-hidden p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Cargando asignaturas...
            </div>
          ) : visibleAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
              <p className="text-lg font-medium text-institutional-gray-dark">
                No tienes asignaturas activas
              </p>
              <p className="max-w-xl text-base text-institutional-gray">
                No se encontraron asignaciones para el año escolar activo. Consulta con un
                administrador si consideras que falta alguna.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="compact-table">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          className={header.column.id === "actions" ? "w-80" : undefined}
                          key={header.id}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SubjectTypeBadge({ assignment }: { assignment: TeacherAssignment }) {
  const isTechnical = assignment.subject?.type === "TECHNICAL";

  return (
    <span className={isTechnical ? "status-badge status-approved" : "status-badge status-pending"}>
      {isTechnical ? "Técnica" : "Académica"}
    </span>
  );
}

function AssignmentActions({ assignment }: { assignment: TeacherAssignment }) {
  const isTechnical = assignment.subject?.type === "TECHNICAL";
  const query = new URLSearchParams({
    courseId: assignment.courseId,
    subjectId: assignment.subjectId,
  }).toString();
  const gradesHref = isTechnical ? `/grades/technical?${query}` : `/grades/academic?${query}`;
  const importHref = `/imports?type=${isTechnical ? "technical" : "academic"}&${query}`;

  return (
    <div className="flex flex-wrap gap-2">
      <ActionLink href={gradesHref}>
        <PencilLine aria-hidden="true" />
        Registrar notas
      </ActionLink>
      <ActionLink href={importHref} variant="outline">
        <FileUp aria-hidden="true" />
        Importar notas
      </ActionLink>
    </div>
  );
}

function ActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
        "[&_svg]:h-4 [&_svg]:w-4",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background text-institutional-gray-dark hover:bg-muted",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
