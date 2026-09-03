import {
  formatTechnicalScore,
  getTechnicalMinimum,
  getTechnicalValidScore,
  resolveTechnicalModuleStatus,
} from "@/lib/technical-grades";
import { cn } from "@/lib/utils";
import type {
  TechnicalScoreValues,
  TechnicalSubjectResult,
} from "@/types/grades";
import type { Student } from "@/types/student";
import type { TechnicalLearningOutcome } from "@/types/technical-learning-outcome";

import { GradeStatusBadge } from "./GradeStatusBadge";

export function TechnicalSummaryTable({
  students,
  learningOutcomes,
  resultsByStudent,
  dirtyStudentIds,
  getScores,
}: {
  students: Student[];
  learningOutcomes: TechnicalLearningOutcome[];
  resultsByStudent: Record<string, TechnicalSubjectResult | undefined>;
  dirtyStudentIds: Set<string>;
  getScores: (studentId: string, learningOutcomeId: string) => TechnicalScoreValues;
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
      <table className="compact-table min-w-[900px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-16 min-w-16">No.</th>
            <th className="sticky left-16 z-20 min-w-64">Estudiante</th>
            {learningOutcomes.map((outcome) => (
              <th className="min-w-24 text-center" key={outcome.id}>
                {outcome.code}
              </th>
            ))}
            <th className="min-w-24 text-center">Total</th>
            <th className="min-w-32 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const rows = learningOutcomes.map((outcome) => ({
              scores: getScores(student.id, outcome.id),
              weight: Number(outcome.weight),
            }));
            const scores = rows.map((row) => row.scores);
            const validScores = scores.map(getTechnicalValidScore);
            const total = validScores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
            const hasAnyScore = validScores.some((score) => score !== null);
            const result = resultsByStudent[student.id];
            const isDirty = dirtyStudentIds.has(student.id);
            const status = isDirty || !result ? resolveTechnicalModuleStatus(rows) : result.status;
            const displayedTotal = isDirty
              ? hasAnyScore
                ? total
                : null
              : result?.totalScore ?? (hasAnyScore ? total : null);

            return (
              <tr key={student.id}>
                <td className="sticky left-0 z-10 text-center font-semibold">
                  {student.listNumber}
                </td>
                <td className="sticky left-16 z-10 font-medium">
                  <span>{student.firstName} {student.lastName}</span>
                  {isDirty ? (
                    <span className="ml-2 text-xs font-semibold text-primary">Sin guardar</span>
                  ) : null}
                </td>
                {learningOutcomes.map((outcome, index) => {
                  const score = validScores[index];
                  const minimum = getTechnicalMinimum(Number(outcome.weight));

                  return (
                    <td
                      className={cn(
                        "text-center font-medium",
                        score !== null && score < minimum && "bg-orange-50 text-orange-800",
                      )}
                      key={outcome.id}
                      title={`Peso ${formatTechnicalScore(outcome.weight)} · mínimo ${formatTechnicalScore(minimum)}`}
                    >
                      {formatTechnicalScore(score)}
                    </td>
                  );
                })}
                <td className="bg-institutional-blue-light/40 text-center font-semibold text-primary">
                  {formatTechnicalScore(displayedTotal)}
                </td>
                <td className="text-center">
                  <GradeStatusBadge status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
