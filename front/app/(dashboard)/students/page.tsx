"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2, Pencil, Plus, Upload, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { StudentForm } from "@/components/forms/StudentForm";
import { Button } from "@/components/ui/button";
import { useCourses } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreateStudent, useDeleteStudent, useStudents, useUpdateStudent } from "@/hooks/use-students";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/course";
import type { Student, StudentFormValues } from "@/types/student";

const EMPTY_STUDENTS: Student[] = [];
const EMPTY_COURSES: Course[] = [];

export default function StudentsPage() {
  const { data: user } = useCurrentUser();
  const { data: students = EMPTY_STUDENTS, isLoading } = useStudents();
  const { data: courses = EMPTY_COURSES } = useCourses();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const canManageStudents = user?.role === "ADMIN";
  const filteredStudents = useMemo(
    () =>
      selectedCourseId
        ? students.filter((student) => student.courseId === selectedCourseId)
        : students,
    [selectedCourseId, students],
  );

  const openCreateForm = useCallback(() => {
    setEditingStudent(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingStudent(null);
    setIsFormOpen(false);
  }, []);

  const handleDelete = useCallback(
    async (student: Student) => {
      const confirmed = window.confirm(
        `¿Deseas eliminar a ${student.firstName} ${student.lastName}?`,
      );
      if (!confirmed) return;

      try {
        await deleteStudent.mutateAsync(student.id);
        toast.success("Estudiante eliminado.");
      } catch (error) {
        showError(error);
      }
    },
    [deleteStudent],
  );

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        header: "No.",
        accessorKey: "listNumber",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">
            {row.original.listNumber}
          </span>
        ),
      },
      {
        header: "Nombres",
        accessorKey: "firstName",
      },
      {
        header: "Apellidos",
        accessorKey: "lastName",
      },
      {
        header: "Curso",
        accessorKey: "course",
        cell: ({ row }) => row.original.course?.name ?? "Sin curso",
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const student = row.original;

          return canManageStudents ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEditForm(student)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(student)}>
                Eliminar
              </Button>
            </div>
          ) : null;
        },
      },
    ],
    [canManageStudents, handleDelete, openEditForm],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredStudents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: StudentFormValues) {
    const course = courses.find((item) => item.id === values.courseId);

    if (!course) {
      toast.error("Selecciona un curso válido.");
      return;
    }

    try {
      if (editingStudent) {
        await updateStudent.mutateAsync({
          id: editingStudent.id,
          values: {
            ...values,
            schoolYearId: course.schoolYearId,
          },
        });
        toast.success("Estudiante actualizado.");
      } else {
        const schoolId = user?.school?.id ?? user?.schoolId;

        if (!schoolId) {
          toast.error("El usuario no tiene una escuela asignada.");
          return;
        }

        await createStudent.mutateAsync({
          ...values,
          schoolId,
          schoolYearId: course.schoolYearId,
        });
        toast.success("Estudiante creado.");
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
          <h1 className="institutional-title">Estudiantes</h1>
          <p className="institutional-subtitle">
            Gestiona estudiantes por curso y número de lista.
          </p>
        </div>
        {canManageStudents ? (
          <div className="flex flex-wrap gap-3">
            <ActionLink href="/imports">
              <Upload aria-hidden="true" />
              Importar estudiantes
            </ActionLink>
            <Button onClick={openCreateForm}>
              <Plus aria-hidden="true" />
              Crear estudiante
            </Button>
          </div>
        ) : null}
      </div>

      {!canManageStudents ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar estudiantes.
          </p>
        </div>
      ) : null}

      <div className="admin-card">
        <label className="form-field block max-w-xl">
          <span className="form-label">Filtrar por curso</span>
          <select
            className="form-control"
            value={selectedCourseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
          >
            <option value="">Todos los cursos</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isFormOpen ? (
        <StudentForm
          student={editingStudent}
          courses={courses}
          selectedCourseId={selectedCourseId}
          isSubmitting={createStudent.isPending || updateStudent.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando estudiantes...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <UsersRound className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay estudiantes registrados
            </p>
            <p className="text-base text-institutional-gray">
              Crea o importa estudiantes para comenzar.
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
                        className={header.column.id === "actions" ? "w-48" : undefined}
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3.5 text-base font-medium text-institutional-gray-dark transition-colors hover:bg-muted hover:text-foreground",
        "[&_svg]:h-4 [&_svg]:w-4",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "No se pudo completar la acción.");
}
