# Plan de trabajo para implementar el backend del sistema de calificaciones

## Stack definido

Backend: NestJS
Lenguaje: TypeScript
Base de datos: Supabase PostgreSQL
ORM: Prisma
Autenticación: Supabase Auth integrada con permisos internos en NestJS
Storage: Supabase Storage para logos de escuelas
Excel: ExcelJS
PDF: Puppeteer o Playwright
Arquitectura: API REST modular
Objetivo del MVP: gestionar calificaciones académicas y técnicas, importar datos desde Excel y generar boletines PDF para varias escuelas.

---

# Fase 1: Inicialización del proyecto

## Objetivo

Crear la base del backend en NestJS con Prisma y configuración inicial para Supabase PostgreSQL.

## Tareas

1. Crear proyecto NestJS.
2. Configurar TypeScript, ESLint y Prettier.
3. Instalar dependencias principales:

   * `@nestjs/config`
   * `@nestjs/jwt` si se usa validación JWT interna
   * `class-validator`
   * `class-transformer`
   * `@prisma/client`
   * `prisma`
   * `exceljs`
   * `puppeteer` o `playwright`
   * `zod` si se decide usar validación adicional
4. Configurar archivo `.env`.
5. Configurar conexión de Prisma a Supabase PostgreSQL.
6. Crear módulo global de configuración.
7. Crear `PrismaService`.
8. Probar conexión a la base de datos.

## Criterios de aceptación

* El proyecto corre con `npm run start:dev`.
* Prisma conecta correctamente con Supabase PostgreSQL.
* Existe una estructura base limpia y modular.

---

# Fase 2: Modelo de base de datos con Prisma

## Objetivo

Crear el `schema.prisma` completo del MVP.

## Tablas principales

Implementar los siguientes modelos:

1. `School`
2. `SchoolYear`
3. `User`
4. `Teacher`
5. `Course`
6. `Student`
7. `Subject`
8. `TeacherAssignment`
9. `AcademicGrade`
10. `AcademicSubjectResult`
11. `TechnicalLearningOutcome`
12. `TechnicalGrade`
13. `TechnicalSubjectResult`
14. `ImportJob`
15. `AuditLog`

## Enums necesarios

Crear enums:

* `UserRole`

  * `SUPER_ADMIN`
  * `ADMIN`
  * `TEACHER`

* `SubjectType`

  * `ACADEMIC`
  * `TECHNICAL`

* `SubjectStatus`

  * `PENDING`
  * `APPROVED`
  * `COMPLETIVA`
  * `EXTRAORDINARIA`
  * `SPECIAL`
  * `FAILED`

* `ImportType`

  * `STUDENTS`
  * `ACADEMIC_GRADES`
  * `TECHNICAL_GRADES`

* `ImportStatus`

  * `PENDING`
  * `PROCESSING`
  * `COMPLETED`
  * `FAILED`

* `AuditAction`

  * `CREATE`
  * `UPDATE`
  * `DELETE`
  * `IMPORT`
  * `GENERATE_REPORT`

## Reglas de unicidad

Agregar restricciones únicas:

* Una escuela no puede tener dos años escolares con el mismo nombre.
* No se repite el número de lista dentro del mismo curso, escuela y año escolar.
* No se repite una asignatura con el mismo nombre dentro de una escuela.
* No puede haber dos maestros asignados a la misma asignatura, curso, escuela y año escolar.
* Un estudiante solo puede tener un registro por asignatura académica y bloque.
* Un estudiante solo puede tener un resultado final por asignatura.
* Un estudiante solo puede tener una nota por RA técnico.

## Criterios de aceptación

* El esquema Prisma compila correctamente.
* La migración se ejecuta sin errores.
* Las relaciones principales funcionan.
* Las restricciones únicas evitan datos duplicados importantes.

---

# Fase 3: Arquitectura modular del backend

## Objetivo

Crear la estructura de módulos de NestJS.

## Módulos a crear

Crear los siguientes módulos:

* `auth`
* `schools`
* `school-years`
* `users`
* `teachers`
* `courses`
* `students`
* `subjects`
* `teacher-assignments`
* `academic-grades`
* `technical-learning-outcomes`
* `technical-grades`
* `imports`
* `reports`
* `audit`
* `common`

## Estructura por módulo

Cada módulo debe tener, cuando aplique:

* `controller`
* `service`
* `dto`
* `entities` si fuera necesario
* `guards` si aplica
* `validators` si aplica

## Criterios de aceptación

* Cada módulo está separado correctamente.
* No hay lógica de negocio directamente en los controladores.
* Los servicios contienen la lógica principal.
* Los DTO validan entradas.

