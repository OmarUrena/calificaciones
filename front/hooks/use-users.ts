"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { User, UserFormValues } from "@/types/user";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
  });
}

export function useUserMutations() {
  const client = useQueryClient();
  function refresh() {
    for (const key of ["users", "teachers", "current-user", "dashboard-stats"]) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  }
  const create = useMutation({ mutationFn: (values: UserFormValues) => apiFetch<User>("/users", {
    method: "POST", body: JSON.stringify({ ...values, schoolId: values.schoolId ?? undefined, teacherId: values.teacherId ?? undefined }),
  }), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: Partial<UserFormValues> }) => apiFetch<User>(`/users/${id}`, {
    method: "PATCH", body: JSON.stringify(values),
  }), onSuccess: refresh });
  return { create, update };
}
