"use client";

import { useState } from "react";

import { ReadOnlyGradeRegister } from "@/components/grades/ReadOnlyGradeRegister";
import { CourseGradePublicationTable } from "@/components/grades/CourseGradePublicationTable";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useGradeViewCourses, useGradeViewRegister, useGradeViewSubjects, type GradeViewRegister } from "@/hooks/use-grade-view";
import { cn } from "@/lib/utils";

export default function GradeViewPage() {
  const { data: user } = useCurrentUser();
  const coursesQuery = useGradeViewCourses();
  const [yearId, setYearId] = useState<string | null>(null);
  const [selectedCourseId, setCourseId] = useState("");
  const [selectedSubjectId, setSubjectId] = useState("");
  const [block, setBlock] = useState(0);
  const [search, setSearch] = useState("");
  const courses = coursesQuery.data ?? [];
  const selectedYearId = yearId ?? user?.activeSchoolYear?.id ?? "";
  const years = [...new Map(courses.filter((course) => course.schoolYear).map((course) => [
    course.schoolYearId, { id: course.schoolYearId, name: course.schoolYear!.name, school: course.school.name },
  ])).values()];
  const availableCourses = courses.filter((course) => !selectedYearId || course.schoolYearId === selectedYearId);
  const courseId = availableCourses.some((course) => course.id === selectedCourseId) ? selectedCourseId : "";
  const subjectsQuery = useGradeViewSubjects(courseId);
  const subjects = subjectsQuery.data ?? [];
  const subjectId = subjects.some((subject) => subject.id === selectedSubjectId) ? selectedSubjectId : "";
  const registerQuery = useGradeViewRegister(courseId, subjectId);
  const register = registerQuery.data;
  const error = coursesQuery.error ?? subjectsQuery.error ?? registerQuery.error;
  const loading = coursesQuery.isLoading || subjectsQuery.isLoading || registerQuery.isLoading;
  const filteredStudents = register?.students.filter((student) =>
      `${student.listNumber} ${student.firstName} ${student.lastName} ${student.firstName}`
        .toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")),
    ) ?? [];
  const filteredRegister: GradeViewRegister | null = !register ? null
    : register.type === "ACADEMIC" ? { ...register, students: filteredStudents }
    : { ...register, students: filteredStudents };

  function resetCourse() {
    setCourseId(""); setSubjectId(""); setSearch(""); setBlock(0);
  }

  function selectSubject(subjectId: string) {
    setSubjectId(subjectId); setBlock(0); setSearch("");
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="institutional-title">Visualización de calificaciones</h1>
          <p className="institutional-subtitle">Consulta las calificaciones registradas por curso y asignatura.</p>
        </div>
        <span className="rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-primary">Solo lectura</span>
      </div>

      <div className="admin-card space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="form-field block">
            <span className="form-label">Año escolar</span>
            <select className="form-control" disabled={coursesQuery.isLoading} value={selectedYearId} onChange={(event) => { setYearId(event.target.value); resetCourse(); }}>
              <option value="">Todos los años escolares</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}{user?.role === "SUPER_ADMIN" ? ` · ${year.school}` : ""}</option>)}
            </select>
          </label>
          <label className="form-field block">
            <span className="form-label">Curso</span>
            <select className="form-control" disabled={coursesQuery.isLoading} value={courseId} onChange={(event) => { resetCourse(); setCourseId(event.target.value); }}>
              <option value="">Selecciona un curso</option>
              {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.schoolYear?.name}{user?.role === "SUPER_ADMIN" ? ` · ${course.school.name}` : ""}</option>)}
            </select>
          </label>
          <label className="form-field block">
            <span className="form-label">Asignatura</span>
            <select className="form-control" disabled={!courseId || subjectsQuery.isLoading} value={subjectId} onChange={(event) => selectSubject(event.target.value)}>
              <option value="">Selecciona una asignatura</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.type === "ACADEMIC" ? "Académica" : "Técnica"}{subject.isActive ? "" : " (inactiva)"}</option>)}
            </select>
          </label>
        </div>
        <p className="text-sm text-institutional-gray">{user?.role === "TEACHER"
          ? "Como titular puedes consultar todas las asignaturas de tu curso. En los demás cursos puedes consultar las asignaturas que impartes."
          : "Puedes consultar todos los cursos y sus calificaciones, incluidas las asignaturas inactivas con registros anteriores."}</p>
      </div>

      {courseId && !subjectsQuery.isLoading && !subjectsQuery.isError && subjects.length > 0 ? (
        <CourseGradePublicationTable subjects={subjects} selectedSubjectId={subjectId} onSelectSubject={selectSubject} />
      ) : null}

      {error ? <div className="admin-card border-red-200 bg-red-50 text-red-800" role="alert">
        <p>{error.message}</p>
        <button className="mt-3 rounded-md border border-red-300 px-3 py-2 font-semibold hover:bg-red-100 focus-visible:outline-2 active:scale-[0.98]" onClick={() => {
          if (coursesQuery.isError) void coursesQuery.refetch();
          if (subjectsQuery.isError) void subjectsQuery.refetch();
          if (registerQuery.isError) void registerQuery.refetch();
        }}>Reintentar</button>
      </div> : null}

      {loading ? <div className="admin-card space-y-4" role="status" aria-label="Cargando calificaciones">
        <p className="text-institutional-gray">Cargando registro de calificaciones...</p>
        {[1, 2, 3].map((row) => <div key={row} className="h-8 animate-pulse rounded bg-muted motion-reduce:animate-none" />)}
      </div> : null}

      {!error && !loading && !register ? <div className="admin-card p-8 text-center">
        <h2 className="text-lg font-semibold text-institutional-gray-dark">{availableCourses.length === 0 ? "No hay cursos disponibles" : courseId && subjects.length === 0 ? "No hay asignaturas disponibles" : "Selecciona un curso y una asignatura"}</h2>
        <p className="mt-2 text-institutional-gray">El registro mostrará las notas guardadas en el sistema. Los espacios sin calificar se indican con —.</p>
      </div> : null}

      {register && filteredRegister && !error ? <div className="admin-card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-primary">{register.subject.name}</h2>
            <p className="text-sm text-institutional-gray">{register.course.name} · {register.course.schoolYear?.name} · {register.students.length} estudiantes</p>
          </div>
          <label className="form-field block">
            <span className="form-label">Buscar estudiante</span>
            <input className="form-control" type="search" placeholder="Nombre o número de lista" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
        {register.grades.length === 0 && register.results.length === 0 ? <p className="rounded-md bg-muted p-4 text-sm text-institutional-gray">Esta asignatura todavía no tiene calificaciones registradas.</p> : null}
        {register.type === "ACADEMIC" ? <div className="flex flex-wrap gap-2" role="group" aria-label="Vista del registro académico">
          {[0, 1, 2, 3, 4].map((value) => <button type="button" key={value} aria-pressed={block === value} onClick={() => setBlock(value)} className={cn(
            "rounded-md border px-3 py-2 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]",
            block === value ? "border-primary bg-primary text-white hover:bg-primary/90" : "border-border bg-white text-primary hover:bg-muted",
          )}>{value === 0 ? "Resumen final" : `Bloque ${value}`}</button>)}
        </div> : <p className="text-sm text-institutional-gray">R1 y R2: recuperaciones. Válida: calificación registrada para cada resultado de aprendizaje.</p>}
        {filteredRegister.students.length === 0 && register.students.length > 0 ? <p className="p-8 text-center text-institutional-gray" role="status">No hay estudiantes que coincidan con la búsqueda.</p>
          : <ReadOnlyGradeRegister register={filteredRegister} block={block} />}
      </div> : null}
    </section>
  );
}
