# FRONTEND_CONTEXT.md

# CalifApp - Frontend Context

## 1. Descripción general

CalifApp es una aplicación web para gestionar calificaciones escolares y generar boletines PDF para centros educativos dominicanos, especialmente de la Modalidad Técnico Profesional.

Este frontend debe conectarse con el backend de CalifApp, desarrollado con NestJS, Prisma y Supabase PostgreSQL.

El objetivo del frontend es ofrecer una interfaz clara y formal para:

* Gestionar escuelas.
* Gestionar años escolares.
* Gestionar cursos.
* Gestionar estudiantes.
* Gestionar maestros.
* Gestionar asignaturas.
* Asignar maestros a cursos y asignaturas.
* Registrar calificaciones académicas.
* Registrar calificaciones técnicas.
* Importar estudiantes desde Excel.
* Importar calificaciones desde Excel.
* Generar boletines PDF.
* Respetar permisos según rol.

---

# 2. Nombre de la aplicación

Nombre oficial:

```text
CalifApp
```

---

# 3. Ubicación dentro del repositorio

El repositorio tiene dos carpetas principales:

```text
back/
front/
```

Todo el frontend debe implementarse dentro de:

```text
front/
```

No crear otra carpeta para la app web.

---

# 4. Stack recomendado

Usar:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
TanStack Table
React Hook Form
Zod
Lucide React
```

## Responsabilidad de cada herramienta

* **Next.js**: framework principal del frontend.
* **TypeScript**: tipado del proyecto.
* **Tailwind CSS**: estilos.
* **shadcn/ui**: componentes visuales reutilizables.
* **TanStack Query**: manejo de peticiones, cache y estado del servidor.
* **TanStack Table**: tablas de datos.
* **React Hook Form**: formularios.
* **Zod**: validaciones de formularios.
* **Lucide React**: iconos.

El PDF del boletín lo genera el backend. El frontend solo debe llamar el endpoint y descargar el archivo.

---

# 5. Estilo visual

El diseño debe ser:

```text
Formal institucional
Azul y gris
Limpio
Estándar
Sin tema oscuro
Parecido a Bootstrap
```

No implementar tema oscuro en el MVP.

## Paleta sugerida

```text
Azul principal: #1F4E79
Azul medio: #B7D3EA
Azul claro: #D9EAF7
Gris oscuro: #374151
Gris medio: #6B7280
Gris claro: #F3F4F6
Fondo general: #F8FAFC
Bordes: #D1D5DB
Blanco: #FFFFFF
Negro suave: #111827
```

## Estilo de botones

Botón primario:

```text
Fondo azul principal
Texto blanco
Bordes ligeramente redondeados
```

Botón secundario:

```text
Fondo gris claro
Texto gris oscuro
Borde gris
```

Botón de peligro:

```text
Rojo sobrio
Uso solo para eliminar/desactivar
```

## Estilo de tablas

Las tablas deben ser compactas, con bordes visibles y encabezados en azul claro o gris claro.

Para calificaciones, usar tablas similares a un registro escolar o una hoja de Excel formal.

---

# 6. Roles del sistema

El frontend debe adaptar menús, rutas y permisos según el rol del usuario.

Roles:

```text
SUPER_ADMIN
ADMIN
TEACHER
```

## SUPER_ADMIN

Puede:

* Ver escuelas.
* Crear escuelas.
* Editar escuelas.
* Gestionar usuarios administrativos globales si aplica.

No es el usuario principal del día a día.

## ADMIN

Usuario administrativo de una escuela.

Puede:

* Ver todo dentro de su escuela.
* Gestionar año escolar.
* Gestionar cursos.
* Gestionar estudiantes.
* Gestionar maestros.
* Gestionar asignaturas.
* Gestionar asignaciones docentes.
* Ver y editar calificaciones.
* Importar estudiantes.
* Importar calificaciones.
* Generar boletines de todos los cursos de su escuela.
* Configurar datos de la institución.

## TEACHER

Usuario docente.

Puede:

* Ver solo sus asignaturas asignadas.
* Registrar calificaciones solo de sus asignaturas.
* Importar calificaciones solo de sus asignaturas.
* Generar boletines solo si es maestro titular del curso.

No puede:

* Gestionar cursos.
* Gestionar maestros.
* Gestionar asignaturas.
* Ver calificaciones de asignaturas que no imparte.
* Generar boletines de cursos donde no es titular.

---

# 7. Estructura de rutas recomendada

Usar Next.js App Router.

Estructura sugerida:

```text
front/
  app/
    (auth)/
      login/
        page.tsx

    (dashboard)/
      layout.tsx
      dashboard/
        page.tsx

      schools/
        page.tsx
        [id]/
          page.tsx

      school-years/
        page.tsx

      courses/
        page.tsx
        [id]/
          page.tsx
        [id]/
          students/
            page.tsx

      students/
        page.tsx

      teachers/
        page.tsx

      subjects/
        page.tsx
        [id]/
          page.tsx
        [id]/
          technical-outcomes/
            page.tsx

      assignments/
        page.tsx

      my-subjects/
        page.tsx

      grades/
        academic/
          page.tsx
        technical/
          page.tsx

      imports/
        page.tsx

      reports/
        page.tsx

      settings/
        page.tsx
