import { AlertTriangle } from "lucide-react";

import { parseGradeInput } from "@/lib/academic-grades";
import {
  formatTechnicalScore,
  getTechnicalMinimum,
  getTechnicalValidScore,
  validateTechnicalScores,
} from "@/lib/technical-grades";
import { cn } from "@/lib/utils";
import type { TechnicalScoreField, TechnicalScoreValues } from "@/types/grades";
import type { Student } from "@/types/student";

const SCORE_COLUMNS: Array<{ field: TechnicalScoreField; label: string }> = [
  { field: "ordinaryScore", label: "Ordinaria" },
  { field: "recovery1Score", label: "Recuperación 1" },
  { field: "recovery2Score", label: "Recuperación 2" },
  { field: "specialScore", label: "Especial" },
];

export function TechnicalGradeTable({
  students,
  scoresByStudent,
  weight,
  specialAllowedByStudent,
  dirtyStudentIds,
  onScoreChange,
}: {
  students: Student[];
  scoresByStudent: Record<string, TechnicalScoreValues>;
  weight: number;
  specialAllowedByStudent: Record<string, boolean>;
  dirtyStudentIds: Set<string>;
  onScoreChange: (studentId: string, field: TechnicalScoreField, value: number | null) => void;
}) {
  const minimum = getTechnicalMinimum(weight);
  const invalidRows = students.filter((student) => {
    const errors = validateTechnicalScores(
      scoresByStudent[student.id],
      weight,
      specialAllowedByStudent[student.id],
    );
    return Object.keys(errors).length > 0;
  });

  if (students.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium text-institutional-gray-dark">
          No hay estudiantes en este curso
        </p>
        <p className="text-base text-institutional-gray">
          Agrega estudiantes antes de registrar calificaciones.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border bg-institutional-blue-light/40 px-4 py-3 text-sm text-institutional-gray-dark">
        Peso del RA: <strong>{formatTechnicalScore(weight)}</strong> · Mínimo aprobatorio:{" "}
        <strong>{formatTechnicalScore(minimum)}</strong>
      </div>
      <div className="overflow-x-auto">
        <table className="compact-table min-w-[1050px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-16 min-w-16">No.</th>
              <th className="sticky left-16 z-20 min-w-64">Estudiante</th>
              {SCORE_COLUMNS.map((column) => (
                <th className="min-w-32 text-center" key={column.field}>
                  {column.label}
                </th>
              ))}
              <th className="min-w-28 text-center">Nota válida</th>
              <th className="min-w-32 text-center">Estado RA</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const scores = scoresByStudent[student.id];
              const specialAllowed = specialAllowedByStudent[student.id];
              const errors = validateTechnicalScores(scores, weight, specialAllowed);
              const validScore = getTechnicalValidScore(scores);

              return (
                <tr key={student.id}>
                  <td className="sticky left-0 z-10 text-center font-semibold">
                    {student.listNumber}
                  </td>
                  <td className="sticky left-16 z-10 font-medium">
                    <span>{student.firstName} {student.lastName}</span>
                    {dirtyStudentIds.has(student.id) ? (
                      <span className="ml-2 text-xs font-semibold text-primary">Sin guardar</span>
                    ) : null}
                  </td>
                  {SCORE_COLUMNS.map(({ field, label }) => {
                    const disabled = isScoreDisabled(field, scores, minimum, specialAllowed);
                    const error = errors[field];

                    return (
                      <td className="p-1.5 text-center" key={field}>
                        <input
                          aria-invalid={Boolean(error)}
                          aria-label={`${label} de ${student.firstName} ${student.lastName}`}
                          className={cn(
                            "w-24 min-w-24",
                            error && "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-100",
                          )}
                          disabled={disabled}
                          max={weight}
                          min={0}
                          onChange={(event) =>
                            onScoreChange(student.id, field, parseGradeInput(event.target.value))
                          }
                          placeholder={disabled ? "N/A" : "—"}
                          step="0.01"
                          title={error ?? (disabled ? getDisabledReason(field) : undefined)}
                          type="number"
                          value={scores[field] ?? ""}
                        />
                      </td>
                    );
                  })}
                  <td className="bg-institutional-blue-light/40 text-center font-semibold text-primary">
                    {formatTechnicalScore(validScore)}
                  </td>
                  <td className="text-center">
                    <TechnicalRaStatusBadge scores={scores} minimum={minimum} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {invalidRows.length > 0 ? (
        <div className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Revisa {invalidRows.length === 1 ? "la fila con error" : `las ${invalidRows.length} filas con errores`}.
            Coloca el cursor sobre una celda marcada para ver el detalle.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function isScoreDisabled(
  field: TechnicalScoreField,
  scores: TechnicalScoreValues,
  minimum: number,
  specialAllowed: boolean,
) {
  if (field === "ordinaryScore") return false;
  if (field === "recovery1Score") {
    return scores.ordinaryScore === null || scores.ordinaryScore >= minimum;
  }
  if (field === "recovery2Score") {
    return scores.recovery1Score === null || scores.recovery1Score >= minimum;
  }
  return scores.recovery2Score === null || scores.recovery2Score >= minimum || !specialAllowed;
}

function getDisabledReason(field: TechnicalScoreField) {
  if (field === "recovery1Score") return "Disponible cuando la ordinaria no alcanza el mínimo.";
  if (field === "recovery2Score") return "Disponible cuando recuperación 1 no alcanza el mínimo.";
  if (field === "specialScore") {
    return "Disponible tras recuperación 2 cuando el total del módulo es menor de 70.";
  }
  return undefined;
}

function TechnicalRaStatusBadge({
  scores,
  minimum,
}: {
  scores: TechnicalScoreValues;
  minimum: number;
}) {
  const validScore = getTechnicalValidScore(scores);

  if (validScore === null) {
    return <span className="status-badge status-pending">Pendiente</span>;
  }
  if (validScore >= minimum) {
    return <span className="status-badge status-approved">Aprobado</span>;
  }
  if (scores.specialScore !== null) {
    return <span className="status-badge status-failed">Reprobado</span>;
  }
  return <span className="status-badge status-extraordinaria">No alcanzado</span>;
}
