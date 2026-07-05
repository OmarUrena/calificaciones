"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeacherAssignment, TeacherAssignmentFormValues } from "@/types/assignment";
import type { Course } from "@/types/course";
import type { SchoolYear } from "@/types/school-year";
import type { Subject } from "@/types/subject";
import type { Teacher } from "@/types/teacher";

const assignmentSchema = z.object({
  schoolYearId: z.string().min(1, "Selecciona un ano escolar."),
  courseId: z.string().min(1, "Selecciona un curso."),
  subjectId: z.string().min(1, "Selecciona una asignatura."),
  teacherId: z.string().min(1, "Selecciona un maestro."),
  isActive: z.boolean(),
});

type AssignmentFormProps = {
  assignment?: TeacherAssignment | null;
  courses: Course[];
  schoolYears: SchoolYear[];
  subjects: Subject[];
  teachers: Teacher[];
  selectedTeacherId?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: TeacherAssignmentFormValues) => Promise<void> | void;
};

const emptyValues: TeacherAssignmentFormValues = {
  schoolYearId: "",
  courseId: "",
  subjectId: "",
  teacherId: "",
  isActive: true,
};

export function AssignmentForm({
  assignment,
  courses,
  schoolYears,
  subjects,
  teachers,
  selectedTeacherId,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: AssignmentFormProps) {
  const {
    register,
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TeacherAssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: emptyValues,
  });

  const selectedSchoolYearId = useWatch({ control, name: "schoolYearId" });
  const availableCourses = useMemo(
    () =>
      selectedSchoolYearId
        ? courses.filter((course) => course.schoolYearId === selectedSchoolYearId)
        : courses,
    [courses, selectedSchoolYearId],
  );

  useEffect(() => {
    const activeSchoolYear = schoolYears.find((schoolYear) => schoolYear.isActive);

    reset(
      assignment
        ? {
            schoolYearId: assignment.schoolYearId,
            courseId: assignment.courseId,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            isActive: assignment.isActive,
          }
        : {
            ...emptyValues,
            schoolYearId: activeSchoolYear?.id ?? "",
            teacherId: selectedTeacherId ?? "",
          },
    );
  }, [assignment, reset, schoolYears, selectedTeacherId]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {assignment ? "Editar asignacion" : "Crear asignacion"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Relaciona maestro, asignatura, curso y ano escolar.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="Ano escolar" error={errors.schoolYearId?.message}>
          <select
            className={cn("form-control", errors.schoolYearId && "form-control-error")}
            {...register("schoolYearId")}
          >
            <option value="">Selecciona un ano escolar</option>
            {schoolYears.map((schoolYear) => (
              <option key={schoolYear.id} value={schoolYear.id}>
                {schoolYear.name} {schoolYear.isActive ? "(Activo)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Curso" error={errors.courseId?.message}>
          <select
            className={cn("form-control", errors.courseId && "form-control-error")}
            {...register("courseId")}
          >
            <option value="">Selecciona un curso</option>
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Asignatura" error={errors.subjectId?.message}>
          <select
            className={cn("form-control", errors.subjectId && "form-control-error")}
            {...register("subjectId")}
          >
            <option value="">Selecciona una asignatura</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} ({subject.type === "TECHNICAL" ? "Tecnica" : "Academica"})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Maestro" error={errors.teacherId?.message}>
          <select
            className={cn("form-control", errors.teacherId && "form-control-error")}
            {...register("teacherId")}
          >
            <option value="">Selecciona un maestro</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </Field>

        <label className="form-field flex items-center gap-3 md:col-span-2">
          <input
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
            type="checkbox"
            {...register("isActive")}
          />
          <span>
            <span className="form-label mb-0">Asignacion activa</span>
            <span className="form-help block">
              Las asignaciones inactivas no habilitan permisos docentes.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-secondary/50 px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field block">
      <span className="form-label">{label}</span>
      {children}
      {error ? <span className="form-error block">{error}</span> : null}
    </label>
  );
}