```

Si se prefiere una estructura más simple para el MVP, se puede usar:

```text
app/
  login/
  dashboard/
  schools/
  school-years/
  courses/
  students/
  teachers/
  subjects/
  assignments/
  my-subjects/
  grades/
    academic/
    technical/
  imports/
  reports/
  settings/
```

---

# 8. Estructura de carpetas recomendada

```text
front/
  app/
  components/
    layout/
      AppSidebar.tsx
      Topbar.tsx
      DashboardLayout.tsx
      RoleBasedNav.tsx

    ui/
      ...

    forms/
      SchoolForm.tsx
      SchoolYearForm.tsx
      CourseForm.tsx
      StudentForm.tsx
      TeacherForm.tsx
      SubjectForm.tsx
      AssignmentForm.tsx

    tables/
      DataTable.tsx
      EmptyState.tsx
      TableActions.tsx

    grades/
      AcademicGradeTable.tsx
      AcademicBlockTabs.tsx
      AcademicSummaryTable.tsx
      TechnicalGradeTable.tsx
      TechnicalRaTabs.tsx
      TechnicalSummaryTable.tsx
      GradeStatusBadge.tsx

    imports/
      ImportUploader.tsx
      ImportResult.tsx
      ImportErrorsTable.tsx

    reports/
      ReportCardFilters.tsx
      PdfDownloadButton.tsx

    dashboard/
      StatCard.tsx

  lib/
    api.ts
    auth.ts
    permissions.ts
    utils.ts
    constants.ts
    download.ts

  hooks/
    use-auth.ts
    use-current-user.ts
    use-permissions.ts

  types/
    auth.ts
    school.ts
    school-year.ts
    course.ts
    student.ts
    teacher.ts
    subject.ts
    assignment.ts
    grades.ts
    imports.ts
    reports.ts
