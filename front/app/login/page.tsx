"use client";

import { GraduationCap, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await login({ email, password });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "No se pudo iniciar sesión.";
      toast.error(message);
    }
  }

  return (
    <main className="institutional-page flex items-center justify-center px-6 py-12">
      <section className="admin-card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-institutional-blue-light text-primary">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="institutional-title">CalifApp</h1>
          <p className="institutional-subtitle">Inicia sesión para continuar</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-institutional-gray-dark">
              Correo
            </span>
            <input
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-institutional-gray-dark">
              Contraseña
            </span>
            <input
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <Button className="h-10 w-full" disabled={isLoggingIn} type="submit">
            {isLoggingIn ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Iniciando...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </form>
      </section>
    </main>
  );
}
