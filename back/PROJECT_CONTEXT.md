Claro. Aquí tienes el contenido listo para copiar en un archivo llamado **`PROJECT_CONTEXT.md`** dentro del repositorio. Este contexto resume las reglas del MVP que definimos, tomando como base el registro de 4.º grado de la Modalidad Técnico Profesional del sistema educativo dominicano. 

# PROJECT_CONTEXT.md

# Sistema de Calificaciones Escolares - MVP Backend

## 1. Descripción general del proyecto

Este proyecto consiste en desarrollar el backend de una aplicación web para la gestión de calificaciones escolares en el sistema educativo dominicano, especialmente para centros de la Modalidad Técnico Profesional.

El objetivo principal del MVP es automatizar la gestión de calificaciones y la generación de boletines PDF para facilitar el trabajo de los docentes y del equipo de gestión.

La aplicación debe funcionar para múltiples escuelas. Cada escuela tendrá sus propios usuarios, docentes, cursos, estudiantes, asignaturas, módulos técnicos, años escolares y calificaciones.

---

# 2. Stack tecnológico definido

Backend: NestJS
Lenguaje: TypeScript
Base de datos: Supabase PostgreSQL
ORM: Prisma
Autenticación: Supabase Auth integrada con permisos internos en NestJS
Storage: Supabase Storage para logos de escuelas
Importación Excel: ExcelJS
Generación PDF: Puppeteer o Playwright
Arquitectura: API REST modular

---

# 3. Objetivo del MVP

El MVP debe permitir:

* Administrar varias escuelas.
* Administrar años escolares por escuela.
* Administrar cursos.
* Administrar estudiantes.
* Administrar maestros.
* Administrar asignaturas académicas y técnicas.
* Relacionar maestros, asignaturas y cursos.
* Definir maestros titulares de cursos.
* Registrar calificaciones académicas.
* Registrar calificaciones técnicas.
* Importar estudiantes desde Excel.
* Importar calificaciones desde Excel.
* Generar boletines PDF en tiempo real.
* Respetar permisos por rol.
* Registrar auditoría básica.
* Validar correctamente las reglas de calificación académica y técnica.

El MVP no manejará todavía asignaturas pendientes de años anteriores.

---

# 4. Arquitectura multi-escuela

La aplicación debe estar preparada desde el inicio para funcionar en varias escuelas.

Cada escuela debe estar representada por una entidad `School`.

Cada registro importante debe pertenecer a una escuela mediante `schoolId`.

Tablas que deben tener `schoolId`:

* users
* teachers
* courses
* students
* subjects
* school_years
* teacher_assignments
* academic_grades
* academic_subject_results
* technical_learning_outcomes
* technical_grades
* technical_subject_results
* import_jobs
* audit_logs

Regla fundamental:

```text
Toda consulta del backend debe filtrar por schoolId, excepto cuando el usuario sea SUPER_ADMIN.
```

Un usuario de una escuela no puede ver ni modificar datos de otra escuela.

---

# 5. Roles del sistema

El sistema tendrá tres roles principales:

## 5.1 SUPER_ADMIN

Puede:

* Crear escuelas.
* Ver todas las escuelas.
* Administrar usuarios administrativos de escuelas.
* Acceder a datos globales si es necesario.

## 5.2 ADMIN

Usuario administrativo de una escuela.

Puede:

* Ver todos los datos de su escuela.
* Crear cursos.
* Crear estudiantes.
* Crear maestros.
* Crear asignaturas.
* Asignar maestros a cursos y asignaturas.
* Registrar o corregir calificaciones de su escuela.
* Importar estudiantes.
* Importar calificaciones.
* Generar boletines PDF de todos los cursos de su escuela.

No puede:

* Ver datos de otras escuelas.
* Administrar escuelas que no sean la suya.

## 5.3 TEACHER

Usuario docente.

Puede:

* Ver solo las asignaturas que imparte.
* Registrar calificaciones solo de sus asignaturas asignadas.
* Importar calificaciones solo de sus asignaturas asignadas.
* Generar boletines solo si es maestro titular del curso.

No puede:

