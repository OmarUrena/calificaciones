"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useAcademicPeriodControls, useSetAcademicPeriod } from "@/hooks/use-academic-period-controls";
import { useSchoolYears } from "@/hooks/use-school-years";
import { ApiError } from "@/lib/api";
import type { AcademicScoreField } from "@/types/grades";

const PERIODS: Array<{ name: string; ordinary: AcademicScoreField; recovery: AcademicScoreField }> = [
  { name: "Período 1", ordinary: "p1", recovery: "rp1" },
  { name: "Período 2", ordinary: "p2", recovery: "rp2" },
  { name: "Período 3", ordinary: "p3", recovery: "rp3" },
  { name: "Período 4", ordinary: "p4", recovery: "rp4" },
];

export function AcademicPeriodSettings({ schoolId }: { schoolId: string }) {
  const years = useSchoolYears();
  const schoolYears = years.data?.filter((year) => year.schoolId === schoolId) ?? [];
  const [selectedYearId, setSelectedYearId] = useState("");
  const schoolYearId = schoolYears.some((year) => year.id === selectedYearId)
    ? selectedYearId
    : (schoolYears.find((year) => year.isActive)?.id ?? schoolYears[0]?.id ?? "");
  const controls = useAcademicPeriodControls(schoolYearId);
  const setPeriod = useSetAcademicPeriod(schoolYearId);

  async function change(field: AcademicScoreField, isOpen: boolean) {
    if (!isOpen && !window.confirm(`¿Cerrar ${field.toUpperCase()} para este año escolar? Se impedirán nuevos cambios en todas las competencias.`)) return;
    try {
      await setPeriod.mutateAsync({ field, isOpen });
      toast.success(`${field.toUpperCase()} ${isOpen ? "abierto" : "cerrado"} correctamente.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo cambiar el período.");
    }
  }

  return <div className="admin-card space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-institutional-gray-dark">Períodos de calificación</h2>
      <p className="text-sm text-institutional-gray">Controla la edición de cada nota ordinaria y recuperación en todas las competencias de la escuela.</p>
    </div>
    {years.isError ? <p role="alert">No se pudieron cargar los años escolares.</p> : null}
    {years.isLoading ? <p>Cargando años escolares...</p> : null}
    {schoolYears.length > 0 ? <label className="form-field block max-w-sm">
      <span className="form-label">Año escolar</span>
      <select className="form-control" value={schoolYearId} onChange={(event) => setSelectedYearId(event.target.value)}>
        {schoolYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isActive ? " (activo)" : ""}</option>)}
      </select>
    </label> : !years.isLoading ? <p>No hay años escolares registrados para esta escuela.</p> : null}
    {controls.isError ? <p role="alert" className="text-red-800">No se pudo consultar el estado de los períodos. <button className="underline" type="button" onClick={() => void controls.refetch()}>Reintentar</button></p> : null}
    {controls.isLoading && schoolYearId ? <p>Cargando períodos...</p> : null}
    {controls.data ? <div className="overflow-x-auto"><table className="compact-table min-w-[520px]">
      <thead><tr><th>Período</th><th>Nota ordinaria</th><th>Recuperación</th></tr></thead>
      <tbody>{PERIODS.map((period) => <tr key={period.name}>
        <th scope="row">{period.name}</th>
        {[period.ordinary, period.recovery].map((field) => <td key={field}>
          <button type="button" className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50" disabled={setPeriod.isPending}
            aria-label={`${controls.data.fields[field] ? "Cerrar" : "Abrir"} ${field.toUpperCase()}`}
            onClick={() => void change(field, !controls.data.fields[field])}>
            {field.toUpperCase()}: {controls.data.fields[field] ? "Abierto" : "Cerrado"}
          </button>
        </td>)}
      </tr>)}</tbody>
    </table></div> : null}
    {controls.data?.updatedAt ? <p className="text-xs text-institutional-gray">Último cambio: {new Date(controls.data.updatedAt).toLocaleString("es-DO")}</p> : null}
  </div>;
}
