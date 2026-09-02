import { cn } from "@/lib/utils";

export type AcademicTab = 1 | 2 | 3 | 4 | "summary";

const TABS: Array<{ id: AcademicTab; label: string }> = [
  { id: 1, label: "Bloque 1" },
  { id: 2, label: "Bloque 2" },
  { id: 3, label: "Bloque 3" },
  { id: 4, label: "Bloque 4" },
  { id: "summary", label: "Resumen" },
];

export function AcademicBlockTabs({
  activeTab,
  onChange,
}: {
  activeTab: AcademicTab;
  onChange: (tab: AcademicTab) => void;
}) {
  return (
    <div aria-label="Bloques académicos" className="flex flex-wrap gap-1 border-b border-border" role="tablist">
      {TABS.map((tab) => {
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