* Ver calificaciones de asignaturas que no imparte.
* Editar cursos.
* Editar maestros.
* Editar asignaturas globales.
* Generar boletines de cursos donde no sea titular.

---

# 6. Entidades principales del sistema

## 6.1 School

Representa una institución educativa.

Campos mínimos:

* id
* name
* code
* address
* phone
* logoUrl
* isActive
* createdAt
* updatedAt

## 6.2 SchoolYear

Representa el año escolar de una escuela.

Campos mínimos:

* id
* schoolId
* name
* isActive
* createdAt
* updatedAt

Ejemplo:

```text
2025-2026
```

Regla:

```text
Una escuela no puede tener dos años escolares con el mismo nombre.
```

## 6.3 User

Representa un usuario que accede al sistema.

Campos mínimos:

* id
* schoolId
* teacherId
* email
* fullName
* role
* isActive
* createdAt
* updatedAt

Roles:

* SUPER_ADMIN
* ADMIN
* TEACHER

## 6.4 Teacher

Representa un maestro.

Campos mínimos:

* id
* schoolId
* name
* createdAt
* updatedAt

Un maestro puede:

* Tener un usuario asociado.
* Impartir varias asignaturas.
* Ser titular de uno o varios cursos.

## 6.5 Course

Representa un curso o sección.

Campos mínimos:

* id
* schoolId
* schoolYearId
* name
* grade
* section
* area
* modality
* titularId
* createdAt
* updatedAt

Ejemplos:

```text
4to A Informática
4to B Enfermería
5to A Desarrollo y Administración de Aplicaciones Informáticas
```

El campo `titularId` apunta al maestro titular del curso.

## 6.6 Student

Representa un estudiante.

Para el MVP solo tendrá:

* id
* schoolId
* schoolYearId
* courseId
* listNumber
* firstName
* lastName
* createdAt
* updatedAt

Regla importante:

```text
No puede repetirse el mismo número de lista dentro del mismo curso, escuela y año escolar.
```

Restricción sugerida:

```text
UNIQUE(schoolId, schoolYearId, courseId, listNumber)
```

## 6.7 Subject

Representa una asignatura académica o técnica.

Campos mínimos:

* id
* schoolId
* name
* type
* isActive
* createdAt
* updatedAt

Tipos:

* ACADEMIC
* TECHNICAL

Ejemplos académicos:

* Lengua Española
* Matemática
* Ciencias Sociales
* Biología
* Inglés

Ejemplos técnicos:

* Diseño de Portales Web
* Desarrollo de Aplicaciones
* Análisis y Diseño de Sistemas
* Base de Datos

## 6.8 TeacherAssignment

Representa la relación entre maestro, asignatura y curso.

Define:

```text
Qué maestro imparte qué asignatura en qué curso y en qué año escolar.
```

Campos mínimos:

* id
* schoolId
* schoolYearId
* teacherId
* subjectId
* courseId
* isActive
* createdAt
* updatedAt

Regla clave:

```text
No pueden existir dos maestros activos impartiendo la misma asignatura en el mismo curso y año escolar.
```

Restricción sugerida:

```text
UNIQUE(schoolId, schoolYearId, courseId, subjectId)
```

Esta relación es independiente de si la asignatura es académica o técnica.

---

# 7. Componente académico

## 7.1 Concepto general

Cada asignatura académica tiene cuatro bloques de competencias.

Para el MVP no se necesita guardar el nombre completo de cada competencia. Basta con manejar:

* Bloque 1
* Bloque 2
* Bloque 3
* Bloque 4

Cada bloque produce un promedio:

* Bloque 1 → PC1
* Bloque 2 → PC2
* Bloque 3 → PC3
* Bloque 4 → PC4

La calificación final de la asignatura académica se calcula con PC1, PC2, PC3 y PC4.

---

## 7.2 Estructura de notas por bloque

Cada bloque tiene cuatro notas ordinarias:

* P1
* P2
* P3
* P4

Y cuatro recuperaciones correspondientes:

* RP1
* RP2
* RP3
* RP4

Ejemplo:

```text
Bloque 1:
P1, RP1, P2, RP2, P3, RP3, P4, RP4 → PC1
```