---

# Fase 4: Autenticación y autorización

## Objetivo

Implementar control de acceso por rol y por escuela.

## Roles

Implementar tres roles:

1. `SUPER_ADMIN`

   * Puede ver y administrar todas las escuelas.
   * Puede crear escuelas.
   * Puede crear administradores de escuela.

2. `ADMIN`

   * Solo puede ver y administrar datos de su escuela.
   * Puede gestionar cursos, estudiantes, maestros, asignaturas, asignaciones, calificaciones e importaciones de su escuela.
   * Puede generar boletines de todos los cursos de su escuela.

3. `TEACHER`

   * Solo puede ver sus asignaturas asignadas.
   * Solo puede registrar o importar calificaciones de las asignaturas que imparte.
   * Solo puede generar boletines del curso donde sea maestro titular.

## Tareas

1. Crear guard de autenticación.
2. Crear decorador `CurrentUser`.
3. Crear guard de roles.
4. Crear guard de pertenencia a escuela.
5. Crear validación de permisos por asignación docente.
6. Crear validación para generación de boletín por docente titular.
7. Integrar Supabase Auth o validar JWT emitido por Supabase.

## Reglas importantes

* Nunca confiar solo en el frontend.
* Toda consulta debe filtrar por `schoolId`.
* Un docente no puede consultar ni modificar datos de otra escuela.
* Un admin no puede consultar ni modificar datos de otra escuela.
* Solo `SUPER_ADMIN` puede actuar sobre varias escuelas.

## Criterios de aceptación

* Un docente solo ve sus asignaturas.
* Un administrativo solo ve su escuela.
* Un super admin puede ver todas las escuelas.
* Un docente no titular no puede generar boletines del curso completo.
* Un titular solo genera boletines de su curso.

---

# Fase 5: CRUD base administrativo

## Objetivo

Implementar la gestión básica de escuelas, años escolares, usuarios, maestros, cursos, estudiantes y asignaturas.

## Endpoints sugeridos

### Schools

* `POST /schools`
* `GET /schools`
* `GET /schools/:id`
* `PATCH /schools/:id`
* `DELETE /schools/:id`

### School Years

* `POST /school-years`
* `GET /school-years`
* `PATCH /school-years/:id`
* `PATCH /school-years/:id/activate`

### Teachers

* `POST /teachers`
* `GET /teachers`
* `GET /teachers/:id`
* `PATCH /teachers/:id`
* `DELETE /teachers/:id`

### Courses

* `POST /courses`
* `GET /courses`
* `GET /courses/:id`
* `PATCH /courses/:id`
* `DELETE /courses/:id`

### Students

* `POST /students`
* `GET /students`
* `GET /students/:id`
* `PATCH /students/:id`
* `DELETE /students/:id`

### Subjects

* `POST /subjects`
* `GET /subjects`
* `GET /subjects/:id`
* `PATCH /subjects/:id`
* `DELETE /subjects/:id`

### Teacher Assignments

* `POST /teacher-assignments`
* `GET /teacher-assignments`
* `PATCH /teacher-assignments/:id`
* `DELETE /teacher-assignments/:id`

## Validaciones clave

* No repetir número de lista en un mismo curso y año escolar.
* No repetir asignatura por escuela.
* No repetir asignación maestro-asignatura-curso-año.
* El maestro titular debe pertenecer a la misma escuela del curso.
* El curso debe pertenecer al mismo año escolar y escuela.

## Criterios de aceptación

* El admin puede administrar todos los datos de su escuela.
* Las restricciones importantes funcionan.
* La información queda lista para registrar calificaciones.

---

# Fase 6: Motor de calificaciones académicas

## Objetivo

Implementar la lógica de asignaturas académicas.

## Modelo conceptual

Cada asignatura académica tiene 4 bloques:

* Bloque 1 → PC1
* Bloque 2 → PC2
* Bloque 3 → PC3
* Bloque 4 → PC4

Cada bloque tiene:

* `P1`
* `RP1`
* `P2`
* `RP2`
* `P3`
* `RP3`
* `P4`
* `RP4`

## Reglas

1. Las notas ordinarias y recuperaciones van de 0 a 100.

2. La recuperación solo aplica cuando la ordinaria es menor de 70.

3. Si existe recuperación, se usa la recuperación como nota válida.

4. La recuperación no puede ser menor que la nota ordinaria.

5. Cada PC se calcula con las cuatro notas válidas del bloque.

6. El PC se redondea a una cifra decimal.

