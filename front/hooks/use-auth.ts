"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getRoleRedirectPath, login, logout } from "@/lib/auth";
import type { LoginCredentials } from "@/types/auth";

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => login(credentials),
    onSuccess: (response) => {
      const role = response.user?.role;
      router.replace(role ? getRoleRedirectPath(role) : "/dashboard");
    },
  });

  function signOut() {
    logout();
    queryClient.clear();
    router.replace("/login");
  }

  return {
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: signOut,
  };
}