---

## 7.3 Recuperación académica

La recuperación solo aplica cuando la nota ordinaria está por debajo de 70.

Regla:

```text
Si la nota ordinaria es 70 o más, no necesita recuperación.
Si la nota ordinaria es menor que 70, puede registrarse recuperación.
Si existe recuperación, la recuperación será la nota válida.
Si no existe recuperación, la nota ordinaria será la nota válida.
```

La recuperación nunca debe ser menor que la nota ordinaria.

Ejemplo:

```text
Si P1 = 60, RP1 no puede ser menor que 60.
```

Si el estudiante no tomó la recuperación, el docente puede registrar como recuperación la misma nota ordinaria, pero el sistema no debe hacerlo automáticamente.

---

## 7.4 Cálculo de PC

Cada PC se calcula promediando las cuatro notas válidas del bloque.

Ejemplo:

```text
PC1 = promedio(B1_P1_valida, B1_P2_valida, B1_P3_valida, B1_P4_valida)
```

Los PC no se redondean a entero. Se redondean a una cifra decimal.

Ejemplo:

```text
78.75 → 78.8
```

---

## 7.5 Cálculo de CF

La calificación final ordinaria de la asignatura académica se calcula así:

```text
CF = promedio(PC1, PC2, PC3, PC4)
```

La CF se redondea a entero.

Si CF es 70 o más:

```text
status = APPROVED
```

Si CF es menor que 70:

```text
status = COMPLETIVA
```

---

# 8. Pruebas finales académicas

## 8.1 Completiva

Aplica cuando CF es menor que 70.

Fórmula:

```text
CCF = (CF * 0.50) + (CEC * 0.50)
```

Donde:

* CF = calificación final ordinaria.
* CEC = calificación de evaluación completiva.
* CCF = calificación completiva final.

CCF se redondea a entero.

Si CCF es 70 o más:

```text
status = APPROVED
```

Si CCF es menor que 70:

```text
status = EXTRAORDINARIA
```

---

## 8.2 Extraordinaria

Aplica si el estudiante no aprueba en completiva.

Fórmula:

```text
CEXF = (CF * 0.30) + (CEEX * 0.70)
```

Importante:

```text
La extraordinaria usa la CF original, no la CCF.
```

Donde:

* CF = calificación final ordinaria original.
* CEEX = calificación de evaluación extraordinaria.
* CEXF = calificación extraordinaria final.

CEXF se redondea a entero.

Si CEXF es 70 o más:

```text
status = APPROVED
```

Si CEXF es menor que 70, se evalúa el derecho a prueba especial.

---

## 8.3 Derecho a prueba especial académica

Después de extraordinaria, el sistema debe contar cuántas asignaturas académicas quedaron con CEXF menor que 70 para el estudiante.

Regla:

```text
Si el estudiante reprueba en extraordinaria 1 o 2 asignaturas, tiene derecho a prueba especial.
Si reprueba más de 2 asignaturas en extraordinaria, pierde el derecho a prueba especial y queda reprobado.
```

Si pierde el derecho:

```text
status = FAILED
```

Si tiene derecho:

```text
status = SPECIAL
```

---

## 8.4 Especial académica

La prueba especial académica no se calcula por porcentaje.

Se conserva el 100% de la CF original y se suma la calificación especial obtenida.

Fórmula:

```text
CEF = CF + CE
```

Donde:

* CF = calificación final ordinaria original.
* CE = puntos obtenidos en prueba especial.
* CEF = calificación especial final.

Regla:

```text
CF + CE no puede ser mayor que 100.
```

Si CEF es 70 o más:

```text
status = APPROVED
```

Si CEF es menor que 70:

```text
status = FAILED
```

---

## 8.5 Estados académicos

Estados simplificados:

* PENDING
* APPROVED
* COMPLETIVA
* EXTRAORDINARIA
* SPECIAL
* FAILED

No es necesario usar estados como “Aprobado en completiva” o “Aprobado en extraordinaria”. Si el estudiante aprobó, el estado será simplemente APPROVED. Las calificaciones registradas permitirán saber en qué etapa aprobó.

---

