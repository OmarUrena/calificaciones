"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SchoolYear, SchoolYearFormValues } from "@/types/school-year";

const schoolYearSchema = z.object({
  name: z.string().min(1, "El año escolar es obligatorio."),
  isActive: z.boolean(),
});

type SchoolYearFormProps = {
  schoolYear?: SchoolYear | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: SchoolYearFormValues) => Promise<void> | void;
};

const emptyValues: SchoolYearFormValues = {
  name: "",
  isActive: false,
};

export function SchoolYearForm({
  schoolYear,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: SchoolYearFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<SchoolYearFormValues>({
    resolver: zodResolver(schoolYearSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    reset(
      schoolYear
        ? {
            name: schoolYear.name,
            isActive: schoolYear.isActive,
          }
        : emptyValues,
    );
  }, [reset, schoolYear]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {schoolYear ? "Editar Año Escolar" : "Crear Año Escolar"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Define el periodo académico activo para la escuela.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <label className="form-field block">
          <span className="form-label">Año escolar</span>
          <input
            className={cn("form-control", errors.name && "form-control-error")}
            placeholder="Ejemplo: 2025-2026"
            {...register("name")}
          />
          {errors.name ? (
            <span className="form-error block">{errors.name.message}</span>
          ) : (
            <span className="form-help block">Usa el formato oficial del periodo.</span>
          )}
        </label>

        <label className="flex min-h-28 items-center gap-3 rounded-md border border-border bg-secondary/60 px-4 py-3">
          <input
            className="h-5 w-5 rounded border-input text-primary accent-[#1F4E79]"
            type="checkbox"
            {...register("isActive")}
          />
          <span>
            <span className="block text-base font-semibold text-institutional-gray-dark">
              Marcar como activo
            </span>
            <span className="block text-sm text-institutional-gray">
              Solo un año escolar debe estar activo por escuela.
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
