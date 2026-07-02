"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { Building2, Eye, Loader2, Pencil, Plus, Power } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { SchoolForm } from "@/components/forms/SchoolForm";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreateSchool,
  useDeactivateSchool,
  useSchools,
  useUpdateSchool,
} from "@/hooks/use-schools";
import type { School, SchoolFormValues } from "@/types/school";

export default function SchoolsPage() {
  const { data: user } = useCurrentUser();
  const { data: schools = [], isLoading } = useSchools();
  const createSchool = useCreateSchool();
  const updateSchool = useUpdateSchool();
  const deactivateSchool = useDeactivateSchool();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  const openCreateForm = useCallback(() => {
    setEditingSchool(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((school: School) => {
    setEditingSchool(school);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingSchool(null);
    setIsFormOpen(false);
  }, []);

  const handleDeactivate = useCallback(
    async (school: School) => {
      const action = school.isActive ? "desactivar" : "activar";
      const confirmed = window.confirm(`¿Deseas ${action} la escuela ${school.name}?`);

      if (!confirmed) return;

      try {
        if (school.isActive) {
          await deactivateSchool.mutateAsync(school.id);
        } else {
          await updateSchool.mutateAsync({
            id: school.id,
            values: { isActive: true },
          });
        }
        toast.success(`Escuela ${school.isActive ? "desactivada" : "activada"}.`);
      } catch (error) {
        showError(error);
      }
    },
    [deactivateSchool, updateSchool],
  );

  const canManageSchools = user?.role === "SUPER_ADMIN";
  const columns = useMemo<ColumnDef<School>[]>(
    () => [
      {
        header: "Escuela",
        accessorKey: "name",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-sm text-institutional-gray">
              {row.original.address || "Sin dirección"}
            </div>
          </div>
        ),
      },
      {
        header: "Código",
        accessorKey: "code",
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
        header: "Teléfono",
        accessorKey: "phone",
        cell: ({ row }) => row.original.phone || "No registrado",
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const school = row.original;

          return (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedSchool(school)}>
                <Eye aria-hidden="true" />
                Ver
              </Button>
              {canManageSchools ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => openEditForm(school)}>
                    <Pencil aria-hidden="true" />
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeactivate(school)}>
                    <Power aria-hidden="true" />
                    {school.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canManageSchools, handleDeactivate, openEditForm],
  );
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: schools,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: SchoolFormValues) {
    try {
      if (editingSchool) {
        await updateSchool.mutateAsync({ id: editingSchool.id, values });
        toast.success("Escuela actualizada.");
      } else {
        await createSchool.mutateAsync(values);
        toast.success("Escuela creada.");
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
          <h1 className="institutional-title">Escuelas</h1>
          <p className="institutional-subtitle">
            Gestiona las instituciones registradas en CalifApp.
          </p>
        </div>
        {canManageSchools ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear escuela
          </Button>
        ) : null}
      </div>

      {!canManageSchools ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo los usuarios SUPER_ADMIN pueden administrar escuelas.
          </p>
        </div>
      ) : null}

      {isFormOpen ? (
        <SchoolForm
          school={editingSchool}
          isSubmitting={createSchool.isPending || updateSchool.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando escuelas...
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Building2 className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay escuelas registradas
            </p>
            <p className="text-base text-institutional-gray">
              Crea la primera escuela para comenzar.
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
                        className={header.column.id === "actions" ? "w-72" : undefined}
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

      {selectedSchool ? (
        <SchoolDetails school={selectedSchool} onClose={() => setSelectedSchool(null)} />
      ) : null}
    </section>
  );
}

function SchoolDetails({
  school,
  onClose,
}: {
  school: School;
  onClose: () => void;
}) {
  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-institutional-gray-dark">
            {school.name}
          </h2>
          <p className="text-base text-institutional-gray">Detalle de escuela</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Detail label="Código" value={school.code} />
        <Detail label="Estado" value={school.isActive ? "Activa" : "Inactiva"} />
        <Detail label="Dirección" value={school.address || "No registrada"} />
        <Detail label="Teléfono" value={school.phone || "No registrado"} />
        <Detail label="Logo URL" value={school.logoUrl || "No registrado"} />
      </dl>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold uppercase tracking-wide text-institutional-gray">
        {label}
      </dt>
      <dd className="mt-1 break-words text-base text-institutional-gray-dark">{value}</dd>
    </div>
  );
}

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "No se pudo completar la acción.");
}