# 9. Componente técnico

## 9.1 Concepto general

El componente técnico se organiza por módulos formativos.

En la base de datos, cada módulo técnico se manejará como una asignatura de tipo TECHNICAL.

Cada módulo tiene varios Resultados de Aprendizaje, llamados RA.

Ejemplo:

```text
Módulo Técnico → RA1, RA2, RA3, RA4
```

Cada RA tiene un peso.

La suma de los pesos de todos los RA de un módulo debe ser 100.

---

## 9.2 Peso y calificación de cada RA

Cada RA se califica en base a su peso.

Ejemplo:

```text
Si RA1 tiene peso 20, la nota de RA1 debe estar entre 0 y 20.
Si RA2 tiene peso 15, la nota de RA2 debe estar entre 0 y 15.
```

La nota no se registra de 0 a 100, sino de 0 al peso del RA.

---

## 9.3 Mínimo aprobatorio del RA

Cada RA se considera aprobado individualmente si alcanza el 70% de su peso.

Fórmula:

```text
minimo_RA = peso_RA * 0.70
```

Ejemplo:

```text
Si RA1 pesa 20, su mínimo aprobatorio es 14.
```

---

## 9.4 Recuperaciones técnicas

Cada RA puede tener:

* Nota ordinaria
* Recuperación 1
* Recuperación 2
* Prueba especial

Las recuperaciones son consecutivas.

Regla:

```text
Si la nota ordinaria no alcanza el mínimo del RA, se habilita recuperación 1.
Si recuperación 1 no alcanza el mínimo del RA, se habilita recuperación 2.
Si recuperación 2 no alcanza el mínimo del RA, el RA queda pendiente para posible prueba especial.
```

La recuperación nunca debe ser menor que la nota anterior.

Reglas:

```text
recovery1 >= ordinary
recovery2 >= recovery1
```

Si el estudiante no tomó la recuperación, el maestro puede registrar la misma nota anterior, pero el sistema no debe completarla automáticamente.

La nota válida siempre será la última recuperación registrada.

Ejemplo:

```text
ordinary = 10
recovery1 = 12
recovery2 = 13
validScore = 13
```

---

## 9.5 Aprobación del módulo técnico

La calificación final del módulo técnico se obtiene por sumatoria de las notas válidas de todos los RA.

Fórmula:

```text
totalScore = suma(validScore de todos los RA)
```

El módulo se aprueba si:

```text
totalScore >= 70
```

Importante:

```text
El estudiante puede aprobar el módulo aunque tenga uno o más RA por debajo del mínimo individual, siempre que la sumatoria final del módulo sea 70 o más.
```

---

## 9.6 Prueba especial técnica

La prueba especial técnica no se aplica automáticamente por tener un RA no aprobado.

Solo se aplica cuando:

```text
La sumatoria final del módulo es menor que 70.
```

Además:

```text
La prueba especial técnica solo se aplica a los RA no aprobados.
```

Después de registrar la prueba especial en los RA no aprobados, se recalcula la sumatoria final.

Si la nueva sumatoria es 70 o más:

```text
status = APPROVED
```

Si sigue por debajo de 70:

```text
status = FAILED
```

---

## 9.7 Estados técnicos

Se usan los mismos estados simplificados:

* PENDING
* APPROVED
* SPECIAL
* FAILED

También puede usarse COMPLETIVA y EXTRAORDINARIA en el enum general, aunque para técnico no apliquen directamente.

---

# 10. Redondeo

## Académico

Los PC se redondean a una cifra decimal.

```text
78.75 → 78.8
```

CF, CCF, CEXF y CEF se redondean a entero.

## Técnico

La sumatoria del módulo puede guardarse como decimal.

Si se requiere mostrar una nota final entera, se puede usar `finalScore` redondeado a entero.

---

# 11. Validaciones principales

## 11.1 Validaciones académicas

* P1, P2, P3, P4 deben estar entre 0 y 100.
* RP1, RP2, RP3, RP4 deben estar entre 0 y 100.
* CEC debe estar entre 0 y 100.
* CEEX debe estar entre 0 y 100.
* RP no puede ser menor que la nota ordinaria correspondiente.
* CF + CE no puede pasar de 100.
* blockNumber solo puede ser 1, 2, 3 o 4.

