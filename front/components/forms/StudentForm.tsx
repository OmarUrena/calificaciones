"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/course";
import type { Student, StudentFormValues } from "@/types/student";

const studentSchema = z.object({
  listNumber: z.number().int("Debe ser un número entero.").min(1, "Debe ser mayor que 0."),
  firstName: z.string().min(1, "Los nombres son obligatorios."),
  lastName: z.string().min(1, "Los apellidos son obligatorios."),
  courseId: z.string().min(1, "Selecciona un curso."),
});

type StudentFormProps = {
  student?: Student | null;
  courses: Course[];
  isSubmitting?: boolean;
  selectedCourseId?: string;
  onCancel: () => void;
  onSubmit: (values: StudentFormValues) => Promise<void> | void;
};

const emptyValues: StudentFormValues = {
  listNumber: 1,
  firstName: "",
  lastName: "",
  courseId: "",
};

export function StudentForm({
  student,
  courses,
  isSubmitting = false,
  selectedCourseId,
  onCancel,
  onSubmit,
}: StudentFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    reset(
      student
        ? {
            listNumber: student.listNumber,
            firstName: student.firstName,
            lastName: student.lastName,
            courseId: student.courseId,
          }
        : {
            ...emptyValues,
            courseId: selectedCourseId ?? "",
          },
    );
  }, [reset, selectedCourseId, student]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {student ? "Editar Estudiante" : "Crear Estudiante"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Registra el número de lista y datos básicos del estudiante.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="Número de lista" error={errors.listNumber?.message}>
          <input
            className={cn("form-control", errors.listNumber && "form-control-error")}
            min={1}
            type="number"
            {...register("listNumber", { valueAsNumber: true })}
          />
        </Field>

        <Field label="Curso" error={errors.courseId?.message}>
          <select
            className={cn("form-control", errors.courseId && "form-control-error")}
            {...register("courseId")}
          >
            <option value="">Selecciona un curso</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nombres" error={errors.firstName?.message}>
          <input
            className={cn("form-control", errors.firstName && "form-control-error")}
            placeholder="Nombres"
            {...register("firstName")}
          />
        </Field>

        <Field label="Apellidos" error={errors.lastName?.message}>
          <input
            className={cn("form-control", errors.lastName && "form-control-error")}
            placeholder="Apellidos"
            {...register("lastName")}
          />
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
