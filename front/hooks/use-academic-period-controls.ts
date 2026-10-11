"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { AcademicScoreField } from "@/types/grades";

export type AcademicPeriodControls = {
  schoolId: string;
  schoolYearId: string;
  fields: Record<AcademicScoreField, boolean>;
  updatedAt: string | null;
  updatedBy: string | null;
};

export function useAcademicPeriodControls(schoolYearId: string) {
  return useQuery({
    queryKey: ["academic-period-controls", schoolYearId],
    queryFn: () => apiFetch<AcademicPeriodControls>(`/academic-period-controls/${schoolYearId}`),
    enabled: Boolean(schoolYearId),
    staleTime: 0,
  });
}

export function useSetAcademicPeriod(schoolYearId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ field, isOpen }: { field: AcademicScoreField; isOpen: boolean }) =>
      apiFetch<AcademicPeriodControls>(`/academic-period-controls/${schoolYearId}`, {
        method: "PATCH",
        body: JSON.stringify({ field, isOpen }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["academic-period-controls", schoolYearId], data);
      void queryClient.invalidateQueries({ queryKey: ["academic-register"] });
    },
  });
}