## 11.2 Validaciones técnicas

* La suma de los pesos de los RA de un módulo debe ser 100.
* La nota ordinaria de un RA no puede superar el peso del RA.
* Recuperación 1 no puede superar el peso del RA.
* Recuperación 2 no puede superar el peso del RA.
* Especial no puede superar el peso del RA.
* Recuperación 1 no puede ser menor que la nota ordinaria.
* Recuperación 2 no puede ser menor que recuperación 1.
* Especial técnica solo se permite en RA no aprobados.
* Especial técnica solo se permite si el total del módulo es menor que 70.

## 11.3 Validaciones de usuarios y permisos

* Un ADMIN solo puede gestionar datos de su escuela.
* Un TEACHER solo puede ver y editar sus asignaturas asignadas.
* Un TEACHER solo puede generar boletines si es titular del curso.
* Un SUPER_ADMIN puede administrar todas las escuelas.
* Todas las consultas deben respetar `schoolId`.

## 11.4 Validaciones de asignaciones docentes

* No se puede repetir la combinación schoolId + schoolYearId + courseId + subjectId.
* Un maestro asignado debe pertenecer a la misma escuela.
* Una asignatura asignada debe pertenecer a la misma escuela.
* Un curso asignado debe pertenecer a la misma escuela y año escolar.

## 11.5 Validaciones de estudiantes

* El número de lista es obligatorio.
* Nombres y apellidos son obligatorios.
* El estudiante pertenece a un curso.
* El estudiante pertenece a un año escolar.
* No se repite el número de lista en el mismo curso, escuela y año escolar.

---

# 12. Importación desde Excel

El sistema debe permitir importar:

* Estudiantes.
* Calificaciones académicas.
* Calificaciones técnicas.

Cada importación debe generar un registro `ImportJob`.

## 12.1 Importación de estudiantes

Columnas esperadas:

* numero_lista
* nombres
* apellidos
* curso

Validaciones:

* numero_lista obligatorio.
* nombres obligatorio.
* apellidos obligatorio.
* curso existente.
* no repetir número de lista dentro del curso, escuela y año escolar.

## 12.2 Importación de calificaciones académicas

Columnas sugeridas:

* numero_lista
* asignatura
* B1_P1
* B1_RP1
* B1_P2
* B1_RP2
* B1_P3
* B1_RP3
* B1_P4
* B1_RP4
* B2_P1
* B2_RP1
* B2_P2
* B2_RP2
* B2_P3
* B2_RP3
* B2_P4
* B2_RP4
* B3_P1
* B3_RP1
* B3_P2
* B3_RP2
* B3_P3
* B3_RP3
* B3_P4
* B3_RP4
* B4_P1
* B4_RP1
* B4_P2
* B4_RP2
* B4_P3
* B4_RP3
* B4_P4
* B4_RP4
* CEC
* CEEX
* CE

Validaciones:

* Estudiante existe.
* Asignatura existe.
* Asignatura es ACADEMIC.
* Asignatura está asignada al curso.
* Si el usuario es docente, debe ser el docente asignado a esa asignatura en ese curso.
* Las calificaciones están entre 0 y 100.
* Las recuperaciones no son menores que las ordinarias.
* CF + CE no supera 100.

## 12.3 Importación de calificaciones técnicas

Columnas sugeridas:

* numero_lista
* modulo
* RA1
* RA1_R1
* RA1_R2
* RA1_ESP
* RA2
* RA2_R1
* RA2_R2
* RA2_ESP
* RA3
* RA3_R1
* RA3_R2
* RA3_ESP

La cantidad de RA depende de los RA definidos para el módulo técnico.

Validaciones:

* Estudiante existe.
* Módulo técnico existe.
* Módulo es TECHNICAL.
* Módulo está asignado al curso.
* Si el usuario es docente, debe ser el docente asignado a ese módulo.
* El RA existe.
* La nota del RA no supera el peso del RA.
* Recuperación 1 no es menor que la ordinaria.
* Recuperación 2 no es menor que recuperación 1.
* Especial solo se permite si aplica.

