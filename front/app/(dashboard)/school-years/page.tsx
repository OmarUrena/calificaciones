"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { CalendarDays, CheckCircle2, Loader2, Pencil, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { SchoolYearForm } from "@/components/forms/SchoolYearForm";
import { Button } from "@/components/ui/button";
import {
  useActivateSchoolYear,
  useCreateSchoolYear,
  useSchoolYears,
  useUpdateSchoolYear,
} from "@/hooks/use-school-years";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ApiError } from "@/lib/api";
import type { SchoolYear, SchoolYearFormValues } from "@/types/school-year";

export default function SchoolYearsPage() {
  const { data: user } = useCurrentUser();
  const { data: schoolYears = [], isLoading } = useSchoolYears();
  const createSchoolYear = useCreateSchoolYear();
  const updateSchoolYear = useUpdateSchoolYear();
  const activateSchoolYear = useActivateSchoolYear();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchoolYear, setEditingSchoolYear] = useState<SchoolYear | null>(null);

  const canManageSchoolYears = user?.role === "ADMIN";

  const openCreateForm = useCallback(() => {
    setEditingSchoolYear(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((schoolYear: SchoolYear) => {
    setEditingSchoolYear(schoolYear);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingSchoolYear(null);
    setIsFormOpen(false);
  }, []);

  const handleActivate = useCallback(
    async (schoolYear: SchoolYear) => {
      if (schoolYear.isActive) return;

      const confirmed = window.confirm(`¿Deseas activar el año escolar ${schoolYear.name}?`);
      if (!confirmed) return;

      try {
        await activateSchoolYear.mutateAsync(schoolYear.id);
        toast.success("Año escolar activado.");
      } catch (error) {
        showError(error);
      }
    },
    [activateSchoolYear],
  );

  const columns = useMemo<ColumnDef<SchoolYear>[]>(
    () => [
      {
        header: "Año escolar",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="font-semibold text-institutional-gray-dark">
            {row.original.name}
          </div>
        ),
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
            {row.original.isActive ? "Activo" : "Inactivo"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const schoolYear = row.original;

          return (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEditForm(schoolYear)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
              <Button
                disabled={schoolYear.isActive || activateSchoolYear.isPending}
                size="sm"
                variant="outline"
                onClick={() => handleActivate(schoolYear)}
              >
                <CheckCircle2 aria-hidden="true" />
                Activar
              </Button>
            </div>
          );
        },
      },
    ],
    [activateSchoolYear.isPending, handleActivate, openEditForm],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: schoolYears,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: SchoolYearFormValues) {
    try {
      if (editingSchoolYear) {
        await updateSchoolYear.mutateAsync({ id: editingSchoolYear.id, values });
        toast.success("Año escolar actualizado.");
      } else {
        const schoolId = getCurrentSchoolId(user);

        if (!schoolId) {
          toast.error("El usuario no tiene una escuela válida asignada.");
          return;
        }

        await createSchoolYear.mutateAsync({ ...values, schoolId });
        toast.success("Año escolar creado.");
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
          <h1 className="institutional-title">Año escolar</h1>
          <p className="institutional-subtitle">
            Crea periodos académicos y define cuál está activo para la escuela.
          </p>
        </div>
        {canManageSchoolYears ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear año escolar
          </Button>
        ) : null}
      </div>

      {!canManageSchoolYears ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar años escolares.
          </p>
        </div>
      ) : null}

      {isFormOpen ? (
        <SchoolYearForm
          schoolYear={editingSchoolYear}
          isSubmitting={createSchoolYear.isPending || updateSchoolYear.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando años escolares...
          </div>
        ) : schoolYears.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay años escolares registrados
            </p>
            <p className="text-base text-institutional-gray">
              Crea el primer periodo académico para comenzar.
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
                        className={header.column.id === "actions" ? "w-64" : undefined}
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

function getCurrentSchoolId(user: ReturnType<typeof useCurrentUser>["data"]) {
  const schoolId = user?.school?.id ?? user?.schoolId;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return schoolId && uuidPattern.test(schoolId) ? schoolId : null;
}
