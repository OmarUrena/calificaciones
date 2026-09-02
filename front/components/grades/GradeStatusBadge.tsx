import type { SubjectStatus } from "@/types/grades";

const STATUS_PRESENTATION: Record<SubjectStatus, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "status-pending" },
  APPROVED: { label: "Aprobado", className: "status-approved" },
  COMPLETIVA: { label: "Completiva", className: "status-completiva" },
  EXTRAORDINARIA: { label: "Extraordinaria", className: "status-extraordinaria" },
  SPECIAL: { label: "Especial", className: "status-special" },
  FAILED: { label: "Reprobado", className: "status-failed" },
};

export function GradeStatusBadge({ status }: { status: SubjectStatus }) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <span className={`status-badge ${presentation.className}`}>{presentation.label}</span>
  );
}