## 12.4 ImportJob

Cada importación debe guardar:

* id
* schoolId
* schoolYearId
* userId
* type
* fileName
* status
* totalRows
* successRows
* errorRows
* errors
* createdAt
* updatedAt

Los errores deben indicar la fila y el problema.

Ejemplo:

```text
Fila 12: estudiante no existe.
Fila 15: RP1 no puede ser menor que P1.
Fila 21: RA1 excede el peso permitido.
```

---

# 13. Boletines PDF

El sistema debe generar boletines PDF en tiempo real.

No se guardará historial de boletines.

El boletín puede generarse aunque las calificaciones estén incompletas.

## 13.1 Permisos para generar boletines

ADMIN:

```text
Puede generar boletines de todos los cursos de su escuela.
```

TEACHER:

```text
Solo puede generar boletines del curso donde sea maestro titular.
```

SUPER_ADMIN:

```text
Puede generar boletines de cualquier escuela si es necesario.
```

## 13.2 Selección de período

El usuario podrá elegir hasta qué período mostrar:

* period=1: mostrar P1.
* period=2: mostrar P1 y P2.
* period=3: mostrar P1, P2 y P3.
* period=4: mostrar P1, P2, P3 y P4.

En el boletín del periodo 1 solo se muestran calificaciones del periodo 1.

En el boletín del periodo 2 se muestran calificaciones de periodo 1 y periodo 2.

En el periodo 3 se muestran P1, P2 y P3.

En el periodo 4 se muestran P1, P2, P3 y P4, además de calificaciones finales cuando existan.

## 13.3 Información que debe mostrar el boletín

El boletín debe mostrar:

* Nombre de la institución.
* Logo de la institución si existe.
* Año escolar.
* Nombre completo del estudiante.
* Número de lista.
* Curso.
* Área del curso si aplica.
* Sección del curso si aplica.
* Maestro titular.
* Asignaturas académicas y sus calificaciones.
* Asignaturas técnicas y sus calificaciones.
* Estado de cada asignatura o módulo.
* Calificación final cuando esté disponible.

---

# 14. Auditoría

Se debe agregar auditoría básica.

Todas las tablas importantes deben tener:

* createdAt
* updatedAt
* createdBy
* updatedBy

Además, debe existir una tabla `AuditLog` para registrar eventos importantes.

## 14.1 Eventos a auditar

* Creación de escuela.
* Creación de año escolar.
* Creación de curso.
* Creación de estudiante.
* Creación de maestro.
* Creación de asignatura.
* Creación o cambio de asignación docente.
* Cambio de maestro titular.
* Registro o modificación de calificaciones académicas.
* Registro o modificación de calificaciones técnicas.
* Importación de estudiantes.
* Importación de calificaciones.
* Generación de boletines PDF.

## 14.2 Campos de AuditLog

* id
* schoolId
* userId
* entity
* entityId
* action
* oldValue
* newValue
* createdAt

Acciones:

* CREATE
* UPDATE
* DELETE
* IMPORT
* GENERATE_REPORT

---

# 15. Modelos Prisma esperados

El `schema.prisma` debe incluir como mínimo:

* School
* SchoolYear
* User
* Teacher
* Course
* Student
* Subject
* TeacherAssignment
* AcademicGrade
* AcademicSubjectResult
* TechnicalLearningOutcome
* TechnicalGrade
* TechnicalSubjectResult
* ImportJob
* AuditLog

Enums:

* UserRole
* SubjectType
* SubjectStatus
* ImportType
* ImportStatus
* AuditAction

---

# 16. Módulos NestJS esperados

La estructura recomendada del backend es:

```text
src/
  auth/
  schools/
  school-years/
  users/
  teachers/
  courses/
  students/
  subjects/
  teacher-assignments/
  academic-grades/
  technical-learning-outcomes/
  technical-grades/
  imports/
  reports/
  audit/
  common/
  prisma/
```

Cada módulo debe tener:

* controller
* service
* dto
* guards si aplica
* validators si aplica

La lógica de negocio no debe estar directamente en los controladores.

