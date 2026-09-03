import { getTechnicalMinimum, formatTechnicalScore } from "@/lib/technical-grades";
import type { TechnicalLearningOutcome } from "@/types/technical-learning-outcome";

export function TechnicalOutcomeSummary({
  learningOutcomes,
}: {
  learningOutcomes: TechnicalLearningOutcome[];
}) {
  const totalWeight = learningOutcomes.reduce((sum, outcome) => sum + Number(outcome.weight), 0);

  return (
    <div className="admin-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold text-institutional-gray-dark">Resultados de aprendizaje</p>
          <p className="text-sm text-institutional-gray">
            Pesos y mínimos aprobatorios configurados para el módulo.
          </p>
        </div>
        <span className={totalWeight === 100 ? "status-badge status-approved" : "status-badge status-completiva"}>
          Total: {formatTechnicalScore(totalWeight)} / 100
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="compact-table">
          <thead>
            <tr>
              <th>RA</th>
              <th>Resultado de aprendizaje</th>
              <th className="text-center">Peso</th>
              <th className="text-center">Mínimo 70 %</th>
            </tr>
          </thead>
          <tbody>
            {learningOutcomes.map((outcome) => (
              <tr key={outcome.id}>
                <td className="font-semibold text-primary">{outcome.code}</td>
                <td>{outcome.name}</td>
                <td className="text-center">{formatTechnicalScore(outcome.weight)}</td>
                <td className="text-center font-semibold">
                  {formatTechnicalScore(getTechnicalMinimum(Number(outcome.weight)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
