# FRONTEND_PLAN.md

# Plan de trabajo para implementar el frontend de CalifApp

## Stack definido

Frontend: Next.js
Lenguaje: TypeScript
Estilos: Tailwind CSS
Componentes UI: shadcn/ui
Tablas: TanStack Table
Estado servidor: TanStack Query
Formularios: React Hook Form
Validación: Zod
Iconos: Lucide React
PDF: generado por backend y descargado desde frontend
Ubicación del proyecto: `front/`

---

# Fase 1: Inicialización del proyecto frontend

## Objetivo

Crear la aplicación frontend dentro de la carpeta `front/` con Next.js, TypeScript, Tailwind CSS y shadcn/ui.

## Tareas

1. Verificar que el proyecto se cree dentro de `front/`.
2. Inicializar Next.js con TypeScript.
3. Configurar Tailwind CSS.
4. Instalar y configurar shadcn/ui.
5. Instalar dependencias principales:

   * `@tanstack/react-query`
   * `@tanstack/react-table`
   * `react-hook-form`
   * `zod`
   * `@hookform/resolvers`
   * `lucide-react`
   * `sonner` o sistema similar para notificaciones.
6. Configurar variables de entorno:

   * `NEXT_PUBLIC_API_URL`
7. Crear estructura base de carpetas:

   * `app/`
   * `components/`
   * `lib/`
   * `hooks/`
   * `types/`

## Criterios de aceptación

* El proyecto corre con `npm run dev`.
* Tailwind funciona correctamente.
* shadcn/ui está configurado.
* Existe una estructura base limpia dentro de `front/`.
* No se crea otra app fuera de `front/`.

---

# Fase 2: Configuración visual institucional

## Objetivo

Aplicar el estilo visual formal institucional de CalifApp.

## Tareas

1. Configurar paleta azul y gris en Tailwind.
2. Definir estilos globales.
3. Crear clases utilitarias para:

   * Encabezados institucionales.
   * Tablas compactas.
   * Botones primarios.
   * Tarjetas administrativas.
   * Badges de estado.
4. Evitar tema oscuro.
5. Mantener una estética similar a Bootstrap:

   * limpia,
   * sobria,
   * institucional,
   * con bordes suaves,
   * fondos claros.

## Paleta sugerida

* Azul principal: `#1F4E79`
* Azul medio: `#B7D3EA`
* Azul claro: `#D9EAF7`
* Gris oscuro: `#374151`
* Gris medio: `#6B7280`
* Gris claro: `#F3F4F6`
* Fondo: `#F8FAFC`
* Bordes: `#D1D5DB`
* Blanco: `#FFFFFF`

## Criterios de aceptación

* La aplicación tiene apariencia formal.
* No hay tema oscuro.
* Los colores principales son azul y gris.
* Las tablas se ven similares a registros escolares.

---

# Fase 3: Cliente API y configuración de comunicación con backend

## Objetivo

Crear una capa centralizada para consumir la API del backend NestJS.

## Tareas

1. Crear `lib/api.ts`.
2. Configurar base URL desde `NEXT_PUBLIC_API_URL`.
3. Crear helper `apiFetch`.
4. Adjuntar token de autenticación en cada petición.
5. Manejar errores comunes:

   * 401 no autenticado.
   * 403 sin permiso.
   * 404 no encontrado.
   * 422 o 400 validación.
   * 500 error de servidor.
6. Crear helper para descargar PDF como Blob.
7. Crear helper para subir archivos Excel con `FormData`.

## Criterios de aceptación

* Todas las peticiones pasan por `lib/api.ts`.
* Las descargas PDF funcionan con Blob.
* Las subidas Excel funcionan con `multipart/form-data`.
* Los errores se muestran de forma clara al usuario.

---

# Fase 4: Autenticación frontend

## Objetivo

Implementar login, sesión de usuario y protección de rutas.

## Tareas

1. Crear pantalla `/login`.
2. Crear formulario con:

   * correo,
   * contraseña,
   * botón iniciar sesión.
3. Crear `hooks/use-auth.ts`.
4. Crear `hooks/use-current-user.ts`.
5. Crear `lib/auth.ts`.
6. Consumir endpoint `/auth/login`.
7. Consumir endpoint `/auth/me`.
8. Guardar token de sesión.
9. Implementar logout.
10. Redirigir según rol:

    * `SUPER_ADMIN` → `/schools`
    * `ADMIN` → `/dashboard`
    * `TEACHER` → `/my-subjects`
