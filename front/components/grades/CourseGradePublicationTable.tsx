import type { GradeViewSubject } from "@/hooks/use-grade-view";

export function CourseGradePublicationTable({ subjects, selectedSubjectId, onSelectSubject }: {
  subjects: GradeViewSubject[];
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
}) {
  const withGrades = subjects.filter((subject) => subject.studentsWithGrades > 0).length;
  return (
    <div className="admin-card space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-primary">Seguimiento de calificaciones del curso</h2>
        <p className="mt-2 text-sm text-institutional-gray">
          {withGrades} asignaturas con notas · {subjects.length - withGrades} sin notas.
          Cada indicador muestra cuántos estudiantes tienen al menos una nota en ese período o resultado de aprendizaje.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-primary" role="region" aria-label="Seguimiento de notas por asignatura" tabIndex={0}>
        <table className="compact-table min-w-full">
          <caption className="sr-only">Docentes responsables y avance de las calificaciones registradas.</caption>
          <thead><tr>
            <th scope="col">Asignatura</th>
            <th scope="col">Docente responsable</th>
            <th scope="col">Notas registradas</th>
            <th scope="col">Estudiantes con notas</th>
            <th scope="col">Detalle por período o RA</th>
            <th scope="col">Consulta</th>
          </tr></thead>
          <tbody>{subjects.map((subject) => (
            <tr key={subject.id} aria-current={selectedSubjectId === subject.id ? "true" : undefined}>
              <th className="font-medium" scope="row">{subject.name}</th>
              <td>{subject.teachers.join(", ") || "Sin docente activo asignado"}</td>
              <td><span className={`status-badge ${subject.studentsWithGrades > 0 ? "status-approved" : "status-pending"}`}>
                {subject.studentsWithGrades > 0 ? "Con notas" : "Sin notas"}
              </span></td>
              <td className="text-center tabular-nums">{subject.studentsWithGrades} / {subject.studentCount}</td>
              <td><div className="flex min-w-64 flex-wrap gap-2">{subject.progress.map((item) => (
                <span key={item.label} className={`rounded-md border px-2 py-1 text-sm tabular-nums ${item.studentsWithGrades > 0 ? "border-blue-200 bg-blue-50 text-primary" : "border-border bg-muted text-institutional-gray"}`}>
                  {item.label}: {item.studentsWithGrades}/{subject.studentCount}
                </span>
              ))}{subject.progress.length === 0 ? "Sin resultados de aprendizaje definidos" : null}</div></td>
              <td><button type="button" onClick={() => onSelectSubject(subject.id)} aria-label={`Ver calificaciones de ${subject.name}`} aria-pressed={selectedSubjectId === subject.id}
                className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]">
                Ver calificaciones
              </button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-sm text-institutional-gray">Se consideran las notas guardadas o importadas. Tener notas registradas no significa que el período o la asignatura estén completos.</p>
    </div>
  );
}
