"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Subject, SubjectFormValues } from "@/types/subject";

const subjectSchema = z.object({
  name: z.string().min(1, "El nombre de la asignatura es obligatorio."),
  type: z.enum(["ACADEMIC", "TECHNICAL"], {
    message: "Selecciona un tipo de asignatura.",
  }),
  isActive: z.boolean(),
});

type SubjectFormProps = {
  subject?: Subject | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: SubjectFormValues) => Promise<void> | void;
};

const emptyValues: SubjectFormValues = {
  name: "",
  type: "ACADEMIC",
  isActive: true,
};

export function SubjectForm({
  subject,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: SubjectFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    reset(
      subject
        ? {
            name: subject.name,
            type: subject.type,
            isActive: subject.isActive,
          }
        : emptyValues,
    );
  }, [reset, subject]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {subject ? "Editar asignatura" : "Crear asignatura"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Define si la asignatura es academica o tecnica.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="Nombre" error={errors.name?.message}>
          <input
            className={cn("form-control", errors.name && "form-control-error")}
            placeholder="Ejemplo: Matematica"
            {...register("name")}
          />
        </Field>

        <Field label="Tipo" error={errors.type?.message}>
          <select
            className={cn("form-control", errors.type && "form-control-error")}
            {...register("type")}
          >
            <option value="ACADEMIC">Academica</option>
            <option value="TECHNICAL">Tecnica</option>
          </select>
        </Field>

        <label className="form-field flex items-center gap-3 md:col-span-2">
          <input
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
            type="checkbox"
            {...register("isActive")}
          />
          <span>
            <span className="form-label mb-0">Asignatura activa</span>
            <span className="form-help block">
              Las asignaturas inactivas no deberian usarse en nuevas asignaciones.
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