```

---

# 9. Layout general

La aplicación debe usar un layout tipo panel administrativo.

Estructura:

```text
┌───────────────────────────────────────────────────────┐
│ Topbar: CalifApp | Escuela | Año escolar | Usuario     │
├─────────────────┬─────────────────────────────────────┤
│ Sidebar         │ Contenido principal                  │
│                 │                                     │
│ Dashboard       │                                     │
│ Cursos          │                                     │
│ Estudiantes     │                                     │
│ Calificaciones  │                                     │
│ Boletines       │                                     │
└─────────────────┴─────────────────────────────────────┘
```

## Topbar

Debe mostrar:

* Nombre de la app: CalifApp.
* Escuela activa.
* Año escolar activo.
* Nombre del usuario.
* Rol del usuario.
* Botón de cerrar sesión.

## Sidebar

El sidebar cambia según rol.

### Sidebar para SUPER_ADMIN

* Escuelas
* Usuarios
* Configuración

### Sidebar para ADMIN

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

### Sidebar para TEACHER

* Mis asignaturas
* Calificaciones
* Importar calificaciones
* Boletines, solo si es titular

---

# 10. Pantallas del MVP

## 10.1 Login

Ruta:

```text
/login
```

Debe incluir:

* Nombre CalifApp.
* Formulario con correo y contraseña.
* Botón “Iniciar sesión”.
* Diseño centrado.
* Fondo gris claro.
* Tarjeta blanca.

Al iniciar sesión, redirigir según rol:

```text
SUPER_ADMIN → /schools
ADMIN → /dashboard
TEACHER → /my-subjects
```

---

## 10.2 Dashboard

Ruta:

```text
/dashboard
```

Para ADMIN debe mostrar tarjetas:

* Año escolar activo.
* Total de cursos.
* Total de estudiantes.
* Total de maestros.
* Total de asignaturas.
* Cursos sin titular.
* Calificaciones incompletas.

Para TEACHER puede mostrar:

* Asignaturas que imparte.
* Cursos donde imparte.
* Cursos donde es titular.
* Acceso rápido a calificaciones.

---

## 10.3 Escuelas

Ruta:

```text
/schools
```

Solo SUPER_ADMIN.

Tabla:

```text
Escuela | Código | Estado | Acciones
```

Acciones:

* Crear escuela.
* Editar escuela.
* Activar/desactivar.
* Ver detalle.

---

## 10.4 Año escolar

Ruta:

```text
/school-years
```

Solo ADMIN.

Tabla:

```text
Año escolar | Estado | Acciones
```

Acciones:

* Crear año escolar.
* Editar.
* Activar año escolar.

Regla visual:

Solo un año escolar puede aparecer como activo por escuela.

---

## 10.5 Cursos

Ruta:

```text
/courses
```

Tabla:

```text
Curso | Grado | Sección | Área | Modalidad | Maestro titular | Acciones
```

Acciones:

* Crear curso.
* Editar curso.
* Asignar maestro titular.
* Ver estudiantes.
* Ver boletines del curso.

Ejemplos de cursos:

```text
4to A Informática
4to B Enfermería
5to A Desarrollo y Administración de Aplicaciones Informáticas
```

---

## 10.6 Estudiantes

Ruta:

```text
/students
```

Debe permitir filtrar por curso.

Tabla:

```text
No. | Nombres | Apellidos | Curso | Acciones
```

El número de lista debe ser visible y estar en la primera columna.

Acciones:

* Crear estudiante.
* Editar estudiante.
* Eliminar/desactivar.
* Importar estudiantes desde Excel.

Campos del estudiante:

* listNumber
* firstName
* lastName
* courseId
* schoolYearId

---

## 10.7 Maestros

Ruta:

```text
/teachers
```

Tabla:

```text
Nombre | Usuario vinculado | Cursos titulares | Acciones
```

Acciones:

* Crear maestro.
* Editar maestro.
* Vincular usuario si aplica.
* Ver asignaciones.

Para MVP, el maestro solo necesita nombre.

---

## 10.8 Asignaturas

Ruta:

```text
/subjects
```

Tabla:

```text
Asignatura | Tipo | Estado | Acciones
```

Tipos:

```text
ACADEMIC
TECHNICAL
```

Mostrar visualmente como:

```text
Académica
Técnica
```

Acciones:

* Crear asignatura.
* Editar asignatura.
* Activar/desactivar.
* Si es técnica, configurar RA.

---

## 10.9 Configuración de RA técnicos

Ruta sugerida:

```text
/subjects/:id/technical-outcomes
```

Solo para asignaturas de tipo TECHNICAL.

Tabla:

```text
Orden | Código | Nombre | Peso | Mínimo 70% | Acciones
```

Acciones:

* Crear RA.
* Editar RA.
* Eliminar RA.

Regla visual:

La suma de pesos debe mostrarse claramente.

Ejemplo:

```text
Total de pesos: 100 / 100
```

Si la suma no da 100, mostrar alerta.

---

## 10.10 Asignaciones docentes

Ruta:

```text
/assignments
```

Tabla:

```text
Curso | Asignatura | Tipo | Maestro | Acciones
```

Acciones:

* Crear asignación.
* Cambiar maestro.
* Eliminar/desactivar asignación.

Debe representar:

```text
Maestro + Asignatura + Curso + Año escolar
```

Regla:

No se puede asignar dos maestros a la misma asignatura en el mismo curso y año escolar.

---

# 11. Pantallas de calificaciones

## 11.1 Mis asignaturas

Ruta:

```text
/my-subjects
```

Para TEACHER.

Tabla o tarjetas:

```text
Curso | Asignatura | Tipo | Acciones
```

Acciones:

* Registrar notas.
* Importar notas.

Si la asignatura es ACADEMIC, abrir pantalla académica.

Si la asignatura es TECHNICAL, abrir pantalla técnica.

---

## 11.2 Calificaciones académicas

Ruta sugerida:

```text
/grades/academic?courseId=...&subjectId=...
```

La pantalla debe ser tipo registro académico.

Filtros superiores:

* Curso.
* Asignatura.
* Período visible si aplica.
* Botón guardar.
* Botón importar.

Usar tabs:

```text
[Bloque 1] [Bloque 2] [Bloque 3] [Bloque 4] [Resumen]
```

### Vista de cada bloque

Tabla compacta:

```text
No. | Estudiante | P1 | RP1 | P2 | RP2 | P3 | RP3 | P4 | RP4 | PC
```

Reglas visuales:

* Si P >= 70, RP puede mostrarse deshabilitada o como “No aplica”.
* Si P < 70, RP debe poder editarse.
* Si RP < P, mostrar error.
* PC se muestra con una cifra decimal.
* Celdas numéricas centradas.
* Tabla compacta con bordes.

### Vista resumen académico

Tabla:

```text
No. | Estudiante | PC1 | PC2 | PC3 | PC4 | CF | CEC | CCF | CEEX | CEXF | CE | CEF | Estado
```

Reglas visuales:

* CF, CCF, CEXF y CEF se muestran como enteros.
* PC1-PC4 se muestran con una cifra decimal.
* Estado con badge:

  * Pendiente
  * Aprobado
  * Completiva
  * Extraordinaria
  * Especial
  * Reprobado

No usar estados como “Aprobado en completiva”. Si aprobó, mostrar solo “Aprobado”.

---

## 11.3 Calificaciones técnicas

Ruta sugerida:

```text
/grades/technical?courseId=...&subjectId=...
```

Filtros superiores:

* Curso.
* Módulo técnico.
* Botón guardar.
* Botón importar.

Mostrar primero resumen del módulo:

```text
RA | Peso | Mínimo 70%
```

Ejemplo:

```text
RA1 | 20 | 14
RA2 | 15 | 10.5
RA3 | 25 | 17.5
```

Usar tabs:

```text
[RA1] [RA2] [RA3] [RA4] [Resumen]
```

### Vista por RA

Tabla:

```text
No. | Estudiante | Ordinaria | Recuperación 1 | Recuperación 2 | Especial | Nota válida | Estado RA
```

Reglas visuales:

* La nota ordinaria no puede superar el peso del RA.
* Recuperación 1 no puede ser menor que ordinaria.
* Recuperación 2 no puede ser menor que recuperación 1.
* Especial solo debería activarse cuando aplica.
* Mostrar mínimo del RA para orientar al docente.

### Vista resumen técnico

Tabla:

```text
No. | Estudiante | RA1 | RA2 | RA3 | RA4 | Total | Estado
```

Reglas:

* Total es la suma de notas válidas.
* Si total >= 70, estado Aprobado.
* Si total < 70, puede requerir especial.
* Puede aprobar aunque tenga RA no aprobados si total >= 70.

---

# 12. Importaciones desde Excel

Ruta:

```text
/imports
```

Usar tabs:

```text
[Estudiantes] [Calificaciones académicas] [Calificaciones técnicas]
```

## 12.1 Importar estudiantes

Campos:

* Curso.
* Archivo Excel.
* Botón “Descargar plantilla”.
* Botón “Importar”.

Columnas esperadas:

```text
numero_lista
nombres
apellidos
curso
```

Mostrar resultado:

```text
Total de filas
Filas importadas
Filas con error
```

Mostrar errores por fila si existen.

## 12.2 Importar calificaciones académicas

Campos:

* Curso.
* Asignatura.
* Archivo Excel.
* Descargar plantilla.
* Importar.

Columnas sugeridas:

```text
numero_lista
asignatura
B1_P1
B1_RP1
B1_P2
B1_RP2
B1_P3
B1_RP3
B1_P4
B1_RP4
B2_P1
B2_RP1
...
B4_P4
B4_RP4
CEC
CEEX
CE
```

## 12.3 Importar calificaciones técnicas

Campos:

* Curso.
* Módulo técnico.
* Archivo Excel.
* Descargar plantilla.
* Importar.

Columnas sugeridas:

```text
numero_lista
modulo
RA1
RA1_R1
RA1_R2
RA1_ESP
RA2
RA2_R1
RA2_R2
RA2_ESP
...
```

## 12.4 Resultado de importación

Mostrar:

```text
Estado
Total de filas
Filas importadas
Filas con error
Errores por fila
```

Ejemplo:

```text
Fila 12: estudiante no existe.
Fila 15: RP1 no puede ser menor que P1.
Fila 21: RA1 excede el peso permitido.
```

---

# 13. Boletines

Ruta:

```text
/reports
```

El boletín PDF es generado por el backend. El frontend solo llama el endpoint y descarga el archivo.

## Filtros

* Año escolar.
* Curso.
* Período:

  * P1
  * P2
  * P3
  * P4
* Estudiante, opcional.

## Acciones

* Generar boletín individual.
* Generar boletines del curso.
* Descargar PDF.

## Permisos

ADMIN:

```text
Puede generar boletines de todos los cursos de su escuela.
```

TEACHER:

```text
Solo puede generar boletines si es titular del curso.
```

SUPER_ADMIN:

```text
Puede generar boletines globalmente si aplica.
```

---

# 14. Diseño del boletín PDF

El diseño debe parecerse al ejemplo de Excel suministrado por el usuario.

Características visuales:

* Encabezado institucional.
* Logo de la institución.
* Nombre de la institución centrado.
* Año escolar.
* Curso.
* Número de lista.
* Nombre del estudiante.
* Maestro titular.
* Tabla de asignaturas académicas.
* Tabla de módulos técnicos.
* Celdas compactas.
* Bordes finos.
* Encabezados azul claro.
* Texto negro.
* Estilo formal tipo registro escolar.
* Orientación horizontal si es necesario.

El boletín debe incluir:

```text
Nombre de la institución
Logo si existe
Año escolar
Nombre completo del estudiante
Número de lista
Curso
Área si aplica
Sección si aplica
Maestro titular
Asignaturas académicas con calificaciones
Módulos técnicos con calificaciones
Estado de asignaturas/módulos
Calificación final cuando exista
```

---

# 15. API frontend

Crear un cliente API centralizado.

Archivo sugerido:

```text
lib/api.ts
```

Responsabilidades:

* Configurar base URL del backend.
* Adjuntar token de autenticación.
* Manejar errores comunes.
* Descargar PDFs como Blob.
* Soportar carga de archivos Excel.

Variables de entorno:

```text
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Ejemplo conceptual:

```ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Adjuntar token
  // Hacer fetch
  // Manejar errores
}
```

---

# 16. Autenticación frontend

Crear:

```text
lib/auth.ts
hooks/use-auth.ts
hooks/use-current-user.ts
```

El frontend debe:

* Guardar el token de sesión.
* Obtener usuario actual desde `/auth/me`.
* Redirigir si no está autenticado.
* Ocultar rutas según rol.
* Mostrar menú según rol.

No confiar solo en el frontend para permisos. El backend también validará todo.

---

# 17. Permisos frontend

Crear:

```text
lib/permissions.ts
```

Debe incluir helpers como:

```ts
canManageSchool(user)
canManageCourses(user)
canManageStudents(user)
canManageTeachers(user)
canManageSubjects(user)
canManageAssignments(user)
canViewAllGrades(user)
canEditGrade(user, assignment)
canGenerateReports(user, course)
```

Estos helpers son solo para UI. El backend es la autoridad real.

---

# 18. Estados visuales

Usar badges para estados.

Estados:

```text
PENDING → Pendiente
APPROVED → Aprobado
COMPLETIVA → Completiva
EXTRAORDINARIA → Extraordinaria
SPECIAL → Especial
FAILED → Reprobado
```

Colores sugeridos:

```text
Pendiente → gris
Aprobado → verde sobrio
Completiva → amarillo
Extraordinaria → naranja
Especial → azul
Reprobado → rojo
```

