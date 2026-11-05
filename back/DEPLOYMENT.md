# Backend en Vercel

El proyecto de Vercel debe usar `back` como Root Directory. `vercel.json` fija
el preset NestJS; no necesita una entrada en `functions` para `src/main.ts`.
Usar Node.js 22 (>=22.17) o 24, compatible con `@sparticuz/chromium`.

## Despliegue de controles P y RP

Usar `npm run build` como Build Command del backend. Este comando regenera el
cliente de Prisma antes de compilar NestJS, incluso cuando Vercel reutiliza
dependencias de una compilación anterior.

Publicar tanto `back/` como `front/` desde el mismo commit. En el proyecto del
frontend, `NEXT_PUBLIC_API_URL` debe apuntar a la URL publicada del backend con
el sufijo `/api`. Si se cambia esa variable, volver a desplegar el frontend.

Si al cambiar un período aparece `property rp3Enabled should not exist`, la API
que recibe la petición no reconoce los controles actuales. Revisar la URL de
API configurada y desplegar el backend desde el commit actualizado. Aplicar solo
la migración de base de datos no actualiza los validadores del servidor.

Después del despliegue, comprobar con una sesión administrativa que
`GET /api/school-years` devuelve ocho valores booleanos: `p1Enabled` a
`p4Enabled` y `rp1Enabled` a `rp4Enabled`. El frontend informa si faltan estos
estados en lugar de mostrarlos todos como inactivos.

## Calificaciones ingresadas enteras

Las descargas de importación usan nombres con el curso y la asignatura o módulo.
El servidor devuelve el nombre en `Content-Disposition` y CORS lo expone al
frontend. Desplegar ambos proyectos para que el navegador use estos nombres.

Las notas ingresadas (P/RP, ordinaria, recuperaciones y especial) deben ser
enteros. Un valor numérico `90.0` equivale a `90` y se acepta; `90.5` se rechaza.
Los promedios PC, sumatorias y pesos de RA conservan su precisión y reglas.

Los inputs usan paso de 1, las validaciones del cliente y del servidor rechazan
fracciones, y las plantillas de Excel solicitan números enteros. El importador
valida todos los campos numéricos de la fila antes de escribir sus notas para
evitar que un decimal en un bloque o RA posterior guarde notas anteriores.

Auditoría de datos, sin modificaciones:

```sh
npm run grades:check-integers
npm run grades:check-integers -- --details
npm run grades:check-integers -- --report
```

El informe local se guarda en `artifacts/notas-decimales-para-revision.csv`, fuera
del control de versiones porque contiene datos de estudiantes. El 2026-11-04 se
identificaron 23 notas con fracciones (10 académicas y 13 técnicas). Por petición
del usuario se conservan para revisión, sin redondearlas ni recalcular resultados.

La migración `20261104130000_integer_grade_constraints` usa dos restricciones
`CHECK ... NOT VALID`: conserva las excepciones históricas y exige enteros en
cualquier fila insertada o actualizada. Una fila con notas históricas fraccionarias
necesita corregirse explícitamente antes de guardarse otra vez. Las consultas y
boletines siguen mostrando sus valores originales.

No convertir aún esas columnas a `Int`. Después de revisar y corregir todas las
excepciones, volver a ejecutar la auditoría, validar las restricciones y preparar
la conversión de tipos. Los promedios calculados no deben convertirse a enteros.

Para aplicar únicamente esta migración con comprobaciones y prueba SQL en tablas
temporales, se puede usar `node scripts/integer-grades.cjs deploy`. El comando
se detiene si encuentra otras migraciones pendientes; no corrige ninguna nota.

Publicar backend y frontend para activar también las validaciones y el paso de
los inputs. La compilación debe seguir regenerando Prisma.

## Boletines PDF

La portada conserva los recuadros de firmas y observaciones, usa la misma fuente
Arial de las notas y muestra código, dirección y regional educativa del centro.
El campo opcional `educationalRegion` se edita tanto en Escuelas como en
Configuración de escuela. La migración
`20261104140000_school_educational_region` añade esa columna a `schools`.
Aplicar la migración y publicar backend y frontend juntos; el backend debe
regenerar Prisma con `npm run build`.

La sección «Mis asignaturas» permite abrir «PDF de calificaciones» y marcar
uno o varios períodos o RA. `GET /api/reports/assignments/:assignmentId/grades`
recibe períodos con parámetros repetidos, por ejemplo `?periods=1&periods=3`,
o RA con `?outcomeIds=<id1>&outcomeIds=<id2>`. Solo se exporta la selección.
`GET /api/reports/assignments/:assignmentId/grade-options` lista los RA disponibles,
incluidos RA históricos con notas del mismo curso. Se conserva `period` como
parámetro compatible para clientes anteriores.

Estos PDF se generan en carta vertical, con casillas de notas de 7 mm, tipografía
compacta y tablas con hasta dos períodos académicos o cuatro RA. Los boletines
individuales y por curso conservan su formato horizontal. El docente debe tener una asignación activa
en su propia escuela; esta descarga no requiere titularidad. Los boletines por
estudiante y curso conservan sus permisos de titularidad existentes.

Publicar backend y frontend para activar el botón y el endpoint. Usa el mismo
Chromium y configuración de generación que los boletines; no requiere migración.

En Vercel (`VERCEL=1`), el backend usa el Chromium Linux incluido en
`@sparticuz/chromium`. El análisis de dependencias de Vercel incluye los archivos
comprimidos de `node_modules/@sparticuz/chromium/bin`; el paquete los extrae a
`/tmp` al generar el primer PDF. No requiere
descargar navegadores durante una solicitud ni una variable con una URL externa.
Las solicitudes concurrentes comparten la extracción, pero cada PDF usa su propio
navegador, que se cierra incluso si la generación falla.

Playwright y Chromium están fijados a versiones compatibles (Chromium 148).
Al actualizarlos, comprobar la versión en `playwright-core/browsers.json` y probar
la generación en un despliegue Linux de Vercel.

No añadir `functions["src/main.ts"]` para incluir los binarios: la validación
del adaptador NestJS puede rechazar ese patrón antes de iniciar la compilación.
Para comprobar la inclusión de los binarios después de actualizar dependencias:

```sh
npm run build
npm exec --yes --package=@vercel/nft -- nft print dist/src/reports/report-browser.js
```

La sección `FILELIST` debe incluir `al2023.tar.br`, `chromium.br`, `fonts.tar.br`
y `swiftshader.tar.br` dentro de `node_modules/@sparticuz/chromium/bin`.

Después de subir estos cambios, realizar un nuevo despliegue y descargar tanto
un boletín individual como los boletines de un curso. Las pruebas locales de
Windows verifican el PDF y su descarga, pero no ejecutan el binario Linux.

Para desarrollo local, instalar el navegador de Playwright una vez:

```sh
npx playwright install chromium
npm run build
node --test test/report-browser.test.cjs test/reports-pdf.test.cjs
```