7. La CF se calcula así:

   `CF = promedio de PC1, PC2, PC3 y PC4`

8. La CF se redondea a entero.

9. Si CF es 70 o más, estado `APPROVED`.

10. Si CF es menor que 70, estado `COMPLETIVA`.

## Prueba completiva

`CCF = (CF * 0.50) + (CEC * 0.50)`

* `CCF` se redondea a entero.
* Si `CCF >= 70`, estado `APPROVED`.
* Si `CCF < 70`, estado `EXTRAORDINARIA`.

## Prueba extraordinaria

`CEXF = (CF * 0.30) + (CEEX * 0.70)`

* Se usa la CF original, no la CCF.
* `CEXF` se redondea a entero.
* Si `CEXF >= 70`, estado `APPROVED`.
* Si `CEXF < 70`, se debe evaluar derecho a especial.

## Derecho a prueba especial

Después de extraordinaria:

* Si el estudiante tiene 1 o 2 asignaturas reprobadas en extraordinaria, tiene derecho a especial.
* Si tiene más de 2, queda `FAILED` sin derecho a especial.

## Prueba especial académica

`CEF = CF + CE`

Reglas:

* Se usa la CF original.
* `CF + CE` no puede pasar de 100.
* Si `CEF >= 70`, estado `APPROVED`.
* Si `CEF < 70`, estado `FAILED`.

## Endpoints sugeridos

* `GET /academic-grades/course/:courseId/subject/:subjectId`
* `POST /academic-grades`
* `PATCH /academic-grades/:id`
* `POST /academic-grades/bulk`
* `POST /academic-grades/recalculate/student/:studentId/subject/:subjectId`
* `POST /academic-grades/final-evaluations`
* `POST /academic-grades/evaluate-special-right/:studentId`

## Criterios de aceptación

* El sistema calcula PC con una cifra decimal.
* El sistema calcula CF, CCF, CEXF y CEF correctamente.
* El sistema valida que la recuperación no sea menor que la ordinaria.
* El sistema detecta si el estudiante pierde derecho a especial por reprobar más de 2 asignaturas en extraordinaria.
* El docente solo puede editar sus asignaturas.
* El admin puede editar todas las asignaturas de su escuela.

---

# Fase 7: Motor de calificaciones técnicas

## Objetivo

Implementar la lógica de módulos formativos técnicos.

## Modelo conceptual

Cada asignatura técnica tiene varios RA.

Cada RA tiene:

* Código: RA1, RA2, RA3...
* Peso
* Orden

La suma de los pesos de los RA de un módulo debe ser 100.

## Reglas

1. La nota de cada RA se registra en base a su peso.
2. Si RA1 pesa 20, su nota debe estar entre 0 y 20.
3. El mínimo aprobatorio del RA es el 70% de su peso.
4. Cada RA tiene:

   * Nota ordinaria
   * Recuperación 1
   * Recuperación 2
   * Especial
5. La recuperación 1 no puede ser menor que la nota ordinaria.
6. La recuperación 2 no puede ser menor que la recuperación 1.
7. La nota válida siempre es la última recuperación registrada.
8. El módulo aprueba si la sumatoria final es 70 o más.
9. Puede aprobar el módulo aunque tenga uno o más RA por debajo del mínimo, siempre que la sumatoria final sea 70 o más.
10. La prueba especial técnica solo aplica si la sumatoria final del módulo es menor de 70.
11. La prueba especial técnica solo se aplica a los RA no aprobados.
12. Después de aplicar especial, se recalcula la sumatoria final.
13. Si la sumatoria final con especial es 70 o más, estado `APPROVED`.
14. Si queda por debajo de 70, estado `FAILED`.

## Endpoints sugeridos

### RA

* `POST /technical-learning-outcomes`
* `GET /technical-learning-outcomes/subject/:subjectId`
* `PATCH /technical-learning-outcomes/:id`
* `DELETE /technical-learning-outcomes/:id`

### Calificaciones técnicas

* `GET /technical-grades/course/:courseId/subject/:subjectId`
* `POST /technical-grades`
* `PATCH /technical-grades/:id`
* `POST /technical-grades/bulk`
* `POST /technical-grades/recalculate/student/:studentId/subject/:subjectId`

## Criterios de aceptación

* El sistema valida que la suma de pesos de los RA sea 100.
* El sistema valida que una nota no supere el peso del RA.
* El sistema valida la secuencia de recuperaciones.
* El sistema calcula la sumatoria final del módulo.
* El sistema solo habilita especial técnica cuando la sumatoria final está por debajo de 70.
* El sistema solo permite especial en RA no aprobados.