11. Proteger rutas privadas.
12. Evitar que usuarios no autenticados entren al dashboard.

## Criterios de aceptación

* El usuario puede iniciar sesión.
* El sistema obtiene el usuario actual.
* El menú cambia según rol.
* Las rutas privadas están protegidas.
* El usuario puede cerrar sesión.

---

# Fase 5: Layout principal y navegación por rol

## Objetivo

Crear el panel administrativo principal de CalifApp.

## Tareas

1. Crear `DashboardLayout`.
2. Crear `AppSidebar`.
3. Crear `Topbar`.
4. Crear `RoleBasedNav`.
5. Mostrar en el Topbar:

   * nombre CalifApp,
   * escuela activa,
   * año escolar activo,
   * usuario,
   * rol,
   * cerrar sesión.
6. Crear menús según rol.

## Menú SUPER_ADMIN

* Escuelas
* Usuarios
* Configuración

## Menú ADMIN

* Dashboard
* Año escolar
* Cursos
* Estudiantes
* Maestros
* Asignaturas
* Asignaciones docentes
* Calificaciones
* Importaciones
* Boletines
* Configuración

## Menú TEACHER

* Mis asignaturas
* Calificaciones
* Importar calificaciones
* Boletines, solo si es titular

## Criterios de aceptación

* El layout se ve institucional.
* El sidebar cambia por rol.
* El usuario siempre sabe en qué escuela y año escolar está.
* La navegación es clara y consistente.

---

# Fase 6: Dashboard inicial

## Objetivo

Crear una pantalla de resumen para usuarios administrativos y docentes.

## Tareas

1. Crear ruta `/dashboard`.
2. Para ADMIN mostrar tarjetas:

   * año escolar activo,
   * cursos,
   * estudiantes,
   * maestros,
   * asignaturas,
   * cursos sin titular,
   * calificaciones incompletas.
3. Para TEACHER mostrar:

   * asignaturas que imparte,
   * cursos donde imparte,
   * cursos donde es titular,
   * acceso rápido a calificaciones.
4. Crear componente `StatCard`.

## Criterios de aceptación

* El dashboard muestra información útil.
* Las tarjetas tienen diseño azul/gris.
* El docente ve solo información propia.
* El admin ve información general de su escuela.

---

# Fase 7: CRUD de escuelas

## Objetivo

Permitir que SUPER_ADMIN gestione escuelas.

## Ruta

`/schools`

## Tareas

1. Crear tabla de escuelas.
2. Crear formulario `SchoolForm`.
3. Crear acciones:

   * crear,
   * editar,
   * activar/desactivar,
   * ver detalle.
4. Mostrar:

   * nombre,
   * código,
   * estado,
   * acciones.
5. Permitir cargar logo si el backend ya lo soporta.

## Criterios de aceptación

* Solo SUPER_ADMIN accede.
* Se puede crear y editar una escuela.
* La tabla se ve limpia.
* El estado de la escuela se muestra claramente.

---

# Fase 8: CRUD de año escolar

## Objetivo

Permitir que ADMIN gestione años escolares de su escuela.

## Ruta

`/school-years`

## Tareas

1. Crear tabla de años escolares.
2. Crear formulario `SchoolYearForm`.
3. Crear acción para activar año escolar.
4. Mostrar:

   * nombre,
   * estado,
   * acciones.
5. Indicar claramente cuál es el año activo.

## Criterios de aceptación

* Solo ADMIN accede.
* Se puede crear año escolar.
* Se puede activar un año escolar.
* Solo un año aparece como activo.

---

# Fase 9: CRUD de cursos

## Objetivo

Gestionar cursos y maestro titular.

## Ruta

`/courses`

## Tareas

1. Crear tabla de cursos.
2. Crear formulario `CourseForm`.
3. Campos:

   * nombre,
   * grado,
   * sección,
   * área,
   * modalidad,
   * maestro titular.
4. Acciones:

   * crear,
   * editar,
   * asignar titular,
   * ver estudiantes,
   * generar boletines.
5. Mostrar tabla:

   * curso,
   * grado,
   * sección,
   * área,
   * modalidad,
   * titular,
   * acciones.

## Criterios de aceptación

* ADMIN puede gestionar cursos.
* El titular se muestra claramente.
* Cursos sin titular se identifican visualmente.
* El curso puede usarse luego en estudiantes, asignaciones y boletines.

---

# Fase 10: CRUD de estudiantes

## Objetivo

Gestionar estudiantes con número de lista.

