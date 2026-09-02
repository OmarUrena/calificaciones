# PROGRESS.md

# Avance del 2026-07-01

## Contexto
- Base del trabajo: `front/FRONTEND_CONTEXT.md`, `front/FRONTEND_PLAN.md` y `back/PROJECT_CONTEXT.md`.
- Regla actual: antes de implementar cualquier cosa, leer este archivo.
- Regla actual: cada cambio nuevo debe quedar registrado aqui de forma resumida.

## Frontend completado
- Fase 1: Next.js + TypeScript + Tailwind + shadcn/ui inicializados en `front/`.
- Fase 1: instaladas dependencias principales: TanStack Query/Table, RHF, Zod, Lucide, Sonner y Supabase.
- Fase 2: estilo institucional azul/gris, componentes base, tablas compactas, tarjetas, botones y badges.
- Mejora visual: fuente global Inter y texto general mas grande para mejor legibilidad.
- Fase 3: `lib/api.ts` centralizado con Bearer token, manejo de errores, descarga Blob PDF y upload FormData.
- Fase 4: login Supabase, token local, `/auth/me`, logout, providers y rutas privadas.
- Fase 5: layout privado con sidebar, topbar, navegacion por rol y cierre de sesion.
- Fase 6: dashboard inicial con `StatCard` y metricas basicas por rol.
- Fase 7: CRUD de escuelas en `/schools` con TanStack Table y `SchoolForm`.
- Fase 8: CRUD de anos escolares en `/school-years`, incluyendo activar ano escolar.
- Fase 9: CRUD de cursos en `/courses` con titular, ano escolar, estudiantes y enlaces a boletines.
- Fase 10: CRUD de estudiantes en `/students` con filtro por curso, tabla y `StudentForm`.
- Fase 11: iniciada con `TeacherForm`, hooks de maestros con mutaciones, `useUsers` y tipo `User`.
- Fase 11: creada pantalla `/teachers` con TanStack Table, usuario vinculado, cursos titulares y acciones.
- Fase 12: creada base de asignaturas con tipo `Subject`, hook `useSubjects`, `SubjectForm` y ruta `/subjects`.
- Fase 12: tabla con TanStack Table, tipo academica/tecnica, estado activa/inactiva y enlace a RA tecnicos.
- Fase 13: creada configuracion de RA tecnicos en `/subjects/[id]/technical-outcomes`.
- Fase 13: RA tecnicos incluyen codigo, nombre, orden, peso, minimo 70%, estado y total de pesos.
- Fase 14: creada base de asignaciones docentes en `/assignments`.
- Fase 14: asignaciones relacionan ano escolar, curso, asignatura y maestro, con estado activo/inactivo.
- Fase 14: se agrego validacion visual para evitar repetir curso + asignatura + ano escolar activos.
- Fase 15: creada vista `/my-subjects` para docentes con asignaciones activas del ano escolar actual.
- Fase 15: agregados accesos a registro e importacion de notas segun asignatura academica o tecnica.
- Fase 16: creada pantalla `/grades/academic` con filtros por curso/asignatura y tabs para cuatro bloques y resumen.
- Fase 16: implementada edicion inline de P1-RP4, validaciones de recuperacion, vista previa de PC y guardado por bloque.
- Fase 16: implementado resumen PC1-PC4, CF, CEC, CCF, CEEX, CEXF, CE, CEF y estados academicos.

## Backend tocado
- `/auth/me` devuelve `school` y `activeSchoolYear` para mostrar nombre de escuela y ano activo en topbar.
- Se mantuvo `CreateSchoolYearDto.schoolId` con `@IsUUID()` tras revertir cambios temporales.
- `NEXT_PUBLIC_API_URL` quedo apuntando a `/api` por el prefijo global NestJS.
- Se agrego `GET /academic-grades/course/:courseId/subject/:subjectId/register` para entregar de forma autorizada estudiantes, notas y resultados al registro academico.
- La actualizacion academica admite limpiar notas y evaluaciones finales con `null` y recalcula usando el valor actualizado.

## Componentes, hooks y tipos
- Layout: `DashboardLayout`, `AppSidebar`, `Topbar`, `RoleBasedNav`.
- Forms: `SchoolForm`, `SchoolYearForm`, `CourseForm`, `StudentForm`, `TeacherForm`, `SubjectForm`, `TechnicalLearningOutcomeForm`, `AssignmentForm`.
- Grades: `AcademicGradeEditor`, `AcademicGradeTable`, `AcademicBlockTabs`, `AcademicSummaryTable` y `GradeStatusBadge`.
- Hooks: auth/current user, schools, school-years, courses, teachers, users, students, subjects, RA tecnicos, asignaciones, calificaciones academicas y dashboard-stats.
- Types: `auth`, `api`, `school`, `school-year`, `course`, `teacher`, `user`, `student`, `subject`, `technical-learning-outcome`, `assignment` y `grades`.

## Correcciones importantes
- La autenticacion rechaza usuarios ADMIN y TEACHER vinculados a una escuela inactiva.
- Un login rechazado por el backend limpia el token y la cookie creados por Supabase.
- Se corrigio el freeze en `/students` al filtrar por curso usando datos derivados memoizados.
- En `/teachers` se usaron arrays/mapas estables para evitar el mismo problema con TanStack Table.
- En `/subjects` se usa array vacio estable para TanStack Table.
- En RA tecnicos se muestra alerta si la suma de pesos activos no da 100.
- En `TechnicalLearningOutcomeForm` se usan numeros explicitos con `valueAsNumber` para evitar errores de tipado.
- En `/assignments` se puede filtrar por `teacherId` desde los enlaces de maestros.
- En `AssignmentForm` se usa `useWatch` para evitar warning de React Hook Form en lint.
- El topbar muestra nombre de escuela, no ID.
- Los formularios fueron estilizados con inputs estandar en lugar de controles por defecto.

## Verificacion
- `npm run lint` y `npm run build` han pasado varias veces en `front/`.
- `npm run build` paso en `back/` despues de los cambios de auth.
- `npm run lint` y `npm run build` pasan en `front/` despues de fases 11 y 12.
- `npm run lint` y `npm run build` pasan en `front/` despues de fase 13.
- `npm run lint` y `npm run build` pasan en `front/` despues de fase 14.
- `npm run lint`, `tsc --noEmit`, build de frontend y build de backend pasan despues de fase 16.

## Pendientes y riesgos
- Falta prueba manual de CRUD para maestros, asignaturas, RA tecnicos y asignaciones contra backend real.
- Los IDs del seed actual no pasan `@IsUUID()` estricto; afecta recursos que envian IDs seed.
- En estudiantes y maestros, eliminar usa `DELETE`; no existe desactivacion todavia.
- Falta fase 17 en adelante: calificaciones tecnicas, importaciones, boletines y settings.
