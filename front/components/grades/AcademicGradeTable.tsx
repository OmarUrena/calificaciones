import { AlertTriangle } from "lucide-react";

import {
  calculateAcademicPc,
  ORDINARY_BY_RECOVERY,
  parseGradeInput,
  validateAcademicScores,
} from "@/lib/academic-grades";
import { cn } from "@/lib/utils";
import type {
  AcademicRecoveryField,
  AcademicScoreField,
  AcademicScoreValues,
} from "@/types/grades";
import type { Student } from "@/types/student";

const SCORE_COLUMNS: Array<{ field: AcademicScoreField; label: string }> = [
  { field: "p1", label: "P1" },
  { field: "rp1", label: "RP1" },
  { field: "p2", label: "P2" },
  { field: "rp2", label: "RP2" },
  { field: "p3", label: "P3" },
  { field: "rp3", label: "RP3" },
  { field: "p4", label: "P4" },
  { field: "rp4", label: "RP4" },
];

export function AcademicGradeTable({
  students,
  scoresByStudent,
  dirtyStudentIds,
  onScoreChange,
}: {
  students: Student[];
  scoresByStudent: Record<string, AcademicScoreValues>;
  dirtyStudentIds: Set<string>;
  onScoreChange: (studentId: string, field: AcademicScoreField, value: number | null) => void;
}) {
  const invalidRows = students.filter(
    (student) => Object.keys(validateAcademicScores(scoresByStudent[student.id])).length > 0,
  );

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
      <div className="overflow-x-auto">
        <table className="compact-table min-w-[1050px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-16 min-w-16">No.</th>
              <th className="sticky left-16 z-20 min-w-64">Estudiante</th>
              {SCORE_COLUMNS.map((column) => (
                <th className="w-24 min-w-24 text-center" key={column.field}>
                  {column.label}
                </th>
              ))}
              <th className="w-24 min-w-24 text-center">PC</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const scores = scoresByStudent[student.id];
              const errors = validateAcademicScores(scores);
              const pc = calculateAcademicPc(scores);

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
                    const disabled = isRecoveryDisabled(field, scores);
                    const error = errors[field];

                    return (
                      <td className="p-1.5 text-center" key={field}>
                        <input
                          aria-invalid={Boolean(error)}
                          aria-label={`${label} de ${student.firstName} ${student.lastName}`}
                          className={cn(
                            "w-20 min-w-20",
                            error && "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-100",
                          )}
                          disabled={disabled}
                          max={100}
                          min={0}
                          onChange={(event) =>
                            onScoreChange(student.id, field, parseGradeInput(event.target.value))
                          }
                          placeholder={disabled ? "N/A" : "—"}
                          step="0.01"
                          title={error ?? (disabled ? "La recuperación no aplica." : undefined)}
                          type="number"
                          value={scores[field] ?? ""}
                        />
                      </td>
                    );
                  })}
                  <td className="bg-institutional-blue-light/40 text-center font-semibold text-primary">
                    {pc === null ? "—" : pc.toFixed(1)}
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

function isRecoveryDisabled(field: AcademicScoreField, scores: AcademicScoreValues) {
  if (!field.startsWith("rp")) return false;

  const recoveryField = field as AcademicRecoveryField;
  const ordinaryScore = scores[ORDINARY_BY_RECOVERY[recoveryField]];
  return ordinaryScore === null || ordinaryScore >= 70;
}
