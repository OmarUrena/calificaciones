"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ImportUploader } from "@/components/imports/ImportUploader";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTeacherAssignments } from "@/hooks/use-teacher-assignments";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/course";
import type { ImportType } from "@/types/imports";

const TABS: { type: ImportType; label: string }[] = [
  { type: "students", label: "Estudiantes" },
  { type: "academic", label: "Calificaciones académicas" },
  { type: "technical", label: "Calificaciones técnicas" },
];

export default function ImportsPage() {
  return <Suspense fallback={<p role="status">Cargando importaciones...</p>}><ImportsContent /></Suspense>;
}

function ImportsContent() {
  const params = useSearchParams();
  const { data: user } = useCurrentUser();
  const [selectedType, setSelectedType] = useState<ImportType | null>(() => {
    const type = params.get("type");
    return type === "students" || type === "academic" || type === "technical" ? type : null;
  });
  const [courseId, setCourseId] = useState(() => params.get("courseId") ?? "");
  const [subjectId, setSubjectId] = useState(() => params.get("subjectId") ?? "");
  const [busy, setBusy] = useState(false);
  const isTeacher = user?.role === "TEACHER";
  const type = isTeacher && (!selectedType || selectedType === "students") ? "academic" : selectedType ?? "students";
  const assignmentsQuery = useTeacherAssignments();
  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: () => apiFetch<Course[]>("/courses"),
    enabled: Boolean(user && !isTeacher && type === "students"),
  });
  const yearId = user?.activeSchoolYear?.id;
  const assignments = (assignmentsQuery.data ?? []).filter((assignment) =>
    assignment.isActive && assignment.subject?.isActive && assignment.course &&
    assignment.subject.type === (type === "technical" ? "TECHNICAL" : "ACADEMIC") &&
    (!yearId || assignment.schoolYearId === yearId) &&
    (!isTeacher || assignment.teacherId === user?.teacherId),
  );
  const courses = (type === "students"
    ? (coursesQuery.data ?? []).filter((course) => !yearId || course.schoolYearId === yearId)
    : [...new Map(assignments.map((assignment) => [assignment.courseId, assignment.course!])).values()]
  ).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const selectedCourse = courses.find((course) => course.id === courseId);
  const subjects = assignments.filter((assignment) => assignment.courseId === courseId);
  const selectedAssignment = subjects.find((assignment) => assignment.subjectId === subjectId);
  const query = type === "students" ? coursesQuery : assignmentsQuery;
  const ready = Boolean(user && selectedCourse && (type === "students" || selectedAssignment));

  return (
    <section className="space-y-6">
      <div><h1 className="institutional-title">Importaciones</h1>
        <p className="institutional-subtitle">Carga estudiantes y calificaciones desde Excel y consulta los resultados por fila.</p></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de importación">
        {TABS.filter((tab) => !isTeacher || tab.type !== "students").map((tab) => (
          <button key={tab.type} type="button" aria-pressed={type === tab.type} disabled={busy}
            className={cn("rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50", type === tab.type ? "bg-primary text-white" : "bg-white text-primary hover:bg-institutional-blue-light")}
            onClick={() => { setSelectedType(tab.type); setCourseId(""); setSubjectId(""); }}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="admin-card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-field block"><span className="form-label">Curso</span>
            <select className="form-control" value={courseId} disabled={busy || query.isLoading} onChange={(event) => { setCourseId(event.target.value); setSubjectId(""); }}>
              <option value="">Selecciona un curso</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          {type !== "students" && <label className="form-field block"><span className="form-label">{type === "technical" ? "Módulo técnico" : "Asignatura"}</span>
            <select className="form-control" value={subjectId} disabled={busy || !selectedCourse || query.isLoading} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">Selecciona {type === "technical" ? "un módulo" : "una asignatura"}</option>
              {subjects.map((assignment) => <option key={assignment.id} value={assignment.subjectId}>{assignment.subject?.name}</option>)}
            </select>
          </label>}
        </div>
        <p className="text-sm text-institutional-gray">
          Año escolar: {user?.activeSchoolYear?.name ?? selectedCourse?.schoolYear?.name ?? "El del curso seleccionado"}.
          {type !== "students" && (isTeacher ? " Solo aparecen tus asignaturas activas asignadas." : " Se muestran las asignaturas activas asignadas a cada curso.")}
        </p>
      </div>
      {query.isLoading && <p role="status" className="admin-card">Cargando opciones de importación...</p>}
      {query.isError && <div role="alert" className="admin-card text-red-800">
        <p>{query.error instanceof Error ? query.error.message : "No se pudieron cargar las opciones."}</p>
        <button type="button" className="mt-2 underline" onClick={() => void query.refetch()}>Reintentar</button>
      </div>}
      {!query.isLoading && !query.isError && courses.length === 0 && <p className="admin-card">No hay cursos {type !== "students" ? "con asignaciones activas " : ""}disponibles para importar.</p>}
      {!query.isLoading && !query.isError && courseId && !ready && <p role="status" className="admin-card">Selecciona un curso y, para calificaciones, una asignatura disponible para tu usuario.</p>}
      {ready && !query.isError && selectedCourse && <ImportUploader
        key={`${type}:${courseId}:${subjectId}:${selectedCourse.schoolYearId}`}
        selection={{ type, courseId, schoolYearId: selectedCourse.schoolYearId, ...(type !== "students" ? { subjectId } : {}) }}
        onBusyChange={setBusy}
      />}
    </section>
  );
}
