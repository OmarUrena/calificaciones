# PROGRESS.md

# Avance del 2026-09-09

- Fase 19 implementada en frontend: nueva ruta `/reports` con filtros por ano escolar, curso, periodo y estudiante opcional; permite descargar boletin individual o PDF de todo el curso, muestra estados de carga y bloquea visualmente a docentes que no sean titulares.
- Agregado el acceso a Boletines en la navegacion de TEACHER; los enlaces desde Cursos conservan el curso seleccionado mediante `courseId`.
- Agregados directamente a la base de datos cuatro cursos de prueba (Contabilidad, Mercadeo, Gastronomia y Logistica) y completados los seis cursos con 15 estudiantes cada uno.
- Corregido el acceso a estudiantes desde la tabla de cursos: el enlace ya no apunta a la ruta inexistente `/courses/[id]/students`, sino a `/students?courseId=...`.
- La pantalla de estudiantes lee `courseId` desde la URL y abre la vista con el curso correspondiente seleccionado.
- Al crear un estudiante, el formulario propone automaticamente el siguiente numero de lista del curso seleccionado (ultimo registrado + 1), manteniendo el campo editable.

# Avance del 2026-09-05

- Corregido el entorno local que devolvia `Import job not found` al descargar plantillas: el backend del puerto 3000 seguia ejecutando una version anterior con `npm start` sin recarga. Se reinicio en modo watch y se confirmo en el arranque el registro de `GET /api/imports/template` antes de `GET /api/imports/:id`.
- Nueva prueba HTTP de rutas: `node --test test/imports-routes.test.cjs` pasa; verifica respuesta XLSX, encabezados de descarga, validacion de parametros y que template no se interprete como ID de importacion. Prueba aislada con servicio simulado.
- Verificada la flexibilidad de las plantillas tecnicas: columnas segun los RA activos y su orden, sin cantidad fija. Nuevas pruebas con 1, 4, 8 y 12 RA generan el XLSX, completan sus cuatro columnas por RA y lo pasan por el importador con persistencia simulada. Se comprueban cambios de configuracion entre descargas y rechazo de modulos sin RA activos. Suite de importaciones: 12 pruebas pasan.
- Fase 18 completada: ruta `/imports` con secciones de estudiantes, notas academicas y notas tecnicas; seleccion de curso/asignatura y soporte de enlaces con filtros desde registros, Mis asignaturas y estudiantes.
- Carga Excel con `ImportUploader`, hook `useImportFile`, validacion .xlsx/.xlsm, bloqueo de controles durante el envio e invalidacion de registros y metricas tras procesar la solicitud.
- Resultado con estado, total de filas, filas importadas y filas con error; `ImportErrorsTable` conserva los numeros reales de fila reportados por el backend.
- Plantillas XLSX mediante `GET /imports/template`: academica con 37 columnas, tecnica con los RA activos del modulo, y estudiantes con instrucciones. Las plantillas de notas incluyen los numeros de lista del curso.
- Backend: campos opcionales courseId en importacion de estudiantes y subjectId en notas para validar que las filas coincidan con la seleccion. Las plantillas validan escuela, asignacion activa y permisos del docente antes de consultar estudiantes.
- Backend: archivos vacios, corruptos o de formato incompatible devuelven errores de validacion legibles.
- Verificacion fase 18: lint frontend, lint de archivos backend modificados y builds de ambos proyectos pasan. El build frontend incluye validacion TypeScript y requirio red para Google Fonts.
- Pruebas: 7 casos pasan con `node --test test/imports.test.cjs` desde back/ tras compilar; cubren plantillas, permisos, seleccion, resumen parcial y archivos invalidos. `node test/imports-ui.cjs` pasa con frontend en puerto 3100: ADMIN en escritorio y TEACHER en movil, usando API simulada sin escribir en la base real.
- Pendiente fase 18: prueba con Excel y backend/base de datos reales. Se conserva la limitacion existente de guardado parcial de filas de notas ante errores, explicada en la UI. Las evaluaciones finales academicas requieren al menos una nota de bloque por fila. Sigue pendiente el problema documentado de UUID de los datos seed.
- Corregida la navegacion movil: boton de menu en Topbar y panel lateral modal con las mismas opciones por rol que AppSidebar.
- El panel permite cerrar con boton, Escape, toque fuera o seleccion de enlace; se cierra al pasar a escritorio y bloquea el scroll de fondo mientras esta abierto.
- Se mantiene la barra lateral de escritorio y se identifica el enlace activo con aria-current.
- Verificacion: lint, TypeScript y build de frontend pasan. El build requirio acceso a red para descargar Inter desde Google Fonts.
- Pendiente comprobar visualmente la interaccion en un movil real.

