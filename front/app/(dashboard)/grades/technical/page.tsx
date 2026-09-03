"use client";

import { FileUp, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { TechnicalGradeEditor } from "@/components/grades/TechnicalGradeEditor";
import { TechnicalOutcomeSummary } from "@/components/grades/TechnicalOutcomeSummary";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTeacherAssignments } from "@/hooks/use-teacher-assignments";
import { useTechnicalRegister } from "@/hooks/use-technical-grades";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TeacherAssignment } from "@/types/assignment";

const EMPTY_ASSIGNMENTS: TeacherAssignment[] = [];

export default function TechnicalGradesPage() {
  const searchParams = useSearchParams();
  const { data: user } = useCurrentUser();
  const {
    data: assignments = EMPTY_ASSIGNMENTS,
    isLoading: isLoadingAssignments,
    isError: assignmentsFailed,
    error: assignmentsError,
  } = useTeacherAssignments();
  const [selectedCourseId, setSelectedCourseId] = useState(
    () => searchParams.get("courseId") ?? "",
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    () => searchParams.get("subjectId") ?? "",
  );
  const activeSchoolYearId = user?.activeSchoolYear?.id;

  const technicalAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.isActive &&
          assignment.subject?.type === "TECHNICAL" &&
          assignment.subject.isActive &&
          (!activeSchoolYearId || assignment.schoolYearId === activeSchoolYearId),
      ),
    [activeSchoolYearId, assignments],
  );
  const courses = useMemo(() => {
    const coursesById = new Map(
      technicalAssignments
        .filter((assignment) => assignment.course)
        .map((assignment) => [assignment.courseId, assignment.course!]),
    );
    return [...coursesById.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "es"),
    );
  }, [technicalAssignments]);
  const moduleAssignments = useMemo(
    () =>
      technicalAssignments
        .filter((assignment) => assignment.courseId === selectedCourseId && assignment.subject)
        .sort((left, right) =>
          (left.subject?.name ?? "").localeCompare(right.subject?.name ?? "", "es"),
        ),
    [selectedCourseId, technicalAssignments],
  );
  const selectionIsAvailable = technicalAssignments.some(
    (assignment) =>
      assignment.courseId === selectedCourseId && assignment.subjectId === selectedSubjectId,
  );
  const registerQuery = useTechnicalRegister(
    selectionIsAvailable ? selectedCourseId : "",
    selectionIsAvailable ? selectedSubjectId : "",
  );
  const importHref =
    selectedCourseId && selectedSubjectId
      ? `/imports?type=technical&courseId=${selectedCourseId}&subjectId=${selectedSubjectId}`
      : "/imports?type=technical";

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedSubjectId("");
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="institutional-title">Calificaciones técnicas</h1>
          <p className="institutional-subtitle">
            Registra las notas por resultado de aprendizaje y consulta el total del módulo.
          </p>
        </div>
        <Link
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3.5 text-base font-medium text-institutional-gray-dark transition-colors hover:bg-muted hover:text-foreground",
            "[&_svg]:h-4 [&_svg]:w-4",
          )}
          href={importHref}
        >
          <FileUp aria-hidden="true" />
          Importar notas
        </Link>
      </div>

      <div className="admin-card">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-field block">
            <span className="form-label">Curso</span>
            <select
              className="form-control"
              disabled={isLoadingAssignments}
              onChange={(event) => handleCourseChange(event.target.value)}
              value={selectedCourseId}
            >
              <option value="">Selecciona un curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field block">
            <span className="form-label">Módulo técnico</span>
            <select
              className="form-control"
              disabled={!selectedCourseId || isLoadingAssignments}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              value={selectedSubjectId}
            >
              <option value="">Selecciona un módulo</option>
              {moduleAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.subjectId}>
                  {assignment.subject?.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-institutional-gray">
          Solo aparecen módulos técnicos activos y asignados al curso durante el año escolar
          actual.
        </p>
      </div>

      {isLoadingAssignments ? <LoadingState label="Cargando cursos y módulos..." /> : null}

      {assignmentsFailed ? (
        <ErrorState
          message={
            assignmentsError instanceof ApiError
              ? assignmentsError.message
              : "No se pudieron cargar las asignaciones docentes."
          }
        />
      ) : null}

      {!isLoadingAssignments && !assignmentsFailed && technicalAssignments.length === 0 ? (
        <EmptyState
          description="No hay módulos técnicos activos disponibles para tu usuario en el año escolar actual."
          title="No hay asignaciones técnicas"
        />
      ) : null}

      {selectedCourseId && selectedSubjectId && !selectionIsAvailable ? (
        <ErrorState message="La combinación seleccionada no corresponde a una asignación técnica activa disponible para tu usuario." />
      ) : null}

      {registerQuery.isLoading ? <LoadingState label="Cargando registro técnico..." /> : null}

      {registerQuery.isError ? (
        <ErrorState
          message={
            registerQuery.error instanceof ApiError
              ? registerQuery.error.message
              : "No se pudo cargar el registro técnico."
          }
        />
      ) : null}

      {registerQuery.data ? (
        <>
          <TechnicalOutcomeSummary learningOutcomes={registerQuery.data.learningOutcomes} />
          <TechnicalGradeEditor
            key={`${selectedCourseId}:${selectedSubjectId}:${registerQuery.dataUpdatedAt}`}
            register={registerQuery.data}
          />
        </>
      ) : null}

      {!selectedCourseId && technicalAssignments.length > 0 ? (
        <EmptyState
          description="Selecciona un curso y un módulo para abrir el registro de calificaciones."
          title="Selecciona un módulo"
        />
      ) : null}

      {selectedCourseId && !selectedSubjectId && moduleAssignments.length > 0 ? (
        <EmptyState
          description="Selecciona un módulo técnico del curso para abrir su registro."
          title="Selecciona un módulo"
        />
      ) : null}
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="admin-card flex items-center gap-2 text-base text-institutional-gray">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="admin-card border-red-200 bg-red-50">
      <p className="font-medium text-red-800">{message}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-card flex flex-col items-center py-10 text-center">
      <GraduationCap className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
      <p className="text-lg font-medium text-institutional-gray-dark">{title}</p>
      <p className="max-w-2xl text-base text-institutional-gray">{description}</p>
    </div>
  );
}
