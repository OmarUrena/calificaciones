"use client";

import Image from "next/image";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { School } from "@/types/school";

export function SchoolLogoForm({ school, disabled, onUpload }: {
  school: School;
  disabled: boolean;
  onUpload: (file: File) => Promise<School>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function selectFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  async function upload() {
    if (!file || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await onUpload(file);
      selectFile(null);
      if (input.current) input.current.value = "";
      toast.success("Logo guardado. Se usará en los próximos boletines.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el logo.");
    } finally { setSaving(false); busy.current = false; }
  }

  const imageUrl = file ? preview : school.logoUrl ?? "";
  return (
    <form className="admin-card space-y-5" aria-busy={saving} onSubmit={(event) => { event.preventDefault(); void upload(); }}>
      <div><h2 className="text-xl font-semibold text-primary">Logo de la institución</h2>
        <p className="mt-1 text-sm text-institutional-gray">Selecciona una imagen PNG, JPG o WebP de hasta 2 MB. El logo aparecerá en los boletines.</p></div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <LogoPreview key={imageUrl} src={imageUrl} />
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="school-logo" className="form-label">Imagen del logo</label>
          <input ref={input} id="school-logo" type="file" accept="image/png,image/jpeg,image/webp"
            className="form-control max-w-full" disabled={disabled || saving}
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setError("");
              if (next && (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type) || next.size === 0 || next.size > 2 * 1024 * 1024)) {
                setError("Selecciona una imagen PNG, JPG o WebP válida de hasta 2 MB.");
                event.target.value = "";
                selectFile(null);
                return;
              }
              selectFile(next);
            }} />
          <p className="text-sm text-institutional-gray">{file ? "Vista previa del nuevo logo. Pulsa Guardar logo para aplicarlo." : school.logoUrl ? "Logo guardado actualmente." : "Todavía no hay un logo guardado."}</p>
        </div>
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled || saving || !file}>
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          {saving ? "Guardando logo..." : "Guardar logo"}
        </Button>
        {file && <Button type="button" variant="outline" disabled={disabled || saving}
          onClick={() => { selectFile(null); setError(""); if (input.current) input.current.value = ""; }}>Cancelar selección</Button>}
      </div>
    </form>
  );
}

function LogoPreview({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-md border border-border bg-white p-3">
    {src && !failed ? <Image src={src} alt="Vista previa del logo institucional" width={136} height={136}
      unoptimized className="max-h-full object-contain" onError={() => setFailed(true)} /> :
      <div className="text-center text-sm text-institutional-gray"><ImageIcon className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />{failed ? "No se pudo mostrar la imagen" : "Sin logo"}</div>}
  </div>;
}
