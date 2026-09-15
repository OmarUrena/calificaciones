"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { School } from "@/types/school";
import type { Teacher } from "@/types/teacher";
import type { User, UserFormValues } from "@/types/user";

export function UserForm({ user, currentUserId, schools, teachers, users, onSave, onCancel }: {
  user?: User;
  currentUserId: string;
  schools: School[];
  teachers: Teacher[];
  users: User[];
  onSave: (values: UserFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const self = user?.id === currentUserId;
  const schema = z.object({
    fullName: z.string().trim().min(1, "El nombre es obligatorio."),
    email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER"]),
    schoolId: z.string(), teacherId: z.string(), isActive: z.boolean(), password: z.string(),
  }).superRefine((values, context) => {
    if (!user && values.password.length < 8) context.addIssue({ code: "custom", path: ["password"], message: "La contraseña debe tener al menos 8 caracteres." });
    if (values.role !== "SUPER_ADMIN" && !values.schoolId) context.addIssue({ code: "custom", path: ["schoolId"], message: "Selecciona una escuela." });
    if (values.role === "TEACHER" && !values.teacherId) context.addIssue({ code: "custom", path: ["teacherId"], message: "Selecciona un maestro." });
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: user?.fullName ?? "", email: user?.email ?? "", role: user?.role ?? "ADMIN",
      schoolId: user?.schoolId ?? "", teacherId: user?.teacherId ?? "", isActive: user?.isActive ?? true, password: "" },
  });
  const role = useWatch({ control, name: "role" });
  const schoolId = useWatch({ control, name: "schoolId" });
  const availableTeachers = teachers.filter((teacher) => teacher.schoolId === schoolId &&
    !users.some((linked) => linked.teacherId === teacher.id && linked.id !== user?.id));
  async function submit(values: Values) {
    setError("");
    try {
      await onSave({ fullName: values.fullName, email: values.email, role: values.role,
        schoolId: values.schoolId || null, teacherId: values.role === "TEACHER" ? values.teacherId : null,
        isActive: values.isActive, ...(!user ? { password: values.password } : {}) });
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar el usuario."); }
  }
  return <form className="admin-card space-y-5" onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
    <h2 className="text-xl font-semibold text-primary">{user ? "Editar usuario" : "Crear usuario"}</h2>
    <fieldset disabled={isSubmitting} className="grid min-w-0 gap-4 md:grid-cols-2">
      <div><label className="form-label" htmlFor="user-name">Nombre completo</label>
        <input id="user-name" className="form-control" autoComplete="name" {...register("fullName")} aria-invalid={Boolean(errors.fullName)} />
        {errors.fullName && <p role="alert" className="form-error">{errors.fullName.message}</p>}</div>
      <div><label className="form-label" htmlFor="user-email">Correo electrónico</label>
        <input id="user-email" className="form-control" autoComplete="off" type="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
        {errors.email && <p role="alert" className="form-error">{errors.email.message}</p>}</div>
      <div><label className="form-label" htmlFor="user-role">Rol</label>
        <select id="user-role" className="form-control" disabled={self} {...register("role")}>
          <option value="ADMIN">Administrador</option><option value="TEACHER">Docente</option><option value="SUPER_ADMIN">Superadministrador</option>
        </select></div>
      <div><label className="form-label" htmlFor="user-school">Escuela{role === "SUPER_ADMIN" ? " (opcional)" : ""}</label>
        <select id="user-school" className="form-control" {...register("schoolId", { onChange: () => setValue("teacherId", "", { shouldDirty: true }) })}>
          <option value="">{role === "SUPER_ADMIN" ? "Sin escuela (global)" : "Selecciona una escuela"}</option>
          {schools.map((school) => <option key={school.id} value={school.id}>{school.name}{!school.isActive ? " (inactiva)" : ""}</option>)}
        </select>{errors.schoolId && <p role="alert" className="form-error">{errors.schoolId.message}</p>}</div>
      {role === "TEACHER" && <div><label className="form-label" htmlFor="user-teacher">Maestro vinculado</label>
        <select id="user-teacher" className="form-control" disabled={!schoolId} {...register("teacherId")}>
          <option value="">Selecciona un maestro</option>
          {availableTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </select>
        <p className="form-help">Solo aparecen maestros de esta escuela sin otro usuario vinculado.</p>
        {errors.teacherId && <p role="alert" className="form-error">{errors.teacherId.message}</p>}</div>}
      {!user && <div><label className="form-label" htmlFor="user-password">Contraseña inicial</label>
        <input id="user-password" className="form-control" type="password" autoComplete="new-password" {...register("password")} />
        <p className="form-help">Mínimo 8 caracteres. La cuenta podrá iniciar sesión al guardarla.</p>
        {errors.password && <p role="alert" className="form-error">{errors.password.message}</p>}</div>}
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#1F4E79]" disabled={self} {...register("isActive")} />Usuario activo</label>
    </fieldset>
    {self && <p className="text-sm text-institutional-gray">No puedes desactivar tu propia cuenta ni cambiar tu propio rol.</p>}
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : user ? "Guardar cambios" : "Crear usuario"}</Button></div>
  </form>;
}