---

# Fase 8: Importación desde Excel

## Objetivo

Permitir importar estudiantes y calificaciones desde Excel.

## Importación de estudiantes

Crear endpoint:

* `POST /imports/students`

Columnas esperadas:

* `numero_lista`
* `nombres`
* `apellidos`
* `curso`

Validaciones:

* Número de lista obligatorio.
* Nombre obligatorio.
* Apellido obligatorio.
* Curso existente.
* No repetir número de lista dentro del curso, escuela y año escolar.

## Importación de calificaciones académicas

Crear endpoint:

* `POST /imports/academic-grades`

Columnas sugeridas:

* `numero_lista`
* `asignatura`
* `B1_P1`
* `B1_RP1`
* `B1_P2`
* `B1_RP2`
* `B1_P3`
* `B1_RP3`
* `B1_P4`
* `B1_RP4`
* Repetir estructura para B2, B3 y B4.
* `CEC`
* `CEEX`
* `CE`

Validaciones:

* Estudiante existente.
* Asignatura académica existente.
* Asignatura asignada al curso.
* Si usuario es docente, debe ser el docente asignado a esa asignatura.
* Notas entre 0 y 100.
* Recuperación no menor que la ordinaria.
* CF + CE no mayor que 100.

## Importación de calificaciones técnicas

Crear endpoint:

* `POST /imports/technical-grades`

Columnas sugeridas:

* `numero_lista`
* `modulo`
* `RA1`
* `RA1_R1`
* `RA1_R2`
* `RA1_ESP`
* `RA2`
* `RA2_R1`
* `RA2_R2`
* `RA2_ESP`
* Continuar según cantidad de RA.

Validaciones:

* Estudiante existente.
* Módulo técnico existente.
* RA existente.
* Nota no mayor que el peso del RA.
* Recuperación no menor que la anterior.
* Especial solo si corresponde.

## ImportJob

Registrar cada importación en `ImportJob`.

Guardar:

* Tipo de importación.
* Archivo.
* Usuario.
* Total de filas.
* Filas exitosas.
* Filas con error.
* Lista de errores por fila.

## Criterios de aceptación

* El sistema importa estudiantes desde Excel.
* El sistema importa calificaciones académicas desde Excel.
* El sistema importa calificaciones técnicas desde Excel.
* Si una fila falla, debe reportar el error.
* La importación debe devolver resumen claro.
* Debe quedar registro en `ImportJob`.

---

# Fase 9: Auditoría

## Objetivo

Registrar cambios importantes en el sistema.

## Tareas

1. Agregar campos:

   * `createdAt`
   * `updatedAt`
   * `createdBy`
   * `updatedBy`

2. Implementar `AuditLog` para:

   * Creación de registros importantes.
   * Actualización de calificaciones.
   * Importaciones.
   * Generación de reportes PDF.

## Eventos importantes a auditar

* Cambio de calificación académica.
* Cambio de calificación técnica.
* Importación de estudiantes.
* Importación de calificaciones.
* Generación de boletín.
* Cambio de asignación docente.
* Cambio de maestro titular.

## Criterios de aceptación

* Cada cambio importante queda registrado.
* El log guarda valor anterior y nuevo valor.
* El log incluye usuario, acción, entidad y fecha.

---

# Fase 10: Generación de boletines PDF

## Objetivo

Generar boletines PDF en tiempo real, sin guardar historial.

## Reglas

1. El boletín se puede generar aunque las calificaciones estén incompletas.
2. No se guarda copia del boletín.
3. Se genera PDF en tiempo real.
4. El usuario puede elegir hasta qué período mostrar:

   * Periodo 1: mostrar P1.
   * Periodo 2: mostrar P1 y P2.
   * Periodo 3: mostrar P1, P2 y P3.
   * Periodo 4: mostrar P1, P2, P3 y P4.
5. El docente solo puede generar boletines si es titular del curso.
6. El admin puede generar boletines de todos los cursos de su escuela.

## Información del boletín

El boletín debe mostrar:

* Nombre de la institución.
* Logo de la institución si existe.
* Año escolar.
* Nombre completo del estudiante.
* Número de lista.
* Curso.
* Área y sección si aplica.
* Maestro titular.
* Asignaturas académicas con sus calificaciones.
* Módulos técnicos con sus calificaciones.
* Estado de cada asignatura o módulo.
* Calificación final cuando exista.

## Endpoints sugeridos

