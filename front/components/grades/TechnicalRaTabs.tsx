import { cn } from "@/lib/utils";
import type { TechnicalLearningOutcome } from "@/types/technical-learning-outcome";

export type TechnicalTab = string | "summary";

export function TechnicalRaTabs({
  learningOutcomes,
  activeTab,
  onChange,
}: {
  learningOutcomes: TechnicalLearningOutcome[];
  activeTab: TechnicalTab;
  onChange: (tab: TechnicalTab) => void;
}) {
  const tabs: Array<{ id: TechnicalTab; label: string }> = [
    ...learningOutcomes.map((outcome) => ({ id: outcome.id, label: outcome.code })),
    { id: "summary", label: "Resumen" },
  ];

  return (
    <div
      aria-label="Resultados de aprendizaje"
      className="flex flex-wrap gap-1 border-b border-border"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "border-primary bg-institutional-blue-light text-primary"
                : "border-transparent text-institutional-gray hover:bg-muted hover:text-institutional-gray-dark",
            )}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
