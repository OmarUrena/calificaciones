import type { ImportSummary } from "@/types/imports";
import { ImportErrorsTable } from "./ImportErrorsTable";

export function ImportResult({ result }: { result: ImportSummary }) {
  const status = result.status === "FAILED" ? "Importación fallida" :
    result.errorRows ? "Importación completada con errores" : "Importación completada";
  return (
    <section className="admin-card space-y-4" aria-label="Resultado de importación" aria-live="polite">
      <h2 className="text-lg font-semibold text-primary">{status}</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[["Total de filas", result.totalRows], ["Filas importadas", result.successRows], ["Filas con error", result.errorRows]].map(([label, count]) => (
          <div key={label} className="rounded-md border border-border bg-background p-3">
            <dt className="text-sm text-institutional-gray">{label}</dt>
            <dd className="text-2xl font-semibold">{count}</dd>
          </div>
        ))}
      </dl>
      {result.errorRows > 0 && <p className="text-sm text-institutional-gray">
        Revisa los errores y el registro antes de reintentar. Una fila de calificaciones con error puede haber guardado parte de sus notas. Para estudiantes, vuelve a cargar solo las filas pendientes.
      </p>}
      <ImportErrorsTable errors={result.errors} />
    </section>
  );
}