## Ruta

`/students`

## Tareas

1. Crear filtro por curso.
2. Crear tabla de estudiantes.
3. Crear formulario `StudentForm`.
4. Campos:

   * número de lista,
   * nombres,
   * apellidos,
   * curso.
5. Acciones:

   * crear,
   * editar,
   * eliminar/desactivar,
   * importar estudiantes.
6. Mostrar tabla:

   * No.,
   * nombres,
   * apellidos,
   * curso,
   * acciones.

## Criterios de aceptación

* El número de lista aparece en la primera columna.
* Se puede filtrar por curso.
* No se repiten números de lista dentro del mismo curso.
* La tabla es compacta y clara.

---

# Fase 11: CRUD de maestros

## Objetivo

Gestionar maestros.

## Ruta

`/teachers`

## Tareas

1. Crear tabla de maestros.
2. Crear formulario `TeacherForm`.
3. Campo principal:

   * nombre.
4. Mostrar:

   * nombre,
   * usuario vinculado,
   * cursos titulares,
   * acciones.
5. Acciones:

   * crear,
   * editar,
   * vincular usuario si aplica,
   * ver asignaciones.

## Criterios de aceptación

* ADMIN puede crear maestros.
* El sistema muestra si el maestro tiene usuario.
* El sistema muestra si es titular de cursos.

---

# Fase 12: CRUD de asignaturas

## Objetivo

Gestionar asignaturas académicas y técnicas.

## Ruta

`/subjects`

## Tareas

1. Crear tabla de asignaturas.
2. Crear formulario `SubjectForm`.
3. Campos:

   * nombre,
   * tipo,
   * estado.
4. Tipos:

   * ACADEMIC,
   * TECHNICAL.
5. Mostrar visualmente:

   * Académica,
   * Técnica.
6. Acciones:

   * crear,
   * editar,
   * activar/desactivar,
   * configurar RA si es técnica.

## Criterios de aceptación

* ADMIN puede crear asignaturas.
* Las asignaturas se clasifican como académicas o técnicas.
* Las asignaturas técnicas tienen acceso a configuración de RA.

---

# Fase 13: Configuración de RA técnicos

## Objetivo

Permitir configurar los Resultados de Aprendizaje de asignaturas técnicas.

## Ruta

`/subjects/:id/technical-outcomes`

## Tareas

1. Crear tabla de RA.
2. Crear formulario para RA.
3. Campos:

   * código,
   * nombre,
   * orden,
   * peso.
4. Mostrar:

   * orden,
   * código,
   * nombre,
   * peso,
   * mínimo 70%,
   * acciones.
5. Mostrar suma de pesos:

   * ejemplo: `Total: 80 / 100`.
6. Mostrar alerta si la suma no da 100.

## Criterios de aceptación

* Solo asignaturas técnicas permiten RA.
* Se puede crear, editar y eliminar RA.
* Se muestra el mínimo de cada RA.
* Se alerta si la suma de pesos no da 100.

---

# Fase 14: Asignaciones docentes

## Objetivo

Definir qué maestro imparte qué asignatura en qué curso.

## Ruta

`/assignments`

## Tareas

1. Crear tabla de asignaciones.
2. Crear formulario `AssignmentForm`.
3. Campos:

   * curso,
   * asignatura,
   * maestro.
4. Mostrar:

   * curso,
   * asignatura,
   * tipo,
   * maestro,
   * acciones.
5. Acciones:

   * crear,
   * editar/cambiar maestro,
   * eliminar/desactivar.

## Validación visual

No se debe permitir repetir la misma combinación:

```text
curso + asignatura + año escolar
```

## Criterios de aceptación

* ADMIN puede asignar docentes.
* No se repite la misma asignatura en el mismo curso con dos maestros.
* La asignación sirve para permisos del docente.

---

# Fase 15: Vista “Mis asignaturas”

## Objetivo

Permitir que el docente vea solo las asignaturas que imparte.

## Ruta

`/my-subjects`

## Tareas

1. Consultar asignaciones del docente actual.
2. Mostrar tabla o tarjetas:

   * curso,
   * asignatura,
   * tipo,
   * acciones.
3. Acciones:

   * registrar notas,
   * importar notas.
4. Si tipo es ACADEMIC, ir a calificaciones académicas.
5. Si tipo es TECHNICAL, ir a calificaciones técnicas.

## Criterios de aceptación

* El docente solo ve sus asignaturas.
* No ve asignaturas de otros docentes.
* Puede acceder rápido al registro de notas.

