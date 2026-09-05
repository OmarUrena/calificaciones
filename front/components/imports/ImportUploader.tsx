"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadImportTemplate, useImportFile } from "@/hooks/use-imports";
import type { ImportSelection } from "@/types/imports";
import { ImportResult } from "./ImportResult";

export function ImportUploader({ selection, onBusyChange }: {
  selection: ImportSelection;
  onBusyChange: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const mutation = useImportFile();
  const busy = downloading || mutation.isPending;

  async function download() {
    if (busyRef.current) return;
    busyRef.current = true;
    setDownloading(true);
    onBusyChange(true);
    setError("");
    try { await downloadImportTemplate(selection); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo descargar la plantilla."); }
    finally { setDownloading(false); onBusyChange(false); busyRef.current = false; }
  }

  async function upload() {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    onBusyChange(true);
    setError("");
    mutation.reset();
    try {
      await mutation.mutateAsync({ ...selection, file });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setError(`${error instanceof Error ? error.message : "No se pudo importar el archivo."} Revisa el registro antes de volver a enviarlo.`);
    } finally { onBusyChange(false); busyRef.current = false; }
  }

  return (
    <div className="space-y-4">
      <form className="admin-card space-y-4" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void upload(); }}>
        <div>
          <h2 className="text-lg font-semibold text-primary">Cargar archivo Excel</h2>
          <p className="mt-1 text-sm text-institutional-gray">
            Descarga la plantilla del curso y completa la hoja Datos. Se admiten archivos .xlsx y .xlsm.
            {selection.type !== "students" && " La plantilla incluye los números de lista; elimina las filas sin notas. Las celdas vacías conservan las notas existentes."}
          </p>
        </div>
        {selection.type === "academic" && <p className="text-sm text-institutional-gray">Para importar CEC, CEEX o CE, incluye también al menos una nota de bloque en la fila.</p>}
        <Button type="button" variant="outline" onClick={() => void download()} disabled={busy}>
          {downloading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          Descargar plantilla
        </Button>
        <label className="form-field block">
          <span className="form-label">Archivo Excel</span>
          <input ref={inputRef} type="file" className="form-control max-w-full" accept=".xlsx,.xlsm" disabled={busy}
            onChange={(event) => {
              mutation.reset();
              setError("");
              const selected = event.target.files?.[0] ?? null;
              if (selected && (!/\.(xlsx|xlsm)$/i.test(selected.name) || selected.size === 0)) {
                setError("Selecciona un archivo Excel .xlsx o .xlsm que no esté vacío.");
                setFile(null);
                event.target.value = "";
              } else { setFile(selected); }
            }} />
        </label>
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <Button type="submit" disabled={!file || busy}>
          {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
          {mutation.isPending ? "Importando..." : "Importar"}
        </Button>
        {mutation.isPending && <p role="status" className="text-sm text-institutional-gray">Procesando las filas. Mantén esta página abierta hasta que aparezca el resultado.</p>}
      </form>
      {mutation.data && <ImportResult result={mutation.data} />}
    </div>
  );
}