# Avance del 2026-09-03

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
- Fase 17: creada pantalla `/grades/technical` con filtros por curso/modulo, resumen de RA y tabs dinamicos por resultado de aprendizaje.
- Fase 17: implementada edicion inline de ordinaria, recuperacion 1, recuperacion 2 y especial, con nota valida y estado por RA.
- Fase 17: agregado resumen tecnico por estudiante con columnas RA variables, total del modulo y estado calculado.
- Fase 17: agregados accesos separados a calificaciones academicas y tecnicas en la navegacion de ADMIN y TEACHER.

## Backend tocado
- `/auth/me` devuelve `school` y `activeSchoolYear` para mostrar nombre de escuela y ano activo en topbar.
- Se mantuvo `CreateSchoolYearDto.schoolId` con `@IsUUID()` tras revertir cambios temporales.
- `NEXT_PUBLIC_API_URL` quedo apuntando a `/api` por el prefijo global NestJS.
- Se agrego `GET /academic-grades/course/:courseId/subject/:subjectId/register` para entregar de forma autorizada estudiantes, notas y resultados al registro academico.
- La actualizacion academica admite limpiar notas y evaluaciones finales con `null` y recalcula usando el valor actualizado.
- Se agrego `GET /technical-grades/course/:courseId/subject/:subjectId/register` con filtros de escuela, ano, curso, asignatura y permisos docentes.
- La actualizacion tecnica admite limpiar notas con `null` y recalcula usando los valores actualizados.
- El motor tecnico exige la secuencia ordinaria, recuperacion 1 y recuperacion 2 antes de habilitar especial en los RA no aprobados.
- El estado tecnico permanece pendiente durante recuperaciones, pasa a especial cuando corresponde y solo queda reprobado al completar las especiales requeridas sin alcanzar 70.

## Componentes, hooks y tipos
- Layout: `DashboardLayout`, `AppSidebar`, `Topbar`, `RoleBasedNav`.
- Forms: `SchoolForm`, `SchoolYearForm`, `CourseForm`, `StudentForm`, `TeacherForm`, `SubjectForm`, `TechnicalLearningOutcomeForm`, `AssignmentForm`.
- Grades: componentes academicos existentes y `TechnicalGradeEditor`, `TechnicalGradeTable`, `TechnicalRaTabs`, `TechnicalOutcomeSummary`, `TechnicalSummaryTable` y `GradeStatusBadge`.
- Hooks: auth/current user, schools, school-years, courses, teachers, users, students, subjects, RA tecnicos, asignaciones, calificaciones academicas, calificaciones tecnicas y dashboard-stats.
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
- El editor tecnico bloquea el cambio de tab si hay filas sin guardar para evitar perder borradores o mezclar reglas de especial con datos aun no persistidos.

## Verificacion
- `npm run lint` y `npm run build` han pasado varias veces en `front/`.
- `npm run build` paso en `back/` despues de los cambios de auth.
- `npm run lint` y `npm run build` pasan en `front/` despues de fases 11 y 12.
- `npm run lint` y `npm run build` pasan en `front/` despues de fase 13.
- `npm run lint` y `npm run build` pasan en `front/` despues de fase 14.
- `npm run lint`, `tsc --noEmit`, build de frontend y build de backend pasan despues de fase 16.
- `npm run lint`, `tsc --noEmit` y `npm run build` pasan en `front/` despues de fase 17.
- El lint especifico y `npm run build` pasan en `back/` despues de los ajustes tecnicos de fase 17.

## Pendientes y riesgos
- Falta prueba manual de CRUD para maestros, asignaturas, RA tecnicos y asignaciones contra backend real.
- Los IDs del seed actual no pasan `@IsUUID()` estricto; afecta recursos que envian IDs seed.
- En estudiantes y maestros, eliminar usa `DELETE`; no existe desactivacion todavia.
- Falta prueba manual del registro tecnico de fase 17 contra el backend en ejecucion.
- Fase 18 implementada el 2026-09-05; quedan fase 19 en adelante: boletines, settings, pulido y pruebas manuales.
