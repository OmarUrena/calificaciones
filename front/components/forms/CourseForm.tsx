"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Course, CourseFormValues } from "@/types/course";
import type { SchoolYear } from "@/types/school-year";
import type { Teacher } from "@/types/teacher";

const courseSchema = z.object({
  name: z.string().min(1, "El nombre del curso es obligatorio."),
  grade: z.string().min(1, "El grado es obligatorio."),
  section: z.string().optional(),
  area: z.string().optional(),
  modality: z.string().optional(),
  schoolYearId: z.string().min(1, "Selecciona un año escolar."),
  titularId: z.string().optional(),
});

type CourseFormProps = {
  course?: Course | null;
  schoolYears: SchoolYear[];
  teachers: Teacher[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: CourseFormValues) => Promise<void> | void;
};

const emptyValues: CourseFormValues = {
  name: "",
  grade: "",
  section: "",
  area: "",
  modality: "Técnico Profesional",
  schoolYearId: "",
  titularId: "",
};

export function CourseForm({
  course,
  schoolYears,
  teachers,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: CourseFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    const activeSchoolYear = schoolYears.find((schoolYear) => schoolYear.isActive);

    reset(
      course
        ? {
            name: course.name,
            grade: course.grade,
            section: course.section ?? "",
            area: course.area ?? "",
            modality: course.modality ?? "",
            schoolYearId: course.schoolYearId,
            titularId: course.titularId ?? "",
          }
        : {
            ...emptyValues,
            schoolYearId: activeSchoolYear?.id ?? "",
          },
    );
  }, [course, reset, schoolYears]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {course ? "Editar Curso" : "Crear Curso"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Define grado, sección, área y maestro titular.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="Nombre del curso" error={errors.name?.message}>
          <input
            className={cn("form-control", errors.name && "form-control-error")}
            placeholder="Ejemplo: 4to A Informática"
            {...register("name")}
          />
        </Field>

        <Field label="Grado" error={errors.grade?.message}>
          <input
            className={cn("form-control", errors.grade && "form-control-error")}
            placeholder="Ejemplo: 4to"
            {...register("grade")}
          />
        </Field>

        <Field label="Sección" error={errors.section?.message}>
          <input className="form-control" placeholder="Ejemplo: A" {...register("section")} />
        </Field>

        <Field label="Área" error={errors.area?.message}>
          <input
            className="form-control"
            placeholder="Ejemplo: Informática"
            {...register("area")}
          />
        </Field>

        <Field label="Modalidad" error={errors.modality?.message}>
          <input className="form-control" {...register("modality")} />
        </Field>

        <Field label="Año escolar" error={errors.schoolYearId?.message}>
          <select
            className={cn("form-control", errors.schoolYearId && "form-control-error")}
            {...register("schoolYearId")}
          >
            <option value="">Selecciona un año escolar</option>
            {schoolYears.map((schoolYear) => (
              <option key={schoolYear.id} value={schoolYear.id}>
                {schoolYear.name} {schoolYear.isActive ? "(Activo)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Maestro titular" help="Opcional. Puedes asignarlo luego.">
          <select className="form-control" {...register("titularId")}>
            <option value="">Sin titular</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </Field>
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
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field block">
      <span className="form-label">{label}</span>
      {children}
      {error ? (
        <span className="form-error block">{error}</span>
      ) : help ? (
        <span className="form-help block">{help}</span>
      ) : null}
    </label>
  );
}
