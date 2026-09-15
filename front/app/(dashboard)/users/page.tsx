"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/components/forms/UserForm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUsers, useUserMutations } from "@/hooks/use-users";
import { useSchools } from "@/hooks/use-schools";
import { useTeachers } from "@/hooks/use-teachers";
import type { User, UserFormValues } from "@/types/user";

const ROLE_LABELS = { SUPER_ADMIN: "Superadministrador", ADMIN: "Administrador", TEACHER: "Docente" };
const EMPTY_USERS: User[] = [];

export default function UsersPage() {
  const current = useCurrentUser();
  if (current.isLoading) return <p role="status" className="admin-card">Cargando usuario...</p>;
  if (current.data?.role !== "SUPER_ADMIN") return <p role="alert" className="admin-card">Solo el superadministrador puede acceder a la gestión de usuarios.</p>;
  return <UsersContent currentUserId={current.data.id} />;
}

function UsersContent({ currentUserId }: { currentUserId: string }) {
  const usersQuery = useUsers();
  const schoolsQuery = useSchools();
  const teachersQuery = useTeachers();
  const mutations = useUserMutations();
  const [editor, setEditor] = useState<User | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const users = usersQuery.data ?? EMPTY_USERS;
  const schoolNames = useMemo(() => new Map(schoolsQuery.data?.map((school) => [school.id, school.name])), [schoolsQuery.data]);
  const teacherNames = useMemo(() => new Map(teachersQuery.data?.map((teacher) => [teacher.id, teacher.name])), [teachersQuery.data]);
  const filtered = useMemo(() => users.filter((user) =>
    (!search.trim() || `${user.fullName} ${user.email}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))) &&
    (!schoolId || (schoolId === "global" ? !user.schoolId : user.schoolId === schoolId)) &&
    (!role || user.role === role) && (!status || user.isActive === (status === "active"))
  ), [users, search, schoolId, role, status]);
  const columns = useMemo<ColumnDef<User>[]>(() => [
    { accessorKey: "fullName", header: "Nombre" },
    { accessorKey: "email", header: "Correo electrónico" },
    { accessorKey: "role", header: "Rol", cell: ({ row }) => ROLE_LABELS[row.original.role] },
    { id: "school", header: "Escuela", cell: ({ row }) => row.original.schoolId ? schoolNames.get(row.original.schoolId) ?? "Escuela no disponible" : "Global" },
    { id: "teacher", header: "Maestro", cell: ({ row }) => row.original.teacherId ? teacherNames.get(row.original.teacherId) ?? "Maestro no disponible" : "—" },
    { accessorKey: "isActive", header: "Estado", cell: ({ row }) => <span className={row.original.isActive ? "text-green-800" : "text-institutional-gray"}>{row.original.isActive ? "Activo" : "Inactivo"}</span> },
  ], [schoolNames, teacherNames]);
  // TanStack Table manages its own mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 10 } } });
  const busy = mutations.create.isPending || mutations.update.isPending;
  const loading = usersQuery.isLoading || schoolsQuery.isLoading || teachersQuery.isLoading;
  const error = usersQuery.error ?? schoolsQuery.error ?? teachersQuery.error;
  async function save(values: UserFormValues) {
    try {
      if (editor && editor !== "new") await mutations.update.mutateAsync({ id: editor.id, values });
      else await mutations.create.mutateAsync(values);
      setEditor(null);
      toast.success("Usuario guardado.");
    } finally { mutations.create.reset(); }
  }
  async function toggle(user: User) {
    try {
      await mutations.update.mutateAsync({ id: user.id, values: { isActive: !user.isActive } });
      toast.success(user.isActive ? "Usuario desactivado." : "Usuario activado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado."); }
  }
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="institutional-title">Usuarios</h1><p className="institutional-subtitle">Gestiona las cuentas de acceso, roles y escuelas de los usuarios.</p></div>
      <Button disabled={loading || Boolean(error) || busy || Boolean(editor)} onClick={() => setEditor("new")}><Plus aria-hidden="true" />Crear usuario</Button></div>
    {loading && <p role="status" className="admin-card">Cargando usuarios, escuelas y maestros...</p>}
    {error && <div role="alert" className="admin-card text-red-800"><p>{error.message}</p><Button variant="outline" onClick={() => { void usersQuery.refetch(); void schoolsQuery.refetch(); void teachersQuery.refetch(); }}>Reintentar</Button></div>}
    {editor && !loading && !error && <UserForm key={editor === "new" ? "new" : editor.id} user={editor === "new" ? undefined : editor} currentUserId={currentUserId}
      schools={schoolsQuery.data ?? []} teachers={teachersQuery.data ?? []} users={users} onSave={save} onCancel={() => setEditor(null)} />}
    <div className="admin-card grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div><label htmlFor="users-search" className="form-label">Buscar</label><input id="users-search" className="form-control" placeholder="Nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div><label htmlFor="users-school-filter" className="form-label">Filtrar por escuela</label><select id="users-school-filter" className="form-control" value={schoolId} onChange={(event) => setSchoolId(event.target.value)}><option value="">Todas</option><option value="global">Sin escuela (global)</option>{schoolsQuery.data?.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
      <div><label htmlFor="users-role-filter" className="form-label">Filtrar por rol</label><select id="users-role-filter" className="form-control" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Todos</option>{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div><label htmlFor="users-status-filter" className="form-label">Filtrar por estado</label><select id="users-status-filter" className="form-control" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div>
    </div>
    {!loading && !error && <div className="admin-card space-y-4">
      <p className="text-sm text-institutional-gray">{filtered.length} usuario(s)</p>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><caption className="sr-only">Usuarios del sistema</caption>
        <thead className="bg-institutional-blue-light">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} scope="col" className="border border-border px-3 py-3">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}<th scope="col" className="border border-border px-3 py-3">Acciones</th></tr>)}</thead>
        <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>
          {row.getVisibleCells().map((cell) => <td key={cell.id} className="border border-border px-3 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
          <td className="border border-border px-3 py-3"><div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy || Boolean(editor)} onClick={() => { setEditor(row.original); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</Button>
            <Button size="sm" variant="outline" disabled={busy || Boolean(editor) || row.original.id === currentUserId} onClick={() => void toggle(row.original)}>{row.original.isActive ? "Desactivar" : "Activar"}</Button>
          </div></td></tr>)}</tbody></table></div>
      {filtered.length === 0 && <div className="py-6 text-center text-institutional-gray"><UsersRound className="mx-auto mb-2" aria-hidden="true" />No hay usuarios que coincidan con los filtros.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm">Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}</span><div className="flex gap-2"><Button variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Anterior</Button><Button variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Siguiente</Button></div></div>
    </div>}
  </section>;
}
