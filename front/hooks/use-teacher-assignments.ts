"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { TeacherAssignment, TeacherAssignmentFormValues } from "@/types/assignment";

const ASSIGNMENTS_QUERY_KEY = ["assignments"];

export function useTeacherAssignments() {
  return useQuery({
    queryKey: ASSIGNMENTS_QUERY_KEY,
    queryFn: () => apiFetch<TeacherAssignment[]>("/teacher-assignments"),
  });
}

export function useCreateTeacherAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: TeacherAssignmentFormValues & { schoolId: string }) =>
      apiFetch<TeacherAssignment>("/teacher-assignments", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateTeacherAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Partial<TeacherAssignmentFormValues>;
    }) =>
      apiFetch<TeacherAssignment>(`/teacher-assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeactivateTeacherAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<TeacherAssignment>(`/teacher-assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
