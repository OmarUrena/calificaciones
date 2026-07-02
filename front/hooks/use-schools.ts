"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { School, SchoolFormValues } from "@/types/school";

const SCHOOLS_QUERY_KEY = ["schools"];

export function useSchools() {
  return useQuery({
    queryKey: SCHOOLS_QUERY_KEY,
    queryFn: () => apiFetch<School[]>("/schools"),
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: SchoolFormValues) =>
      apiFetch<School>("/schools", {
        method: "POST",
        body: JSON.stringify(cleanSchoolPayload(values)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHOOLS_QUERY_KEY });
    },
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<SchoolFormValues> }) =>
      apiFetch<School>(`/schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify(cleanSchoolPayload(values)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHOOLS_QUERY_KEY });
    },
  });
}

export function useDeactivateSchool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<School>(`/schools/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHOOLS_QUERY_KEY });
    },
  });
}

function cleanSchoolPayload(values: Partial<SchoolFormValues>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? undefined : value,
    ]),
  );
}
