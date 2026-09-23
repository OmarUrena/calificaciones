# Backend en Vercel

El proyecto de Vercel debe usar `back` como Root Directory. `vercel.json` fija
el preset NestJS; no necesita una entrada en `functions` para `src/main.ts`.
Usar Node.js 22 (>=22.17) o 24, compatible con `@sparticuz/chromium`.

## Boletines PDF

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
