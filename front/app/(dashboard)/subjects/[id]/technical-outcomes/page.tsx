"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeft, ClipboardList, Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { TechnicalLearningOutcomeForm } from "@/components/forms/TechnicalLearningOutcomeForm";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSubjects } from "@/hooks/use-subjects";
import {
  useCreateTechnicalLearningOutcome,
  useDeactivateTechnicalLearningOutcome,
  useTechnicalLearningOutcomes,
  useUpdateTechnicalLearningOutcome,
} from "@/hooks/use-technical-learning-outcomes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/subject";
import type {
  TechnicalLearningOutcome,
  TechnicalLearningOutcomeFormValues,
} from "@/types/technical-learning-outcome";

const EMPTY_OUTCOMES: TechnicalLearningOutcome[] = [];
const EMPTY_SUBJECTS: Subject[] = [];

export default function TechnicalLearningOutcomesPage() {
  const params = useParams<{ id: string }>();
  const subjectId = params.id;
  const { data: user } = useCurrentUser();
  const { data: subjects = EMPTY_SUBJECTS } = useSubjects();
  const { data: outcomes = EMPTY_OUTCOMES, isLoading } = useTechnicalLearningOutcomes(subjectId);
  const createOutcome = useCreateTechnicalLearningOutcome();
  const updateOutcome = useUpdateTechnicalLearningOutcome();
  const deactivateOutcome = useDeactivateTechnicalLearningOutcome();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<TechnicalLearningOutcome | null>(null);

  const canManageOutcomes = user?.role === "ADMIN";
  const subject = useMemo(
    () => subjects.find((item) => item.id === subjectId),
    [subjectId, subjects],
  );

  const activeOutcomes = useMemo(
    () => outcomes.filter((outcome) => outcome.isActive),
    [outcomes],
  );

  const totalWeight = useMemo(
    () => activeOutcomes.reduce((sum, outcome) => sum + Number(outcome.weight), 0),
    [activeOutcomes],
  );

  const openCreateForm = useCallback(() => {
    setEditingOutcome(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((outcome: TechnicalLearningOutcome) => {
    setEditingOutcome(outcome);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingOutcome(null);
    setIsFormOpen(false);
  }, []);

  const handleToggleActive = useCallback(
    async (outcome: TechnicalLearningOutcome) => {
      const action = outcome.isActive ? "desactivar" : "activar";
      const confirmed = window.confirm(`Deseas ${action} el RA ${outcome.code}?`);
      if (!confirmed) return;

      try {
        if (outcome.isActive) {
          await deactivateOutcome.mutateAsync(outcome.id);
          toast.success("RA desactivado.");
        } else {
          await updateOutcome.mutateAsync({ id: outcome.id, values: { isActive: true } });
          toast.success("RA activado.");
        }
      } catch (error) {
        showError(error);
      }
    },
    [deactivateOutcome, updateOutcome],
  );

  const columns = useMemo<ColumnDef<TechnicalLearningOutcome>[]>(
    () => [
      {
        header: "Orden",
        accessorKey: "order",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">{row.original.order}</span>
        ),
      },
      {
        header: "Codigo",
        accessorKey: "code",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">{row.original.code}</span>
        ),
      },
      {
        header: "Nombre",
        accessorKey: "name",
      },
      {
        header: "Peso",
        accessorKey: "weight",
        cell: ({ row }) => formatWeight(row.original.weight),
      },
      {
        header: "Minimo 70%",
        id: "minimum",
        cell: ({ row }) => formatWeight(Number(row.original.weight) * 0.7),
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
          const outcome = row.original;

          return canManageOutcomes ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEditForm(outcome)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
              <Button
                disabled={deactivateOutcome.isPending || updateOutcome.isPending}
                size="sm"
                variant="outline"
                onClick={() => handleToggleActive(outcome)}
              >
                {outcome.isActive ? (
                  <ToggleLeft aria-hidden="true" />
                ) : (
                  <ToggleRight aria-hidden="true" />
                )}
                {outcome.isActive ? "Desactivar" : "Activar"}
              </Button>
            </div>
          ) : null;
        },
      },
    ],
    [
      canManageOutcomes,
      deactivateOutcome.isPending,
      handleToggleActive,
      openEditForm,
      updateOutcome.isPending,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: outcomes,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: TechnicalLearningOutcomeFormValues) {
    try {
      if (editingOutcome) {
        await updateOutcome.mutateAsync({ id: editingOutcome.id, values });
        toast.success("RA actualizado.");
      } else {
        const schoolId = user?.school?.id ?? user?.schoolId;
        if (!schoolId) {
          toast.error("El usuario no tiene una escuela asignada.");
          return;
        }

        await createOutcome.mutateAsync({ ...values, schoolId, subjectId });
        toast.success("RA creado.");
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
          <ActionLink href="/subjects">
            <ArrowLeft aria-hidden="true" />
            Volver a asignaturas
          </ActionLink>
          <h1 className="institutional-title mt-4">RA tecnicos</h1>
          <p className="institutional-subtitle">
            Configura los resultados de aprendizaje de {subject?.name ?? "la asignatura tecnica"}.
          </p>
        </div>
        {canManageOutcomes ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear RA
          </Button>
        ) : null}
      </div>

      {!canManageOutcomes ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar RA tecnicos.
          </p>
        </div>
      ) : null}

      <div className="admin-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-institutional-gray">
              Total de pesos activos
            </p>
            <p className="text-3xl font-semibold text-primary">{formatWeight(totalWeight)} / 100</p>
          </div>
          <span
            className={
              totalWeight === 100
                ? "status-badge status-approved"
                : "status-badge status-completiva"
            }
          >
            {totalWeight === 100 ? "Completo" : "Revisar pesos"}
          </span>
        </div>
        {totalWeight !== 100 ? (
          <p className="mt-3 text-base text-institutional-gray-dark">
            La suma de pesos activos debe ser 100 antes de registrar calificaciones tecnicas.
          </p>
        ) : null}
      </div>

      {isFormOpen ? (
        <TechnicalLearningOutcomeForm
          learningOutcome={editingOutcome}
          isSubmitting={createOutcome.isPending || updateOutcome.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando RA tecnicos...
          </div>
        ) : outcomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay RA registrados
            </p>
            <p className="text-base text-institutional-gray">
              Crea los resultados de aprendizaje del modulo tecnico.
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
    </section>
  );
}

function formatWeight(value: number | string) {
  return Number(value).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
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
