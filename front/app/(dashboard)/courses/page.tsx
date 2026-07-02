"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { FileDown, GraduationCap, Loader2, Pencil, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CourseForm } from "@/components/forms/CourseForm";
import { Button } from "@/components/ui/button";
import { useCourses, useCreateCourse, useDeleteCourse, useUpdateCourse } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSchoolYears } from "@/hooks/use-school-years";
import { useTeachers } from "@/hooks/use-teachers";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Course, CourseFormValues } from "@/types/course";

export default function CoursesPage() {
  const { data: user } = useCurrentUser();
  const { data: courses = [], isLoading } = useCourses();
  const { data: schoolYears = [] } = useSchoolYears();
  const { data: teachers = [] } = useTeachers();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const canManageCourses = user?.role === "ADMIN";

  const openCreateForm = useCallback(() => {
    setEditingCourse(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((course: Course) => {
    setEditingCourse(course);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingCourse(null);
    setIsFormOpen(false);
  }, []);

  const handleDelete = useCallback(
    async (course: Course) => {
      const confirmed = window.confirm(`¿Deseas eliminar el curso ${course.name}?`);
      if (!confirmed) return;

      try {
        await deleteCourse.mutateAsync(course.id);
        toast.success("Curso eliminado.");
      } catch (error) {
        showError(error);
      }
    },
    [deleteCourse],
  );

  const columns = useMemo<ColumnDef<Course>[]>(
    () => [
      {
        header: "Curso",
        accessorKey: "name",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-institutional-gray-dark">{row.original.name}</div>
            <div className="text-sm text-institutional-gray">
              {row.original.schoolYear?.name ?? "Sin año escolar"}
            </div>
          </div>
        ),
      },
      { header: "Grado", accessorKey: "grade" },
      {
        header: "Sección",
        accessorKey: "section",
        cell: ({ row }) => row.original.section || "No registrada",
      },
      {
        header: "Área",
        accessorKey: "area",
        cell: ({ row }) => row.original.area || "No registrada",
      },
      {
        header: "Modalidad",
        accessorKey: "modality",
        cell: ({ row }) => row.original.modality || "No registrada",
      },
      {
        header: "Maestro titular",
        accessorKey: "titular",
        cell: ({ row }) =>
          row.original.titular ? (
            row.original.titular.name
          ) : (
            <span className="status-badge status-completiva">Sin titular</span>
          ),
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const course = row.original;

          return (
            <div className="flex flex-wrap gap-2">
              {canManageCourses ? (
                <Button size="sm" variant="outline" onClick={() => openEditForm(course)}>
                  <Pencil aria-hidden="true" />
                  Editar
                </Button>
              ) : null}
              <ActionLink href={`/courses/${course.id}/students`}>
                <UsersRound aria-hidden="true" />
                Estudiantes
              </ActionLink>
              <ActionLink href={`/reports?courseId=${course.id}`}>
                <FileDown aria-hidden="true" />
                Boletines
              </ActionLink>
              {canManageCourses ? (
                <Button size="sm" variant="outline" onClick={() => handleDelete(course)}>
                  Eliminar
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canManageCourses, handleDelete, openEditForm],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: courses,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: CourseFormValues) {
    try {
      if (editingCourse) {
        await updateCourse.mutateAsync({ id: editingCourse.id, values });
        toast.success("Curso actualizado.");
      } else {
        const schoolId = user?.school?.id ?? user?.schoolId;
        if (!schoolId) {
          toast.error("El usuario no tiene una escuela asignada.");
          return;
        }

        await createCourse.mutateAsync({ ...values, schoolId });
        toast.success("Curso creado.");
      }
      closeForm();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="institutional-title">Cursos</h1>
          <p className="institutional-subtitle">
            Gestiona cursos, secciones y maestro titular.
          </p>
        </div>
        {canManageCourses ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear curso
          </Button>
        ) : null}
      </div>

      {!canManageCourses ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar cursos.
          </p>
        </div>
      ) : null}

      {isFormOpen ? (
        <CourseForm
          course={editingCourse}
          schoolYears={schoolYears}
          teachers={teachers}
          isSubmitting={createCourse.isPending || updateCourse.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando cursos...
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <GraduationCap className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay cursos registrados
            </p>
            <p className="text-base text-institutional-gray">
              Crea el primer curso para comenzar.
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
                        className={header.column.id === "actions" ? "w-96" : undefined}
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
    </section>
  );
}

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "No se pudo completar la acción.");
}

function ActionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-institutional-gray-dark transition-colors hover:bg-muted hover:text-foreground",
        "[&_svg]:h-4 [&_svg]:w-4",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
