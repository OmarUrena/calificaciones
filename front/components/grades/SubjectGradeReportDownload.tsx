"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadSubjectGradesReport } from "@/hooks/use-reports";
import { apiFetch } from "@/lib/api";
import type { TeacherAssignment } from "@/types/assignment";
import type { TechnicalLearningOutcome } from "@/types/technical-learning-outcome";

export function SubjectGradeReportDownload({ assignment }: { assignment: TeacherAssignment }) {
  const [open, setOpen] = useState(false);
  const [periods, setPeriods] = useState<number[]>([]);
  const [outcomeIds, setOutcomeIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const downloading = useRef(false);
  const academic = assignment.subject?.type === "ACADEMIC";
  const options = useQuery({
    queryKey: ["subject-report-options", assignment.id],
    queryFn: () => apiFetch<{ outcomes: TechnicalLearningOutcome[] }>(`/reports/assignments/${assignment.id}/grade-options`),
    enabled: open && !academic,
    retry: false,
  });
  const outcomes = options.data?.outcomes ?? [];
  const selectedOutcomes = outcomeIds.filter((id) => outcomes.some((outcome) => outcome.id === id));
  const count = academic ? periods.length : selectedOutcomes.length;
  const choicesReady = academic || (!options.isPending && !options.isError);

  async function download() {
    if (downloading.current || !count || !choicesReady) return;
    downloading.current = true;
    setPending(true);
    setError(null);
    try {
      await downloadSubjectGradesReport(assignment.id, academic
        ? { periods: [...periods].sort((a, b) => a - b) }
        : { outcomeIds: selectedOutcomes });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      downloading.current = false;
      setPending(false);
    }
  }

  return (
    <details className="w-full rounded-md border border-border bg-background" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        PDF de calificaciones
      </summary>
      <section aria-label={`PDF de ${assignment.subject?.name} (${assignment.course?.name})`} className="space-y-3 border-t border-border p-3">
        <p className="text-xs text-institutional-gray">Formato vertical. Marca {academic ? "los períodos" : "los RA"} que deseas incluir.</p>
        {!academic && options.isPending ? <div className="h-8 animate-pulse rounded bg-muted" role="status" aria-label="Cargando RA" /> : null}
        {!academic && options.isError ? (
          <div className="space-y-2" role="alert">
            <p className="text-xs text-red-800">No se pudieron cargar los RA.</p>
            <Button onClick={() => void options.refetch()} size="sm" type="button" variant="outline">Reintentar</Button>
          </div>
        ) : null}
        {choicesReady ? (
          <>
            <fieldset className="space-y-2" disabled={pending}>
              <legend className="mb-2 text-sm font-medium">{academic ? "Períodos a incluir" : "RA a incluir"}</legend>
              <div className="flex flex-wrap gap-2">
                {academic ? [1, 2, 3, 4].map((period) => (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-1 text-xs" key={period}>
                    <input checked={periods.includes(period)} className="h-4 w-4 accent-primary" type="checkbox"
                      onChange={(event) => setPeriods((current) => event.target.checked ? [...current, period] : current.filter((value) => value !== period))} />
                    P{period}
                  </label>
                )) : outcomes.map((outcome) => (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-1 text-xs" key={outcome.id} title={outcome.name}>
                    <input checked={selectedOutcomes.includes(outcome.id)} className="h-4 w-4 accent-primary" type="checkbox"
                      onChange={(event) => setOutcomeIds((current) => event.target.checked ? [...current, outcome.id] : current.filter((id) => id !== outcome.id))} />
                    {outcome.code}{outcome.isActive ? "" : " (histórico)"}
                  </label>
                ))}
              </div>
              {!academic && !outcomes.length ? <p className="text-xs text-institutional-gray">No hay RA disponibles para esta asignatura.</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!academic && !outcomes.length} onClick={() => academic ? setPeriods([1, 2, 3, 4]) : setOutcomeIds(outcomes.map((outcome) => outcome.id))} size="sm" type="button" variant="ghost">Marcar todos</Button>
                <Button disabled={!count} onClick={() => { setPeriods([]); setOutcomeIds([]); }} size="sm" type="button" variant="ghost">Limpiar selección</Button>
              </div>
            </fieldset>
            <p className="text-xs text-institutional-gray" role="status">{count
              ? `${count} ${academic ? count === 1 ? "período seleccionado" : "períodos seleccionados" : count === 1 ? "RA seleccionado" : "RA seleccionados"}`
              : "Marca al menos una casilla para generar el PDF."}</p>
          </>
        ) : null}
        <Button disabled={pending || !count || !choicesReady} onClick={() => void download()} size="sm" type="button" variant="outline">
          {pending ? "Generando PDF..." : "Generar PDF seleccionado"}
        </Button>
        {error ? <p className="text-xs text-red-800" role="alert">{error}</p> : null}
      </section>
    </details>
  );
}
