"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  TechnicalLearningOutcome,
  TechnicalLearningOutcomeFormValues,
} from "@/types/technical-learning-outcome";

const learningOutcomeSchema = z.object({
  code: z.string().min(1, "El codigo es obligatorio."),
  name: z.string().min(1, "El nombre es obligatorio."),
  weight: z
    .number({ message: "El peso es obligatorio." })
    .min(0, "El peso no puede ser menor que 0.")
    .max(100, "El peso no puede ser mayor que 100."),
  order: z
    .number({ message: "El orden es obligatorio." })
    .int("El orden debe ser un numero entero.")
    .min(1, "El orden debe ser mayor o igual a 1."),
  isActive: z.boolean(),
});

type TechnicalLearningOutcomeFormProps = {
  learningOutcome?: TechnicalLearningOutcome | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: TechnicalLearningOutcomeFormValues) => Promise<void> | void;
};

const emptyValues: TechnicalLearningOutcomeFormValues = {
  code: "",
  name: "",
  weight: 0,
  order: 1,
  isActive: true,
};

export function TechnicalLearningOutcomeForm({
  learningOutcome,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: TechnicalLearningOutcomeFormProps) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<TechnicalLearningOutcomeFormValues>({
    resolver: zodResolver(learningOutcomeSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    reset(
      learningOutcome
        ? {
            code: learningOutcome.code,
            name: learningOutcome.name,
            weight: Number(learningOutcome.weight),
            order: learningOutcome.order,
            isActive: learningOutcome.isActive,
          }
        : emptyValues,
    );
  }, [learningOutcome, reset]);

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="border-b border-border bg-institutional-blue-light px-6 py-4">
        <h2 className="text-2xl font-semibold text-primary">
          {learningOutcome ? "Editar RA" : "Crear RA"}
        </h2>
        <p className="mt-1 text-base text-institutional-gray-dark">
          Define codigo, orden y peso del resultado de aprendizaje.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="Codigo" error={errors.code?.message}>
          <input
            className={cn("form-control", errors.code && "form-control-error")}
            placeholder="Ejemplo: RA1"
            {...register("code")}
          />
        </Field>

        <Field label="Orden" error={errors.order?.message}>
          <input
            className={cn("form-control", errors.order && "form-control-error")}
            min="1"
            step="1"
            type="number"
            {...register("order", { valueAsNumber: true })}
          />
        </Field>

        <Field label="Nombre" error={errors.name?.message}>
          <input
            className={cn("form-control", errors.name && "form-control-error")}
            placeholder="Resultado de aprendizaje"
            {...register("name")}
          />
        </Field>

        <Field label="Peso" error={errors.weight?.message} help="Valor entre 0 y 100.">
          <input
            className={cn("form-control", errors.weight && "form-control-error")}
            min="0"
            max="100"
            step="0.01"
            type="number"
            {...register("weight", { valueAsNumber: true })}
          />
        </Field>

        <label className="form-field flex items-center gap-3 md:col-span-2">
          <input
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
            type="checkbox"
            {...register("isActive")}
          />
          <span>
            <span className="form-label mb-0">RA activo</span>
            <span className="form-help block">
              Solo los RA activos cuentan para la suma de pesos del modulo.
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
