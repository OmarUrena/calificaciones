"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { BookOpen, ClipboardList, Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { SubjectForm } from "@/components/forms/SubjectForm";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreateSubject,
  useDeactivateSubject,
  useSubjects,
  useUpdateSubject,
} from "@/hooks/use-subjects";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Subject, SubjectFormValues, SubjectType } from "@/types/subject";

const EMPTY_SUBJECTS: Subject[] = [];

export default function SubjectsPage() {
  const { data: user } = useCurrentUser();
  const { data: subjects = EMPTY_SUBJECTS, isLoading } = useSubjects();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deactivateSubject = useDeactivateSubject();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const canManageSubjects = user?.role === "ADMIN";

  const openCreateForm = useCallback(() => {
    setEditingSubject(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((subject: Subject) => {
    setEditingSubject(subject);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingSubject(null);
    setIsFormOpen(false);
  }, []);

  const handleToggleActive = useCallback(
    async (subject: Subject) => {
      const action = subject.isActive ? "desactivar" : "activar";
      const confirmed = window.confirm(`Deseas ${action} la asignatura ${subject.name}?`);
      if (!confirmed) return;

      try {
        if (subject.isActive) {
          await deactivateSubject.mutateAsync(subject.id);
          toast.success("Asignatura desactivada.");
        } else {
          await updateSubject.mutateAsync({ id: subject.id, values: { isActive: true } });
          toast.success("Asignatura activada.");
        }
      } catch (error) {
        showError(error);
      }
    },
    [deactivateSubject, updateSubject],
  );

  const columns = useMemo<ColumnDef<Subject>[]>(
    () => [
      {
        header: "Asignatura",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">{row.original.name}</span>
        ),
      },
      {
        header: "Tipo",
        accessorKey: "type",
        cell: ({ row }) => <SubjectTypeBadge type={row.original.type} />,
      },
      {
        header: "Estado",
        accessorKey: "isActive",
        cell: ({ row }) => (
          <span
            className={
              row.original.isActive
                ? "status-badge status-approved"
                : "status-badge status-pending"
            }
          >
            {row.original.isActive ? "Activa" : "Inactiva"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const subject = row.original;

          return (
            <div className="flex flex-wrap gap-2">
              {canManageSubjects ? (
                <Button size="sm" variant="outline" onClick={() => openEditForm(subject)}>
                  <Pencil aria-hidden="true" />
                  Editar
                </Button>
              ) : null}
              {subject.type === "TECHNICAL" ? (
                <ActionLink href={`/subjects/${subject.id}/technical-outcomes`}>
                  <ClipboardList aria-hidden="true" />
                  Configurar RA
                </ActionLink>
              ) : null}
              {canManageSubjects ? (
                <Button
                  disabled={deactivateSubject.isPending || updateSubject.isPending}
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(subject)}
                >
                  {subject.isActive ? (
                    <ToggleLeft aria-hidden="true" />
                  ) : (
                    <ToggleRight aria-hidden="true" />
                  )}
                  {subject.isActive ? "Desactivar" : "Activar"}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      canManageSubjects,
      deactivateSubject.isPending,
      handleToggleActive,
      openEditForm,
      updateSubject.isPending,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: subjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: SubjectFormValues) {
    try {
      if (editingSubject) {
        await updateSubject.mutateAsync({ id: editingSubject.id, values });
        toast.success("Asignatura actualizada.");
      } else {
        const schoolId = user?.school?.id ?? user?.schoolId;
        if (!schoolId) {
          toast.error("El usuario no tiene una escuela asignada.");
          return;
        }

        await createSubject.mutateAsync({ ...values, schoolId });
        toast.success("Asignatura creada.");
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
          <h1 className="institutional-title">Asignaturas</h1>
          <p className="institutional-subtitle">
            Gestiona asignaturas academicas y tecnicas de la escuela.
          </p>
        </div>
        {canManageSubjects ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear asignatura
          </Button>
        ) : null}
      </div>

      {!canManageSubjects ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar asignaturas.
          </p>
        </div>
      ) : null}

      {isFormOpen ? (
        <SubjectForm
          subject={editingSubject}
          isSubmitting={createSubject.isPending || updateSubject.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando asignaturas...
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay asignaturas registradas
            </p>
            <p className="text-base text-institutional-gray">
              Crea la primera asignatura para comenzar.
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

function SubjectTypeBadge({ type }: { type: SubjectType }) {
  return (
    <span className={type === "TECHNICAL" ? "status-badge status-approved" : "status-badge status-pending"}>
      {type === "TECHNICAL" ? "Tecnica" : "Academica"}
    </span>
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
