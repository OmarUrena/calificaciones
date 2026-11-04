"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { AcademicPeriods, SchoolYear, SchoolYearFormValues } from "@/types/school-year";

const SCHOOL_YEARS_QUERY_KEY = ["school-years"];

export function useSchoolYears() {
  return useQuery({
    queryKey: SCHOOL_YEARS_QUERY_KEY,
    queryFn: () => apiFetch<SchoolYear[]>("/school-years"),
  });
}

export function useCreateSchoolYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: SchoolYearFormValues & { schoolId: string }) =>
      apiFetch<SchoolYear>("/school-years", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHOOL_YEARS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}

export function useUpdateSchoolYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<SchoolYearFormValues & AcademicPeriods> }) =>
      apiFetch<SchoolYear>(`/school-years/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SCHOOL_YEARS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
        queryClient.invalidateQueries({ queryKey: ["academic-register"] }),
      ]);
    },
  });
}

export function useActivateSchoolYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SchoolYear>(`/school-years/${id}/activate`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHOOL_YEARS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}
