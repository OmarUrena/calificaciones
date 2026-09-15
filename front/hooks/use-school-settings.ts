"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, uploadFile } from "@/lib/api";
import type { School } from "@/types/school";

export type SchoolSettingsValues = Pick<School, "name" | "code"> & {
  address: string;
  phone: string;
};

export function useSchoolSettings(schoolId: string) {
  return useQuery({
    queryKey: ["school-settings", schoolId],
    queryFn: () => apiFetch<School>(`/schools/${schoolId}`),
    enabled: Boolean(schoolId),
  });
}

export function useSaveSchoolSettings(schoolId: string) {
  const queryClient = useQueryClient();
  function refresh(school: School) {
    queryClient.setQueryData(["school-settings", schoolId], school);
    void queryClient.invalidateQueries({ queryKey: ["schools"] });
    void queryClient.invalidateQueries({ queryKey: ["current-user"] });
  }
  const save = useMutation({
    mutationFn: (values: SchoolSettingsValues) => apiFetch<School>(`/schools/${schoolId}`, {
      method: "PATCH",
      // Preserve empty optional fields so the user can clear them.
      body: JSON.stringify(values),
    }),
    onSuccess: refresh,
  });
  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadFile<School>(`/schools/${schoolId}/logo`, { file }),
    onSuccess: refresh,
  });
  return { save, uploadLogo };
}