---

# 17. Endpoints principales sugeridos

## Auth

* POST /auth/login
* GET /auth/me

## Schools

* POST /schools
* GET /schools
* GET /schools/:id
* PATCH /schools/:id
* DELETE /schools/:id

## School Years

* POST /school-years
* GET /school-years
* PATCH /school-years/:id
* PATCH /school-years/:id/activate

## Teachers

* POST /teachers
* GET /teachers
* GET /teachers/:id
* PATCH /teachers/:id
* DELETE /teachers/:id

## Courses

* POST /courses
* GET /courses
* GET /courses/:id
* PATCH /courses/:id
* DELETE /courses/:id

## Students

* POST /students
* GET /students
* GET /students/:id
* PATCH /students/:id
* DELETE /students/:id

## Subjects

* POST /subjects
* GET /subjects
* GET /subjects/:id
* PATCH /subjects/:id
* DELETE /subjects/:id

## Teacher Assignments

* POST /teacher-assignments
* GET /teacher-assignments
* PATCH /teacher-assignments/:id
* DELETE /teacher-assignments/:id

## Academic Grades

* GET /academic-grades/course/:courseId/subject/:subjectId
* POST /academic-grades
* PATCH /academic-grades/:id
* POST /academic-grades/bulk
* POST /academic-grades/recalculate/student/:studentId/subject/:subjectId
* POST /academic-grades/final-evaluations
* POST /academic-grades/evaluate-special-right/:studentId

## Technical Learning Outcomes

* POST /technical-learning-outcomes
* GET /technical-learning-outcomes/subject/:subjectId
* PATCH /technical-learning-outcomes/:id
* DELETE /technical-learning-outcomes/:id

## Technical Grades

* GET /technical-grades/course/:courseId/subject/:subjectId
* POST /technical-grades
* PATCH /technical-grades/:id
* POST /technical-grades/bulk
* POST /technical-grades/recalculate/student/:studentId/subject/:subjectId

## Imports

* POST /imports/students
* POST /imports/academic-grades
* POST /imports/technical-grades
* GET /imports
* GET /imports/:id

## Reports

* GET /reports/students/:studentId/report-card?period=1
* GET /reports/courses/:courseId/report-cards?period=1

---

# 18. Reglas de seguridad

El backend debe validar siempre:

* Quién es el usuario.
* A qué escuela pertenece.
* Qué rol tiene.
* Si tiene permiso para la operación.
* Si el recurso pertenece a su escuela.
* Si el docente imparte la asignatura que intenta modificar.
* Si el docente es titular del curso para generar boletín.

Nunca se debe confiar únicamente en el frontend.

---

# 19. Prioridad de implementación

Implementar en este orden:

1. Crear proyecto NestJS.
2. Configurar Prisma.
3. Conectar Supabase PostgreSQL.
4. Crear schema Prisma.
5. Ejecutar migraciones.
6. Crear seed básico.
7. Implementar Auth.
8. Implementar roles y guards.
9. Implementar CRUD base.
10. Implementar asignaciones docentes.
11. Implementar motor académico.
12. Implementar motor técnico.
13. Implementar importación Excel.
14. Implementar auditoría.
15. Implementar generación PDF.
16. Crear pruebas.
17. Documentar el proyecto.

---

# 20. Criterios de éxito del MVP

El backend se considera funcional cuando permita:

* Crear una escuela.
* Crear un año escolar.
* Crear usuarios admin y docentes.
* Crear maestros.
* Crear cursos.
* Crear estudiantes con número de lista.
* Crear asignaturas académicas y técnicas.
* Asignar maestros a asignaturas y cursos.
* Definir maestro titular.
* Registrar calificaciones académicas.
* Calcular PC, CF, CCF, CEXF, CEF y estado.
* Registrar calificaciones técnicas por RA.
* Calcular sumatoria técnica y estado.
* Importar estudiantes desde Excel.
* Importar calificaciones desde Excel.
* Generar boletines PDF por estudiante.
* Generar boletines PDF por curso.
* Respetar permisos por rol.
* Respetar aislamiento por escuela.
* Auditar cambios importantes.

