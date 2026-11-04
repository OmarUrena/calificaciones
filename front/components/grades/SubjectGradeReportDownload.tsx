"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadSubjectGradesReport } from "@/hooks/use-reports";
import type { TeacherAssignment } from "@/types/assignment";

export function SubjectGradeReportDownload({ assignment }: { assignment: TeacherAssignment }) {
  const selectId = useId();
  const [period, setPeriod] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const downloading = useRef(false);
  const academic = assignment.subject?.type === "ACADEMIC";

  async function download() {
    if (downloading.current) return;
    downloading.current = true;
    setPending(true);
    setError(null);
    try {
      await downloadSubjectGradesReport(assignment.id, academic ? period : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      downloading.current = false;
      setPending(false);
    }
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {academic ? (
          <>
            <label className="text-sm text-institutional-gray" htmlFor={selectId}>Período del PDF</label>
            <select
              aria-label={`Período PDF de ${assignment.subject?.name} (${assignment.course?.name})`}
              className="form-control w-auto text-sm"
              disabled={pending}
              id={selectId}
              onChange={(event) => setPeriod(Number(event.target.value))}
              value={period}
            >
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>P{value}</option>)}
            </select>
          </>
        ) : <span className="text-sm text-institutional-gray">Registro completo por RA</span>}
        <Button disabled={pending} onClick={() => void download()} size="sm" type="button" variant="outline">
          {pending ? "Generando PDF..." : "Descargar PDF"}
        </Button>
      </div>
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
    </div>
  );
}
