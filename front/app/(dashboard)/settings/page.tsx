"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { SchoolSettingsForm } from "@/components/forms/SchoolSettingsForm";
import { SchoolLogoForm } from "@/components/forms/SchoolLogoForm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSchools } from "@/hooks/use-schools";
import { useSaveSchoolSettings, useSchoolSettings } from "@/hooks/use-school-settings";

export default function SettingsPage() {
  const { data: user, isLoading, isError } = useCurrentUser();
  return <section className="space-y-6">
    <div><h1 className="institutional-title">Configuración de escuela</h1>
      <p className="institutional-subtitle">Gestiona los datos institucionales y el logo que identifica a tu escuela.</p></div>
    {isLoading ? <Loading /> : isError ? <p role="alert" className="admin-card">No se pudo cargar tu usuario.</p> :
      user?.role === "SUPER_ADMIN" ? <SchoolSelector /> :
      user?.role === "ADMIN" ? user.schoolId ? <SchoolSettings key={user.schoolId} schoolId={user.schoolId} /> :
        <p className="admin-card">Tu usuario no tiene una escuela vinculada.</p> :
        <p role="alert" className="admin-card">No tienes permiso para configurar la escuela.</p>}
  </section>;
}

function SchoolSelector() {
  const query = useSchools();
  const [schoolId, setSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorState message="No se pudieron cargar las escuelas." retry={() => void query.refetch()} />;
  return <>
    <div className="admin-card">
      <label className="form-label" htmlFor="settings-school">Escuela</label>
      <select id="settings-school" className="form-control" value={schoolId} disabled={busy}
        onChange={(event) => setSchoolId(event.target.value)}>
        <option value="">Selecciona una escuela</option>
        {query.data?.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
      </select>
      {query.data?.length === 0 && <p className="mt-3 text-sm text-institutional-gray">No hay escuelas registradas.</p>}
    </div>
    {schoolId && <SchoolSettings key={schoolId} schoolId={schoolId} onBusyChange={setBusy} />}
  </>;
}

function SchoolSettings({ schoolId, onBusyChange }: { schoolId: string; onBusyChange?: (busy: boolean) => void }) {
  const query = useSchoolSettings(schoolId);
  const { save, uploadLogo } = useSaveSchoolSettings(schoolId);
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorState message={query.error.message} retry={() => void query.refetch()} />;
  if (!query.data) return null;
  const busy = save.isPending || uploadLogo.isPending;
  return <div className="space-y-6">
    <SchoolSettingsForm school={query.data} disabled={busy} onSave={async (values) => {
      onBusyChange?.(true);
      try { return await save.mutateAsync(values); } finally { onBusyChange?.(false); }
    }} />
    <SchoolLogoForm school={query.data} disabled={busy} onUpload={async (file) => {
      onBusyChange?.(true);
      try { return await uploadLogo.mutateAsync(file); } finally { onBusyChange?.(false); }
    }} />
  </div>;
}

function Loading() {
  return <div role="status" className="admin-card flex items-center gap-2 text-institutional-gray"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Cargando configuración...</div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="admin-card text-red-800"><p>{message}</p><button type="button" className="mt-3 underline" onClick={retry}>Reintentar</button></div>;
}
