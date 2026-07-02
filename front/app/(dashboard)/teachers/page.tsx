"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { ClipboardList, Loader2, Pencil, Plus, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { TeacherForm } from "@/components/forms/TeacherForm";
import { Button } from "@/components/ui/button";
import { useCourses } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreateTeacher,
  useDeleteTeacher,
  useTeachers,
  useUpdateTeacher,
} from "@/hooks/use-teachers";
import { useUsers } from "@/hooks/use-users";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/course";
import type { Teacher, TeacherFormValues } from "@/types/teacher";
import type { User } from "@/types/user";

const EMPTY_TEACHERS: Teacher[] = [];
const EMPTY_COURSES: Course[] = [];
const EMPTY_USERS: User[] = [];

export default function TeachersPage() {
  const { data: user } = useCurrentUser();
  const { data: teachers = EMPTY_TEACHERS, isLoading } = useTeachers();
  const { data: courses = EMPTY_COURSES } = useCourses();
  const { data: users = EMPTY_USERS } = useUsers();
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const canManageTeachers = user?.role === "ADMIN";

  const usersByTeacherId = useMemo(() => {
    const map = new Map<string, User>();

    users.forEach((item) => {
      if (item.teacherId) {
        map.set(item.teacherId, item);
      }
    });

    return map;
  }, [users]);

  const coursesByTeacherId = useMemo(() => {
    const map = new Map<string, Course[]>();

    courses.forEach((course) => {
      const teacherId = course.titularId ?? course.titular?.id;
      if (!teacherId) return;

      const currentCourses = map.get(teacherId) ?? [];
      map.set(teacherId, [...currentCourses, course]);
    });

    return map;
  }, [courses]);

  const openCreateForm = useCallback(() => {
    setEditingTeacher(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((teacher: Teacher) => {
    setEditingTeacher(teacher);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingTeacher(null);
    setIsFormOpen(false);
  }, []);

  const handleDelete = useCallback(
    async (teacher: Teacher) => {
      const confirmed = window.confirm(`Deseas eliminar a ${teacher.name}?`);
      if (!confirmed) return;

      try {
        await deleteTeacher.mutateAsync(teacher.id);
        toast.success("Maestro eliminado.");
      } catch (error) {
        showError(error);
      }
    },
    [deleteTeacher],
  );

  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        header: "Nombre",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">{row.original.name}</span>
        ),
      },
      {
        header: "Usuario vinculado",
        id: "linkedUser",
        cell: ({ row }) => {
          const linkedUser = usersByTeacherId.get(row.original.id);

          return linkedUser ? (
            <div>
              <div className="font-medium text-institutional-gray-dark">{linkedUser.fullName}</div>
              <div className="text-sm text-institutional-gray">{linkedUser.email}</div>
              {!linkedUser.isActive ? (
                <span className="status-badge status-completiva mt-1">Inactivo</span>
              ) : null}
            </div>
          ) : (
            <span className="status-badge status-completiva">Sin usuario</span>
          );
        },
      },
      {
        header: "Cursos titulares",
        id: "titularCourses",
        cell: ({ row }) => {
          const titularCourses = coursesByTeacherId.get(row.original.id) ?? [];

          return titularCourses.length > 0 ? (
            <div className="flex max-w-xl flex-wrap gap-2">
              {titularCourses.map((course) => (
                <span className="status-badge status-promovido" key={course.id}>
                  {course.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-institutional-gray">Ninguno</span>
          );
        },
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const teacher = row.original;
          const linkedUser = usersByTeacherId.get(teacher.id);

          return (
            <div className="flex flex-wrap gap-2">
              {canManageTeachers ? (
                <Button size="sm" variant="outline" onClick={() => openEditForm(teacher)}>
                  <Pencil aria-hidden="true" />
                  Editar
                </Button>
              ) : null}
              {!linkedUser ? (
                <ActionLink href={`/users?teacherId=${teacher.id}`}>
                  <UserRoundCheck aria-hidden="true" />
                  Vincular usuario
                </ActionLink>
              ) : null}
              <ActionLink href={`/assignments?teacherId=${teacher.id}`}>
                <ClipboardList aria-hidden="true" />
                Asignaciones
              </ActionLink>
              {canManageTeachers ? (
                <Button size="sm" variant="outline" onClick={() => handleDelete(teacher)}>
                  Eliminar
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canManageTeachers, coursesByTeacherId, handleDelete, openEditForm, usersByTeacherId],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: teachers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: TeacherFormValues) {
    try {
      if (editingTeacher) {
        await updateTeacher.mutateAsync({ id: editingTeacher.id, values });
        toast.success("Maestro actualizado.");
      } else {
        const schoolId = user?.school?.id ?? user?.schoolId;
        if (!schoolId) {
          toast.error("El usuario no tiene una escuela asignada.");
          return;
        }

        await createTeacher.mutateAsync({ ...values, schoolId });
        toast.success("Maestro creado.");
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
          <h1 className="institutional-title">Maestros</h1>
          <p className="institutional-subtitle">
            Gestiona docentes, usuarios vinculados y cursos titulares.
          </p>
        </div>
        {canManageTeachers ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear maestro
          </Button>
        ) : null}
      </div>

      {!canManageTeachers ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar maestros.
          </p>
        </div>
      ) : null}

      {isFormOpen ? (
        <TeacherForm
          teacher={editingTeacher}
          isSubmitting={createTeacher.isPending || updateTeacher.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando maestros...
          </div>
        ) : teachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <UsersRound className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay maestros registrados
            </p>
            <p className="text-base text-institutional-gray">
              Crea el primer maestro para comenzar.
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

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "No se pudo completar la accion.");
}
