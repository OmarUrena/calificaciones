"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUpdateSchoolYear } from "@/hooks/use-school-years";
import { ApiError } from "@/lib/api";
import { ACADEMIC_PERIODS, type AcademicPeriods, type SchoolYear } from "@/types/school-year";

export function AcademicPeriodControls({ schoolYear }: { schoolYear: SchoolYear }) {
  const update = useUpdateSchoolYear();
  const [error, setError] = useState<string | null>(null);
  const settingsAvailable = ACADEMIC_PERIODS.every(({ key }) => typeof schoolYear[key] === "boolean");
  const unavailableMessage = "El servicio de calificaciones necesita actualizarse para gestionar P y RP.";

  async function togglePeriod(key: keyof AcademicPeriods, label: string) {
    const enabled = !schoolYear[key];
    setError(null);
    try {
      await update.mutateAsync({ id: schoolYear.id, values: { [key]: enabled } });
      toast.success(`${label} ${enabled ? "activado" : "desactivado"}.`);
    } catch (cause) {
      setError(cause instanceof ApiError
        ? /property (?:p|rp)[1-4]Enabled should not exist/.test(cause.message)
          ? unavailableMessage
          : cause.message
        : "No se pudo actualizar el período.");
    }
  }

  if (!settingsAvailable) {
    return <p className="text-sm text-red-800" role="alert">{unavailableMessage}</p>;
  }

  return (
    <div className="space-y-2">
      <div aria-label={`Períodos de ${schoolYear.name}`} className="flex flex-wrap gap-2" role="group">
        {ACADEMIC_PERIODS.map(({ key, label }) => (
          <Button
            aria-checked={schoolYear[key]}
            aria-label={`${label} de ${schoolYear.name}`}
            disabled={update.isPending}
            key={key}
            onClick={() => void togglePeriod(key, label)}
            role="switch"
            size="sm"
            variant={schoolYear[key] ? "default" : "outline"}
          >
            {label}: {schoolYear[key] ? "Activo" : "Inactivo"}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
    </div>
  );
}