Mantener colores sobrios y adecuados al estilo institucional.

---

# 19. Experiencia de usuario

La aplicación debe priorizar:

* Tablas claras.
* Edición rápida de calificaciones.
* Guardado sencillo.
* Mensajes de error claros.
* Importación desde Excel con reporte de errores.
* Generación rápida de boletines.
* Evitar pantallas sobrecargadas.

En calificaciones, usar tablas compactas y scroll horizontal si hace falta.

No ocultar demasiado los datos: los docentes necesitan ver muchas calificaciones a la vez.

---

# 20. Reglas importantes que el frontend debe respetar visualmente

## Académicas

* Mostrar 4 bloques.
* Cada bloque tiene P1, RP1, P2, RP2, P3, RP3, P4, RP4.
* Mostrar PC con una cifra decimal.
* Mostrar CF, CCF, CEXF y CEF como enteros.
* Validar que RP no sea menor que P.
* Mostrar recuperación solo cuando P < 70 o dejarla visible pero deshabilitada cuando no aplica.
* Mostrar resumen final de la asignatura.

## Técnicas

* Mostrar RA con peso.
* La nota de cada RA no puede superar su peso.
* Mostrar mínimo 70% del RA.
* R1 no puede ser menor que ordinaria.
* R2 no puede ser menor que R1.
* Especial técnica solo se debe habilitar cuando aplica.
* Mostrar sumatoria final del módulo.