* `GET /reports/students/:studentId/report-card?period=1`
* `GET /reports/students/:studentId/report-card?period=2`
* `GET /reports/students/:studentId/report-card?period=3`
* `GET /reports/students/:studentId/report-card?period=4`
* `GET /reports/courses/:courseId/report-cards?period=1`

## Criterios de aceptación

* El endpoint devuelve un PDF.
* El PDF muestra solo las calificaciones según el período elegido.
* El PDF puede generarse con datos incompletos.
* El docente titular solo genera boletines de su curso.
* El admin genera boletines de cualquier curso de su escuela.
* La generación queda registrada en auditoría.

---

# Fase 11: Seed inicial y datos de prueba

## Objetivo

Crear datos iniciales para probar el sistema.

## Crear seed con:

1. Una escuela.
2. Un año escolar activo.
3. Un usuario super admin.
4. Un usuario admin.
5. Dos docentes.
6. Dos cursos.
7. Algunos estudiantes.
8. Asignaturas académicas.
9. Asignaturas técnicas.
10. Asignaciones docentes.
11. RA técnicos de prueba.
12. Calificaciones académicas y técnicas de prueba.

## Criterios de aceptación

* Se puede correr `npm run seed`.
* El sistema queda con datos suficientes para probar login, permisos, calificaciones y boletines.

---

# Fase 12: Pruebas

## Objetivo

Asegurar que las reglas principales funcionen correctamente.

## Pruebas unitarias necesarias

### Académico

* Cálculo de PC.
* Redondeo de PC a una cifra decimal.
* Cálculo de CF.
* Redondeo de CF.
* Cálculo de CCF.
* Cálculo de CEXF.
* Cálculo de CEF.
* Validación de recuperación menor que ordinaria.
* Validación de CF + CE no mayor que 100.
* Validación de derecho a especial.

### Técnico

* Cálculo de mínimo de RA.
* Validación de nota sobre peso.
* Validación de recuperación 1.
* Validación de recuperación 2.
* Cálculo de sumatoria final.
* Validación de especial técnica solo si total menor que 70.
* Validación de especial solo en RA no aprobados.

### Permisos

* Docente solo ve sus asignaturas.
* Admin solo ve su escuela.
* Super admin ve todas las escuelas.
* Titular puede generar boletín.
* Docente no titular no puede generar boletín.

## Criterios de aceptación

* Las pruebas principales pasan.
* El cálculo de notas coincide con las reglas definidas.
* Los permisos bloquean accesos indebidos.

---

# Fase 13: Documentación mínima

## Objetivo

Dejar documentación clara para continuar el desarrollo.

## Crear documentación de:

1. Instalación del proyecto.
2. Variables de entorno.
3. Conexión con Supabase.
4. Comandos Prisma.
5. Comandos de migración.
6. Comando de seed.
7. Roles del sistema.
8. Reglas de calificación académica.
9. Reglas de calificación técnica.
10. Formatos de Excel esperados.
11. Endpoints principales.

## Criterios de aceptación

* Un desarrollador puede levantar el backend siguiendo el README.
* Las reglas del sistema quedan explicadas.
* Las plantillas de Excel quedan documentadas.

---

# Orden recomendado de implementación

1. Crear proyecto NestJS.
2. Configurar Prisma y Supabase PostgreSQL.
3. Crear modelos Prisma.
4. Ejecutar migraciones.
5. Crear módulo Auth.
6. Crear roles y guards.
7. Crear CRUD base.
8. Crear asignaciones docentes.
9. Crear motor académico.
10. Crear motor técnico.
11. Crear importación de estudiantes.
12. Crear importación de calificaciones académicas.
13. Crear importación de calificaciones técnicas.
14. Crear auditoría.
15. Crear generación de boletines PDF.
16. Crear seed.
17. Crear pruebas.
18. Crear documentación.

---

# Resultado esperado del MVP backend

Al finalizar, el backend debe permitir:

* Administrar varias escuelas.
* Administrar años escolares por escuela.
* Administrar cursos.
* Administrar estudiantes con número de lista.
* Administrar maestros.
* Administrar asignaturas académicas y técnicas.
* Asignar maestros a cursos y asignaturas.
* Definir maestros titulares.
* Registrar calificaciones académicas.
* Calcular PC, CF, CCF, CEXF, CEF y estados.
* Registrar calificaciones técnicas por RA.
* Calcular sumatoria final de módulos técnicos.
* Validar recuperaciones y pruebas especiales.
* Importar estudiantes desde Excel.
* Importar calificaciones desde Excel.
* Generar boletines PDF por estudiante y por curso.
* Respetar permisos por rol y escuela.
* Registrar auditoría de cambios importantes.
