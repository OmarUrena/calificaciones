<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md

## Proyecto
Este repositorio contiene CalifApp:
- back/: backend NestJS + Prisma + Supabase PostgreSQL
- front/: frontend Next.js + TypeScript + Tailwind + shadcn/ui

## Reglas generales
- Trabaja solo en la carpeta indicada por el usuario.
- No cambies reglas de negocio sin pedir confirmación.
- No elimines archivos existentes sin explicar por qué.
- Mantén el código modular, tipado y en español cuando sea visible para usuarios.

## Backend
- Multi-escuela obligatorio.
- Todo recurso escolar debe filtrarse por schoolId.
- Roles: SUPER_ADMIN, ADMIN, TEACHER.
- Las reglas de calificación están en PROJECT_CONTEXT.md.

## Frontend
- Estilo formal institucional.
- Colores azules y grises.
- Sin tema oscuro.
- Toda la app web va en front/.