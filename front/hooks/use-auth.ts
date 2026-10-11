"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getRoleRedirectPath, login, logout } from "@/lib/auth";
import type { LoginCredentials } from "@/types/auth";

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => login(credentials),
    onMutate: () => queryClient.clear(),
    onSuccess: (response) => {
      queryClient.setQueryData(["current-user"], response.user);
      const role = response.user?.role;
      router.replace(role ? getRoleRedirectPath(role) : "/dashboard");
    },
  });

  async function signOut() {
    try {
      await logout();
      queryClient.clear();
      router.replace("/login");
    } catch {
      toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo.");
    }
  }

  return {
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: signOut,
  };
}
