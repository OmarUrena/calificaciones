"use client";

import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "@/lib/auth";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
}