---

# Fase 16: Calificaciones académicas

## Objetivo

Crear la pantalla de registro académico por bloques.

## Ruta

`/grades/academic?courseId=...&subjectId=...`

## Tareas

1. Crear filtros:

   * curso,
   * asignatura.
2. Crear tabs:

   * Bloque 1,
   * Bloque 2,
   * Bloque 3,
   * Bloque 4,
   * Resumen.
3. En cada bloque mostrar tabla:

   * No.,
   * estudiante,
   * P1,
   * RP1,
   * P2,
   * RP2,
   * P3,
   * RP3,
   * P4,
   * RP4,
   * PC.
4. Crear edición inline de notas.
5. Crear botón guardar.
6. Validar:

   * notas entre 0 y 100,
   * RP no menor que P,
   * RP solo aplica si P < 70 o mostrar aviso si no aplica.
7. Mostrar PC con una cifra decimal.
8. Crear tab Resumen:

   * No.,
   * estudiante,
   * PC1,
   * PC2,
   * PC3,
   * PC4,
   * CF,
   * CEC,
   * CCF,
   * CEEX,
   * CEXF,
   * CE,
   * CEF,
   * Estado.
9. Mostrar badges de estado.

## Criterios de aceptación

* La tabla es compacta y usable.
* Se pueden editar notas.
* Se muestran PC y CF correctamente.
* Se validan errores antes de guardar.
* El docente solo puede entrar si imparte esa asignatura.
* El ADMIN puede entrar a todas las asignaturas de su escuela.

---

# Fase 17: Calificaciones técnicas

## Objetivo

Crear la pantalla de registro técnico por RA.

## Ruta

`/grades/technical?courseId=...&subjectId=...`

## Tareas

1. Crear filtros:

   * curso,
   * módulo técnico.
2. Mostrar resumen de RA:

   * código,
   * peso,
   * mínimo 70%.
3. Crear tabs:

   * RA1,
   * RA2,
   * RA3,
   * RA4,
   * Resumen.
4. En cada RA mostrar tabla:

   * No.,
   * estudiante,
   * ordinaria,
   * recuperación 1,
   * recuperación 2,
   * especial,
   * nota válida,
   * estado RA.
5. Validar:

   * nota no mayor al peso,
   * recuperación 1 no menor que ordinaria,
   * recuperación 2 no menor que recuperación 1,
   * especial solo cuando aplica.
6. En Resumen mostrar:

   * No.,
   * estudiante,
   * RA1,
   * RA2,
   * RA3,
   * RA4,
   * total,
   * estado.
7. Mostrar total del módulo.
8. Mostrar badges de estado.

## Criterios de aceptación

* La pantalla se adapta a cantidad variable de RA.
* Se visualiza el peso y mínimo de cada RA.
* Se calculan totales visualmente.
* Se validan notas antes de guardar.
* El docente solo puede editar sus módulos.
* El ADMIN puede editar todos los módulos de su escuela.

---

# Fase 18: Importaciones desde Excel

## Objetivo

Permitir importar estudiantes y calificaciones.

## Ruta

`/imports`

## Tareas

1. Crear tabs:

   * Estudiantes,
   * Calificaciones académicas,
   * Calificaciones técnicas.
2. Crear componente `ImportUploader`.
3. Crear selector de curso.
4. Crear selector de asignatura cuando aplique.
5. Crear botón para descargar plantilla.
6. Crear subida de archivo Excel.
7. Mostrar resultado:

   * total filas,
   * filas importadas,
   * filas con error.
8. Mostrar tabla de errores por fila.
9. Para TEACHER, mostrar solo sus asignaturas.
10. Para ADMIN, mostrar todas las asignaturas.

## Criterios de aceptación

* Se puede subir un Excel.
* Se muestra resultado claro.
* Se muestran errores por fila.
* Los docentes no pueden importar notas de asignaturas ajenas.

---

# Fase 19: Boletines PDF

## Objetivo

Permitir generar boletines PDF.

## Ruta

`/reports`

## Tareas

1. Crear filtros:

   * año escolar,
   * curso,
   * período,
   * estudiante opcional.
2. Períodos:

   * P1,
   * P2,
   * P3,
   * P4.
3. Crear botón:

   * generar boletín individual.
   * generar boletines del curso.
4. Consumir endpoints del backend.
5. Descargar PDF como Blob.
6. Mostrar loading mientras se genera.
7. Mostrar errores si no tiene permiso.

