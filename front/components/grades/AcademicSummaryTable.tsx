import {
  formatDecimalScore,
  formatIntegerScore,
  parseGradeInput,
  validateFinalEvaluations,
} from "@/lib/academic-grades";
import { cn } from "@/lib/utils";
import type {
  AcademicFinalEvaluationValues,
  AcademicSubjectResult,
} from "@/types/grades";
import type { Student } from "@/types/student";

import { GradeStatusBadge } from "./GradeStatusBadge";

export function AcademicSummaryTable({
  students,
  resultsByStudent,
  evaluationsByStudent,
  dirtyStudentIds,
  onEvaluationChange,
}: {
  students: Student[];
  resultsByStudent: Record<string, AcademicSubjectResult | undefined>;
  evaluationsByStudent: Record<string, AcademicFinalEvaluationValues>;
  dirtyStudentIds: Set<string>;
  onEvaluationChange: (
    studentId: string,
    field: keyof AcademicFinalEvaluationValues,
    value: number | null,
  ) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="p-8 text-center text-base text-institutional-gray">
        No hay estudiantes en este curso.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="compact-table min-w-[1500px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-16 min-w-16">No.</th>
            <th className="sticky left-16 z-20 min-w-64">Estudiante</th>
            <th className="text-center">PC1</th>
            <th className="text-center">PC2</th>
            <th className="text-center">PC3</th>
            <th className="text-center">PC4</th>
            <th className="text-center">CF</th>
            <th className="min-w-24 text-center">CEC</th>
            <th className="text-center">CCF</th>
            <th className="min-w-24 text-center">CEEX</th>
            <th className="text-center">CEXF</th>
            <th className="min-w-24 text-center">CE</th>
            <th className="text-center">CEF</th>
            <th className="min-w-32 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const result = resultsByStudent[student.id];
            const evaluations = evaluationsByStudent[student.id];
            const errors = validateFinalEvaluations(evaluations, result?.cf);
            const canEditCec = result?.cf !== null && result?.cf !== undefined && result.cf < 70;
            const canEditCeex =
              result?.ccf !== null && result?.ccf !== undefined && result.ccf < 70;
            const canEditCe =
              result?.cexf !== null && result?.cexf !== undefined && result.cexf < 70;

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
                <ScoreCell value={formatDecimalScore(result?.pc1)} />
                <ScoreCell value={formatDecimalScore(result?.pc2)} />
                <ScoreCell value={formatDecimalScore(result?.pc3)} />
                <ScoreCell value={formatDecimalScore(result?.pc4)} />
                <ScoreCell emphasized value={formatIntegerScore(result?.cf)} />
                <EvaluationInputCell
                  disabled={!canEditCec}
                  error={errors.cec}
                  label={`CEC de ${student.firstName} ${student.lastName}`}
                  onChange={(value) => onEvaluationChange(student.id, "cec", value)}
                  value={evaluations.cec}
                />
                <ScoreCell value={formatIntegerScore(result?.ccf)} />
                <EvaluationInputCell
                  disabled={!canEditCeex}
                  error={errors.ceex}
                  label={`CEEX de ${student.firstName} ${student.lastName}`}
                  onChange={(value) => onEvaluationChange(student.id, "ceex", value)}
                  value={evaluations.ceex}
                />
                <ScoreCell value={formatIntegerScore(result?.cexf)} />
                <EvaluationInputCell
                  disabled={!canEditCe}
                  error={errors.ce}
                  label={`CE de ${student.firstName} ${student.lastName}`}
                  onChange={(value) => onEvaluationChange(student.id, "ce", value)}
                  value={evaluations.ce}
                />
                <ScoreCell value={formatIntegerScore(result?.cef)} />
                <td className="text-center">
                  <GradeStatusBadge status={result?.status ?? "PENDING"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({ value, emphasized = false }: { value: string; emphasized?: boolean }) {
  return (
    <td className={cn("text-center", emphasized && "bg-institutional-blue-light/40 font-semibold text-primary")}>
      {value}
    </td>
  );
}

function EvaluationInputCell({
  value,
  label,
  disabled,
  error,
  onChange,
}: {
  value: number | null;
  label: string;
  disabled: boolean;
  error?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <td className="p-1.5 text-center">
      <input
        aria-invalid={Boolean(error)}
        aria-label={label}
        className={cn(
          "w-20 min-w-20",
          error && "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-100",
        )}
        disabled={disabled}
        max={100}
        min={0}
        onChange={(event) => onChange(parseGradeInput(event.target.value))}
        placeholder={disabled ? "N/A" : "—"}
        step={1}
        title={error ?? (disabled ? "Esta evaluación aún no aplica." : undefined)}
        type="number"
        value={value ?? ""}
      />
    </td>
  );
}
