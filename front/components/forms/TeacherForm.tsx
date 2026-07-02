"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Teacher, TeacherFormValues } from "@/types/teacher";

const teacherSchema = z.object({
  name: z.string().min(1, "El nombre del maestro es obligatorio."),
});

type TeacherFormProps = {
  teacher?: Teacher | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: TeacherFormValues) => Promise<void> | void;
};

const emptyValues: TeacherFormValues = {
  name: "",
};

export function TeacherForm({
  teacher,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: TeacherFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    reset(teacher ? { name: teacher.name } : emptyValues);
  }, [reset, teacher]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {teacher ? "Editar Maestro" : "Crear Maestro"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Registra el nombre del docente.
        </p>
      </div>

      <div className="p-6">
        <label className="form-field block max-w-2xl">
          <span className="form-label">Nombre</span>
          <input
            className={cn("form-control", errors.name && "form-control-error")}
            placeholder="Nombre completo del maestro"
            {...register("name")}
          />
          {errors.name ? <span className="form-error block">{errors.name.message}</span> : null}
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
