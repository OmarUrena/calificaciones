import { Fragment } from "react";

import { GradeStatusBadge } from "@/components/grades/GradeStatusBadge";
import type { GradeViewRegister } from "@/hooks/use-grade-view";
import { formatDecimalScore } from "@/lib/academic-grades";
import { formatTechnicalScore } from "@/lib/technical-grades";
import { ACADEMIC_SCORE_FIELDS, type ApiNumericValue, type SubjectStatus } from "@/types/grades";

type Column = { label: string; value: (studentId: string) => ApiNumericValue | undefined };
type ColumnGroup = { label: string; columns: Column[] };

export function ReadOnlyGradeRegister({ register, block }: {
  register: GradeViewRegister;
  block: number;
}) {
  const groups: ColumnGroup[] = [];
  const statusByStudent = new Map<string, SubjectStatus>(
    register.results.map((result) => [result.studentId, result.status]),
  );

  if (register.type === "ACADEMIC") {
    const grades = new Map(register.grades.map((grade) => [`${grade.studentId}:${grade.blockNumber}`, grade]));
    const results = new Map(register.results.map((result) => [result.studentId, result]));
    if (block > 0) {
      groups.push({
        label: `Bloque ${block}`,
        columns: [...ACADEMIC_SCORE_FIELDS, "pc" as const].map((field) => ({
          label: field.toUpperCase(),
          value: (id) => grades.get(`${id}:${block}`)?.[field],
        })),
      });
    } else {
      groups.push({
        label: "Promedios de competencias",
        columns: (["pc1", "pc2", "pc3", "pc4"] as const).map((field) => ({
          label: field.toUpperCase(), value: (id) => results.get(id)?.[field],
        })),
      }, {
        label: "Calificación y evaluaciones finales",
        columns: (["cf", "cec", "ccf", "ceex", "cexf", "ce", "cef"] as const).map((field) => ({
          label: field.toUpperCase(), value: (id) => results.get(id)?.[field],
        })),
      });
    }
  } else {
    const grades = new Map(register.grades.map((grade) => [`${grade.studentId}:${grade.learningOutcomeId}`, grade]));
    const results = new Map(register.results.map((result) => [result.studentId, result]));
    for (const outcome of register.learningOutcomes) {
      groups.push({
        label: `${outcome.code} · Peso ${formatTechnicalScore(outcome.weight)}`,
        columns: ([
          ["ordinaryScore", "Ordinaria"], ["recovery1Score", "R1"],
          ["recovery2Score", "R2"], ["specialScore", "Especial"], ["validScore", "Válida"],
        ] as const).map(([field, label]) => ({
          label, value: (id) => grades.get(`${id}:${outcome.id}`)?.[field],
        })),
      });
    }
    groups.push({ label: "Resultado del módulo", columns: [
      { label: "Total", value: (id) => results.get(id)?.totalScore },
      { label: "Final", value: (id) => results.get(id)?.finalScore },
    ] });
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-primary" role="region" aria-label="Registro de calificaciones, desplázate para ver todas las columnas" tabIndex={0}>
      <table className="compact-table w-max min-w-full tabular-nums">
        <caption className="sr-only">{register.subject.name}, {register.course.name}. Registro de solo lectura.</caption>
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-16" rowSpan={2} scope="col">No.</th>
            <th className="sticky left-16 z-20 min-w-64" rowSpan={2} scope="col">Estudiante</th>
            {groups.map((group) => <th className="text-center" key={group.label} colSpan={group.columns.length} scope="colgroup">{group.label}</th>)}
            <th className="min-w-32 text-center" rowSpan={2} scope="col">Estado de asignatura</th>
          </tr>
          <tr>
            {groups.map((group) => <Fragment key={group.label}>{group.columns.map((column) => (
              <th className="min-w-16 text-center" scope="col" key={column.label}>{column.label}</th>
            ))}</Fragment>)}
          </tr>
        </thead>
        <tbody>
          {register.students.map((student) => (
            <tr key={student.id}>
              <td className="sticky left-0 z-10 w-16 text-center font-semibold">{student.listNumber}</td>
              <th className="sticky left-16 z-10 bg-white text-left font-medium" scope="row">{student.lastName}, {student.firstName}</th>
              {groups.map((group) => <Fragment key={group.label}>{group.columns.map((column) => {
                const value = column.value(student.id);
                const formatted = register.type === "TECHNICAL"
                  ? formatTechnicalScore(value)
                  : column.label.startsWith("PC") ? formatDecimalScore(value) : value ?? "—";
                return <td className="text-center" key={column.label}>{formatted}</td>;
              })}</Fragment>)}
              <td className="text-center"><GradeStatusBadge status={statusByStudent.get(student.id) ?? "PENDING"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {register.students.length === 0 ? <p className="p-8 text-center text-institutional-gray">No hay estudiantes en este curso.</p> : null}
    </div>
  );
}
