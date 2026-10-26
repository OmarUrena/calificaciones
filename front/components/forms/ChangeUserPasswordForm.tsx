"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { User } from "@/types/user";

const schema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string().min(1, "Confirma la nueva contraseña."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"], message: "Las contraseñas no coinciden.",
});

export function ChangeUserPasswordForm({ user, onSave, onCancel }: {
  user: User;
  onSave: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { password: "", confirmPassword: "" },
  });

  async function submit(values: z.infer<typeof schema>) {
    setError("");
    try { await onSave(values.password); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo cambiar la contraseña."); }
  }

  return <form className="admin-card space-y-4" onSubmit={handleSubmit(submit)} aria-busy={isSubmitting} noValidate>
    <div>
      <h2 className="text-xl font-semibold text-primary">Cambiar contraseña</h2>
      <p className="mt-1 break-words text-sm text-institutional-gray">{user.fullName} · {user.email}</p>
    </div>
    <fieldset disabled={isSubmitting} className="grid min-w-0 gap-4 md:grid-cols-2">
      <div>
        <label className="form-label" htmlFor="new-user-password">Nueva contraseña</label>
        <input id="new-user-password" className="form-control" type="password" autoComplete="new-password" autoFocus
          {...register("password")} aria-invalid={Boolean(errors.password)} aria-describedby="new-user-password-help new-user-password-error" />
        <p id="new-user-password-help" className="form-help">Mínimo 8 caracteres. Se aplicará al guardar.</p>
        {errors.password && <p id="new-user-password-error" role="alert" className="form-error">{errors.password.message}</p>}
      </div>
      <div>
        <label className="form-label" htmlFor="confirm-user-password">Confirmar nueva contraseña</label>
        <input id="confirm-user-password" className="form-control" type="password" autoComplete="new-password"
          {...register("confirmPassword")} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby="confirm-user-password-error" />
        {errors.confirmPassword && <p id="confirm-user-password-error" role="alert" className="form-error">{errors.confirmPassword.message}</p>}
      </div>
    </fieldset>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar contraseña"}</Button>
    </div>
  </form>;
}
