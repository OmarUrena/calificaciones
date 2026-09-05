export function ImportErrorsTable({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Errores por fila del archivo Excel</caption>
        <thead className="sticky top-0 bg-institutional-blue-light">
          <tr><th scope="col" className="p-3">Fila</th><th scope="col" className="p-3">Problema</th></tr>
        </thead>
        <tbody>
          {errors.map((error, index) => {
            const match = /^Fila\s+(\d+):\s*([\s\S]*)$/.exec(error);
            return <tr key={index} className="border-t border-border">
              <td className="p-3 align-top">{match?.[1] ?? "—"}</td>
              <td className="break-words p-3 text-red-800">{match?.[2] ?? error}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