---

# 21. Orden de implementación recomendado

Implementar en este orden:

1. Crear proyecto Next.js dentro de `front/`.
2. Configurar TypeScript, Tailwind y shadcn/ui.
3. Definir paleta visual institucional.
4. Crear layout general: sidebar, topbar y dashboard layout.
5. Crear login.
6. Crear cliente API.
7. Crear autenticación y usuario actual.
8. Crear navegación por rol.
9. Crear dashboard básico.
10. Crear CRUD de años escolares.
11. Crear CRUD de cursos.
12. Crear CRUD de estudiantes.
13. Crear importación de estudiantes.
14. Crear CRUD de maestros.
15. Crear CRUD de asignaturas.
16. Crear configuración de RA técnicos.
17. Crear asignaciones docentes.
18. Crear vista Mis asignaturas.
19. Crear pantalla de calificaciones académicas.
20. Crear pantalla de calificaciones técnicas.
21. Crear importación de calificaciones.
22. Crear pantalla de boletines.
23. Crear configuración de escuela.
24. Pulir estilos.
25. Probar permisos por rol.

---

# 22. Criterios de éxito del frontend MVP

El frontend estará listo cuando permita:

* Iniciar sesión.
* Mostrar navegación según rol.
* Gestionar años escolares.
* Gestionar cursos.
* Gestionar estudiantes con número de lista.
* Gestionar maestros.
* Gestionar asignaturas académicas y técnicas.
* Configurar RA técnicos.
* Asignar maestros a cursos y asignaturas.
* Ver “Mis asignaturas” como docente.
* Registrar calificaciones académicas.
* Registrar calificaciones técnicas.
* Importar estudiantes desde Excel.
* Importar calificaciones desde Excel.
* Generar boletines PDF.
* Descargar boletines.
* Respetar permisos visuales por rol.
* Tener un diseño formal institucional azul y gris.
* Parecerse visualmente al estilo del boletín de Excel proporcionado.