## Permisos

* ADMIN puede generar boletines de todos los cursos de su escuela.
* TEACHER solo puede generar boletines si es titular del curso.
* SUPER_ADMIN puede generar si aplica.

## Criterios de aceptación

* Se puede descargar PDF individual.
* Se puede descargar PDF de curso.
* El período seleccionado se envía al backend.
* El botón se deshabilita si no hay permiso.
* El diseño de la pantalla es claro.

---

# Fase 20: Configuración de escuela

## Objetivo

Permitir editar datos de la institución usados en el boletín.

## Ruta

`/settings`

## Tareas

1. Crear formulario de configuración:

   * nombre de institución,
   * código,
   * dirección,
   * teléfono,
   * logo.
2. Permitir subir logo.
3. Mostrar vista previa del logo.
4. Guardar cambios.

## Criterios de aceptación

* ADMIN puede actualizar datos de su escuela.
* El logo queda disponible para boletines.
* La pantalla mantiene el estilo institucional.

---

# Fase 21: Pulido visual y usabilidad

## Objetivo

Mejorar la experiencia de uso del MVP.

## Tareas

1. Agregar estados de carga.
2. Agregar skeletons o spinners.
3. Agregar mensajes de éxito/error.
4. Agregar confirmación antes de eliminar.
5. Mejorar tablas compactas.
6. Agregar scroll horizontal en tablas de calificaciones.
7. Mejorar navegación móvil básica.
8. Revisar coherencia de colores.
9. Revisar textos y etiquetas en español.

## Criterios de aceptación

* La app se siente estable.
* Los errores son comprensibles.
* Las tablas de calificaciones son usables.
* La interfaz mantiene estilo institucional.

---

# Fase 22: Pruebas manuales del frontend

## Objetivo

Validar flujos principales.

## Pruebas necesarias

### Login

* Login correcto.
* Login incorrecto.
* Redirección por rol.
* Logout.

### ADMIN

* Crear año escolar.
* Crear curso.
* Crear estudiante.
* Crear maestro.
* Crear asignatura.
* Crear asignación docente.
* Registrar calificaciones.
* Importar estudiantes.
* Generar boletín.

### TEACHER

* Ver mis asignaturas.
* Registrar notas de una asignatura propia.
* No acceder a asignaturas ajenas.
* Generar boletín si es titular.
* No generar boletín si no es titular.

### Calificaciones académicas

* Editar P1.
* Editar RP1.
* Validar RP menor que P.
* Ver PC.
* Ver resumen.

### Calificaciones técnicas

* Editar nota ordinaria.
* Validar nota mayor que peso.
* Editar recuperación.
* Ver total.
* Ver estado.

### Importaciones

* Subir archivo correcto.
* Subir archivo con errores.
* Mostrar errores por fila.

### Boletines

* Descargar PDF individual.
* Descargar PDF por curso.
* Elegir período P1, P2, P3 o P4.

## Criterios de aceptación

* Los flujos principales funcionan.
* Los permisos visuales se respetan.
* No hay pantallas rotas.
* La app puede usarse para generar boletines.

---

# Orden recomendado de implementación

1. Inicializar Next.js en `front/`.
2. Configurar Tailwind y shadcn/ui.
3. Crear paleta visual.
4. Crear cliente API.
5. Crear login.
6. Crear auth y usuario actual.
7. Crear layout con sidebar y topbar.
8. Crear dashboard.
9. Crear CRUD de escuelas.
10. Crear CRUD de años escolares.
11. Crear CRUD de cursos.
12. Crear CRUD de estudiantes.
13. Crear CRUD de maestros.
14. Crear CRUD de asignaturas.
15. Crear configuración de RA.
16. Crear asignaciones docentes.
17. Crear vista Mis asignaturas.
18. Crear registro académico.
19. Crear registro técnico.
20. Crear importaciones.
21. Crear boletines.
22. Crear configuración de escuela.
23. Pulir UI.
24. Probar permisos y flujos.

---

# Resultado esperado

Al finalizar este plan, el frontend debe permitir:

* Iniciar sesión.
* Mostrar menús según rol.
* Administrar datos escolares.
* Registrar calificaciones académicas.
* Registrar calificaciones técnicas.
* Importar estudiantes y calificaciones desde Excel.
* Generar boletines PDF.
* Descargar boletines.
* Mostrar datos en un estilo formal institucional.
* Trabajar dentro de la carpeta `front/`.
* Conectarse al backend NestJS de CalifApp.
