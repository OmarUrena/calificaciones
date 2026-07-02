import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: number | string;
  description?: string;
  icon: LucideIcon;
  tone?: "blue" | "gray" | "green" | "yellow";
};

const TONE_CLASSES = {
  blue: "bg-institutional-blue-light text-primary",
  gray: "bg-secondary text-institutional-gray-dark",
  green: "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-800",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: StatCardProps) {
  return (
    <article className="admin-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-medium text-institutional-gray">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-institutional-gray-dark">
            {value}
          </p>
        </div>
        <div className={cn("rounded-md p-2", TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {description ? (
        <p className="mt-3 text-base text-institutional-gray">{description}</p>
      ) : null}
    </article>
  );
}
