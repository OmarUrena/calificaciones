"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { TechnicalLearningOutcomeForm } from "@/components/forms/TechnicalLearningOutcomeForm";
import { TechnicalOutcomeWeight } from "@/components/subjects/TechnicalOutcomeWeight";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSubjects } from "@/hooks/use-subjects";
import {
  useCreateTechnicalLearningOutcome,
  useDeactivateTechnicalLearningOutcome,
  useSaveTechnicalLearningOutcomeConfiguration,
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

type OutcomesTableMeta = {
  disableWeights: boolean;
  disableActions: boolean;
};

export default function TechnicalLearningOutcomesPage() {
  const params = useParams<{ id: string }>();
  return (
    <TechnicalLearningOutcomesConfiguration
      key={params.id}
      subjectId={params.id}
    />
  );
}

function TechnicalLearningOutcomesConfiguration({
  subjectId,
}: {
  subjectId: string;
}) {
  const { data: user } = useCurrentUser();
  const { data: subjects = EMPTY_SUBJECTS } = useSubjects();
  const {
    data: outcomes = EMPTY_OUTCOMES,
    isLoading,
    isSuccess,
    isError,
  } = useTechnicalLearningOutcomes(subjectId);
  const createOutcome = useCreateTechnicalLearningOutcome();
  const updateOutcome = useUpdateTechnicalLearningOutcome();
  const deactivateOutcome = useDeactivateTechnicalLearningOutcome();
  const { mutateAsync: deactivateOutcomeAsync } = deactivateOutcome;
  const { mutateAsync: updateOutcomeAsync } = updateOutcome;
  const saveConfiguration =
    useSaveTechnicalLearningOutcomeConfiguration(subjectId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOutcome, setEditingOutcome] =
    useState<TechnicalLearningOutcome | null>(null);
  const [draftOutcomes, setDraftOutcomes] = useState<
    TechnicalLearningOutcome[]
  >([]);
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");

  const isSaving =
    createOutcome.isPending ||
    updateOutcome.isPending ||
    deactivateOutcome.isPending ||
    saveConfiguration.isPending;
  const hasUnsavedChanges =
    draftOutcomes.length > 0 || Object.keys(draftWeights).length > 0;
  const displayedOutcomes = useMemo(
    () =>
      (outcomes.length > 0 ? outcomes : draftOutcomes).map((outcome) => ({
        ...outcome,
        weight: draftWeights[outcome.id] ?? outcome.weight,
      })),
    [outcomes, draftOutcomes, draftWeights],
  );

  const handleWeightChange = useCallback((id: string, weight: string) => {
    setDraftWeights((current) => ({ ...current, [id]: weight }));
    setSaveError("");
  }, []);

  const canManageOutcomes = user?.role === "ADMIN";
  const subject = useMemo(
    () => subjects.find((item) => item.id === subjectId),
    [subjectId, subjects],
  );

  const activeOutcomes = useMemo(
    () => displayedOutcomes.filter((outcome) => outcome.isActive),
    [displayedOutcomes],
  );

  const totalWeight = useMemo(
    () =>
      activeOutcomes.reduce(
        (sum, outcome) => sum + Math.round(Number(outcome.weight) * 100),
        0,
      ) / 100,
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
      if (outcome.id.startsWith("draft-")) {
        setDraftOutcomes((current) =>
          current.map((item) =>
            item.id === outcome.id
              ? { ...item, isActive: !item.isActive }
              : item,
          ),
        );
        return;
      }
      const action = outcome.isActive ? "desactivar" : "activar";
      const confirmed = window.confirm(
        `Deseas ${action} el RA ${outcome.code}?`,
      );
      if (!confirmed) return;

      try {
        if (outcome.isActive) {
          await deactivateOutcomeAsync(outcome.id);
          toast.success("RA desactivado.");
        } else {
          await updateOutcomeAsync({
            id: outcome.id,
            values: { isActive: true },
          });
          toast.success("RA activado.");
        }
      } catch (error) {
        showError(error);
      }
    },
    [deactivateOutcomeAsync, updateOutcomeAsync],
  );

  const columns = useMemo<ColumnDef<TechnicalLearningOutcome>[]>(
    () => [
      {
        header: "Orden",
        accessorKey: "order",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">
            {row.original.order}
          </span>
        ),
      },
      {
        header: "Codigo",
        accessorKey: "code",
        cell: ({ row }) => (
          <span className="font-semibold text-institutional-gray-dark">
            {row.original.code}
          </span>
        ),
      },
      {
        header: "Nombre",
        accessorKey: "name",
      },
      {
        header: "Peso",
        accessorKey: "weight",
        cell: ({ row, table }) =>
          canManageOutcomes ? (
            <TechnicalOutcomeWeight
              outcome={row.original}
              value={String(row.original.weight)}
              disabled={
                (table.options.meta as OutcomesTableMeta).disableWeights
              }
              onChange={handleWeightChange}
            />
          ) : (
            formatWeight(row.original.weight)
          ),
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
        cell: ({ row, table }) => {
          const outcome = row.original;

          return canManageOutcomes ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  (table.options.meta as OutcomesTableMeta).disableActions
                }
                size="sm"
                variant="outline"
                onClick={() => openEditForm(outcome)}
              >
                <Pencil aria-hidden="true" />
                Editar
              </Button>
              <Button
                disabled={
                  (table.options.meta as OutcomesTableMeta).disableActions
                }
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
    [canManageOutcomes, handleToggleActive, openEditForm, handleWeightChange],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: displayedOutcomes,
    columns,
    getRowId: (outcome) => outcome.id,
    meta: {
      disableWeights: isSaving || isFormOpen,
      disableActions:
        isSaving || isFormOpen || (outcomes.length > 0 && hasUnsavedChanges),
    } satisfies OutcomesTableMeta,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: TechnicalLearningOutcomeFormValues) {
    try {
      if (draftOutcomes.length > 0 && outcomes.length === 0) {
        if (
          displayedOutcomes.some(
            (outcome) =>
              outcome.id !== editingOutcome?.id &&
              (outcome.code === values.code || outcome.order === values.order),
          )
        ) {
          toast.error(
            "El código y el orden deben ser únicos dentro del módulo.",
          );
          return;
        }
        const id = editingOutcome?.id ?? `draft-${crypto.randomUUID()}`;
        setDraftOutcomes((current) =>
          [
            ...current.filter((outcome) => outcome.id !== id),
            {
              ...values,
              id,
              subjectId,
              schoolId: user?.school?.id ?? user?.schoolId ?? "",
            },
          ].sort((left, right) => left.order - right.order),
        );
        setDraftWeights((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setSaveError("");
        closeForm();
        return;
      }
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

  function changeDraftCount(value: string) {
    const count = value === "" ? 0 : Number(value);
    if (!Number.isSafeInteger(count) || count < 0 || outcomes.length > 0)
      return;
    const next = draftOutcomes.slice(0, count);
    let order = Math.max(0, ...next.map((outcome) => outcome.order)) + 1;
    while (next.length < count) {
      while (next.some((outcome) => outcome.code === `RA${order}`)) order += 1;
      next.push({
        id: `draft-${crypto.randomUUID()}`,
        schoolId: user?.school?.id ?? user?.schoolId ?? "",
        subjectId,
        code: `RA${order}`,
        name: `RA${order}`,
        order,
        weight: 0,
        isActive: true,
      });
      order += 1;
    }
    setDraftOutcomes(next);
    setDraftWeights((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) =>
          next.some((outcome) => outcome.id === id),
        ),
      ),
    );
    setSaveError("");
  }

  async function handleSaveConfiguration() {
    setSaveError("");
    const invalidWeight = displayedOutcomes.some((outcome) => {
      const value = Number(outcome.weight);
      return (
        String(outcome.weight).trim() === "" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
      );
    });
    if (invalidWeight) {
      setSaveError(
        "Cada peso debe estar entre 0 y 100 y tener como máximo dos decimales.",
      );
      return;
    }
    if (totalWeight > 100) {
      setSaveError("La suma de pesos activos no puede superar 100.");
      return;
    }

    try {
      if (outcomes.length === 0) {
        const schoolId = user?.school?.id ?? user?.schoolId;
        if (!schoolId) {
          setSaveError("El usuario no tiene una escuela asignada.");
          return;
        }
        await saveConfiguration.mutateAsync({
          newOutcomes: displayedOutcomes.map((outcome) => ({
            schoolId,
            subjectId,
            code: outcome.code,
            name: outcome.name,
            order: outcome.order,
            weight: Number(outcome.weight),
            isActive: outcome.isActive,
          })),
        });
      } else {
        await saveConfiguration.mutateAsync({
          weights: displayedOutcomes
            .filter((outcome) => Object.hasOwn(draftWeights, outcome.id))
            .map((outcome) => ({
              id: outcome.id,
              weight: Number(outcome.weight),
            })),
        });
      }
      setDraftOutcomes([]);
      setDraftWeights({});
      toast.success("Configuración de RA guardada.");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración.",
      );
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
            Configura los resultados de aprendizaje de{" "}
            {subject?.name ?? "la asignatura tecnica"}.
          </p>
        </div>
        {canManageOutcomes ? (
          <Button
            disabled={isSaving || (outcomes.length > 0 && hasUnsavedChanges)}
            onClick={openCreateForm}
          >
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

      {canManageOutcomes ? (
        <div className="admin-card space-y-4">
          <label className="form-field max-w-xs" htmlFor="outcome-count">
            <span className="form-label">Cantidad de RA del módulo</span>
            <input
              id="outcome-count"
              className="form-control"
              type="number"
              min="0"
              step="1"
              value={
                outcomes.length > 0 ? outcomes.length : draftOutcomes.length
              }
              readOnly={outcomes.length > 0}
              disabled={!isSuccess || isSaving || isFormOpen}
              aria-describedby="outcome-count-help"
              onChange={(event) => changeDraftCount(event.target.value)}
            />
          </label>
          <p
            id="outcome-count-help"
            className="text-sm text-institutional-gray"
          >
            {outcomes.length > 0
              ? "Para añadir o desactivar RA, utiliza las acciones individuales. Modifica los pesos en la tabla y pulsa Guardar cambios."
              : "Ajusta la cantidad para preparar RA con peso 0. Puedes añadir o quitar filas antes de guardar."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={
                !hasUnsavedChanges || isSaving || isFormOpen || !isSuccess
              }
              onClick={() => void handleSaveConfiguration()}
            >
              {saveConfiguration.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
            {hasUnsavedChanges ? (
              <Button
                variant="outline"
                disabled={isSaving || isFormOpen}
                onClick={() => {
                  setDraftOutcomes([]);
                  setDraftWeights({});
                  setSaveError("");
                }}
              >
                Descartar cambios
              </Button>
            ) : null}
            <span className="text-sm text-institutional-gray" role="status">
              {hasUnsavedChanges ? "Cambios sin guardar" : ""}
            </span>
          </div>
          {saveError ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="admin-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-institutional-gray">
              Total de pesos activos
            </p>
            <p className="text-3xl font-semibold text-primary">
              {formatWeight(totalWeight)} / 100
            </p>
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
            La suma de pesos activos debe ser 100 antes de registrar
            calificaciones tecnicas.
          </p>
        ) : null}
      </div>

      {isFormOpen ? (
        <TechnicalLearningOutcomeForm
          learningOutcome={editingOutcome}
          isSubmitting={isSaving}
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
        ) : isError ? (
          <p className="p-6 text-base text-destructive" role="alert">
            No se pudieron cargar los RA. Vuelve a intentar.
          </p>
        ) : displayedOutcomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ClipboardList
              className="mb-3 h-10 w-10 text-institutional-gray"
              aria-hidden="true"
            />
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
                        className={
                          header.column.id === "actions" ? "w-72" : undefined
                        }
                        key={header.id}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
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
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
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
  toast.error(
    error instanceof ApiError
      ? error.message
      : "No se pudo completar la accion.",
  );
}
