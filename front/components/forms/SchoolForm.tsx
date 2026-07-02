"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { School, SchoolFormValues } from "@/types/school";

const schoolSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  code: z.string().min(1, "El código es obligatorio."),
  address: z.string().optional(),
  phone: z.string().optional(),
  logoUrl: z.string().optional(),
  isActive: z.boolean(),
});

type SchoolFormProps = {
  school?: School | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: SchoolFormValues) => Promise<void> | void;
};

const emptyValues: SchoolFormValues = {
  name: "",
  code: "",
  address: "",
  phone: "",
  logoUrl: "",
  isActive: true,
};

export function SchoolForm({
  school,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: SchoolFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    reset(
      school
        ? {
            name: school.name,
            code: school.code,
            address: school.address ?? "",
            phone: school.phone ?? "",
            logoUrl: school.logoUrl ?? "",
            isActive: school.isActive,
          }
        : emptyValues,
    );
  }, [reset, school]);

  return (
    <form className="overflow-hidden rounded-lg border border-border bg-white shadow-sm" onSubmit={handleSubmit(onSubmit)}>
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {school ? "Editar Escuela" : "Crear Escuela"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Registra los datos institucionales que luego aparecerán en reportes y boletines.
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Nombre de la escuela"
            error={errors.name?.message}
            help="Ejemplo: Politécnico Profesor Juan Bosch"
          >
            <input
              className={cn("form-control", errors.name && "form-control-error")}
              placeholder="Nombre institucional"
              {...register("name")}
            />
          </Field>

          <Field
            label="Código"
            error={errors.code?.message}
            help="Código único del centro educativo"
          >
            <input
              className={cn("form-control", errors.code && "form-control-error")}
              placeholder="Ejemplo: 12345"
              {...register("code")}
            />
          </Field>

          <Field label="Dirección" error={errors.address?.message}>
            <input
              className={cn("form-control", errors.address && "form-control-error")}
              placeholder="Dirección física"
              {...register("address")}
            />
          </Field>

          <Field label="Teléfono" error={errors.phone?.message}>
            <input
              className={cn("form-control", errors.phone && "form-control-error")}
              placeholder="Ejemplo: 809-000-0000"
              {...register("phone")}
            />
          </Field>

          <Field
            label="Logo URL"
            error={errors.logoUrl?.message}
            help="Opcional. Se usará en boletines cuando esté disponible."
          >
            <input
              className={cn("form-control", errors.logoUrl && "form-control-error")}
              placeholder="https://..."
              {...register("logoUrl")}
            />
          </Field>

          <label className="flex min-h-28 items-center gap-3 rounded-md border border-border bg-secondary/60 px-4 py-3">
            <input
              className="h-5 w-5 rounded border-input text-primary accent-[#1F4E79]"
              type="checkbox"
              {...register("isActive")}
            />
            <span>
              <span className="block text-base font-semibold text-institutional-gray-dark">
                Escuela activa
              </span>
              <span className="block text-sm text-institutional-gray">
                Las escuelas inactivas no deben usarse para operaciones nuevas.
              </span>
            </span>
          </label>
        </div>
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
