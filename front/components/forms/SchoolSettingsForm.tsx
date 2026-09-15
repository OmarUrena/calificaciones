"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { SchoolSettingsValues } from "@/hooks/use-school-settings";
import type { School } from "@/types/school";

const schema = z.object({
  name: z.string().trim().min(1, "El nombre de la institución es obligatorio."),
  code: z.string().trim().min(1, "El código es obligatorio."),
  address: z.string().trim(),
  phone: z.string().trim(),
});

function formValues(school: School): SchoolSettingsValues {
  return { name: school.name, code: school.code, address: school.address ?? "", phone: school.phone ?? "" };
}

export function SchoolSettingsForm({ school, disabled, onSave }: {
  school: School;
  disabled: boolean;
  onSave: (values: SchoolSettingsValues) => Promise<School>;
}) {
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<SchoolSettingsValues>({
    resolver: zodResolver(schema),
    defaultValues: formValues(school),
  });

  async function submit(values: SchoolSettingsValues) {
    setError("");
    try {
      const saved = await onSave(values);
      reset(formValues(saved));
      toast.success("Datos de la escuela guardados.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudieron guardar los datos.");
    }
  }

  return (
    <form className="admin-card space-y-5" onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
      <div><h2 className="text-xl font-semibold text-primary">Datos institucionales</h2>
        <p className="mt-1 text-sm text-institutional-gray">Actualiza los datos del centro educativo. El nombre se usa en la cabecera y en los boletines.</p></div>
      <fieldset disabled={disabled || isSubmitting} className="grid min-w-0 gap-5 md:grid-cols-2">
        {([
          ["name", "Nombre de la institución"], ["code", "Código"],
          ["address", "Dirección"], ["phone", "Teléfono"],
        ] as const).map(([field, label]) => (
          <div key={field} className="form-field">
            <label htmlFor={`school-${field}`} className="form-label">{label}{(field === "name" || field === "code") ? " *" : ""}</label>
            <input id={`school-${field}`} className="form-control" type={field === "phone" ? "tel" : "text"}
              aria-required={field === "name" || field === "code"}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `school-${field}-error` : undefined}
              {...register(field)} />
            {errors[field] && <p id={`school-${field}-error`} className="form-error" role="alert">{errors[field]?.message}</p>}
          </div>
        ))}
      </fieldset>
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled || isSubmitting || !isDirty}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {isSubmitting ? "Guardando datos..." : "Guardar datos"}
        </Button>
        <Button type="button" variant="outline" disabled={disabled || isSubmitting || !isDirty}
          onClick={() => { reset(formValues(school)); setError(""); }}>Restablecer</Button>
      </div>
    </form>
  );
}
