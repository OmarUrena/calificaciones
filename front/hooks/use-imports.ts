"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { downloadBlob, uploadFile } from "@/lib/api";
import type { ImportSelection, ImportSummary } from "@/types/imports";

const ENDPOINTS = {
  students: "/imports/students",
  academic: "/imports/academic-grades",
  technical: "/imports/technical-grades",
};

export function useImportFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type, ...fields }: ImportSelection & { file: File }) =>
      uploadFile<ImportSummary>(ENDPOINTS[type], { file, fields }),
    // A failed request can still have saved rows before the connection was lost.
    onSettled: () => {
      for (const key of ["students", "academic-register", "technical-register", "dashboard-stats", "imports"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export async function downloadImportTemplate(selection: ImportSelection) {
  const query = new URLSearchParams();
  Object.entries(selection).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const blob = await downloadBlob(`/imports/template?${query}`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `plantilla-${selection.type}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
