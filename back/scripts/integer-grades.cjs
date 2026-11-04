// Audit or export historical exceptions; "deploy" only adds constraints without changing grades.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const connection = new URL(process.env.DATABASE_URL);
if (connection.hostname.endsWith('.pooler.supabase.com') && connection.port === '6543') {
  connection.port = '5432';
  connection.searchParams.delete('pgbouncer');
}
connection.searchParams.set('connect_timeout', '15');
const prisma = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
const fields = {
  academic_grades: ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'],
  technical_grades: ['ordinaryScore', 'recovery1Score', 'recovery2Score', 'specialScore'],
};
const auditSql = Object.entries(fields).flatMap(([table, columns]) => columns.map((column) =>
  `SELECT '${table}.${column}' AS field, COUNT(*)::int AS rows, COUNT("${column}")::int AS populated,
   COUNT(*) FILTER (WHERE "${column}" <> TRUNC("${column}"::numeric))::int AS fractional,
   COALESCE(SUM("${column}"), 0)::text AS total FROM "${table}"`,
)).join(' UNION ALL ');

async function verifyConstraints(migrationSql) {
  await prisma.$transaction(async (tx) => {
    for (const [table, columns] of Object.entries(fields)) {
      const temporary = `integer_grade_test_${table}`;
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE "${temporary}" (${columns.map((column) => `"${column}" numeric(5,2)`).join(', ')}) ON COMMIT DROP`);
      await tx.$executeRawUnsafe(`INSERT INTO "${temporary}" ("${columns[0]}") VALUES (7.5)`);
      const rule = migrationSql.match(new RegExp(`ALTER TABLE "${table}"[\\s\\S]*?NOT VALID;`))?.[0];
      if (!rule) throw new Error(`No se encontró la restricción de ${table}.`);
      await tx.$executeRawUnsafe(rule.replace(`ALTER TABLE "${table}"`, `ALTER TABLE "${temporary}"`));
      for (const column of columns) {
        await tx.$executeRawUnsafe('SAVEPOINT fractional_grade_test');
        let rejected = false;
        try {
          await tx.$executeRawUnsafe(`INSERT INTO "${temporary}" ("${column}") VALUES (7.5)`);
        } catch (error) {
          if (error.meta?.code !== '23514') throw error;
          rejected = true;
        }
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT fractional_grade_test');
        if (!rejected) throw new Error(`La base de datos permitió un decimal en ${column}.`);
        await tx.$executeRawUnsafe(`INSERT INTO "${temporary}" ("${column}") VALUES (90.0), (0), (NULL)`);
      }
      const preserved = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${temporary}" WHERE "${columns[0]}" = 7.5`);
      if (preserved[0].count !== 1) throw new Error('La prueba alteró un valor histórico.');
    }
  }, { timeout: 60000 });
  console.log('Prueba SQL aprobada en tablas temporales: los doce campos rechazan fracciones, aceptan enteros/cero/nulo y conservan excepciones previas.');
}

(async () => {
  try {
    const before = await prisma.$queryRawUnsafe(auditSql);
    console.table(before.map(({ total, ...row }) => row));
    const fractionalCount = before.reduce((sum, row) => sum + row.fractional, 0);
    if (fractionalCount > 0) {
      if (process.argv.includes('--details')) {
        const detailsSql = Object.entries(fields).flatMap(([table, columns]) => columns.map((column) =>
          `SELECT '${table}.${column}' AS field, "${column}"::text AS value, COUNT(*)::int AS count
           FROM "${table}" WHERE "${column}" <> TRUNC("${column}"::numeric) GROUP BY "${column}"`,
        )).join(' UNION ALL ');
        console.table(await prisma.$queryRawUnsafe(detailsSql));
      }
      console.log(`${fractionalCount} notas con decimales reales pendientes de revisión. Se conservarán sin cambios.`);
    }
    if (process.argv.includes('--report')) {
      const rows = await prisma.$queryRawUnsafe(Object.entries(fields).flatMap(([table, columns]) => columns.map((column) =>
        `SELECT s.name AS school, sy.name AS school_year, c.name AS course, st."listNumber" AS list_number,
         st."firstName" AS first_name, st."lastName" AS last_name, sub.name AS subject,
         '${table}' AS source, '${column}' AS field, g."${column}"::text AS value,
         ${table === 'academic_grades' ? 'g."blockNumber"::text' : 'ra.code'} AS block_or_ra,
         g.id AS grade_id, g."studentId" AS student_id
         FROM "${table}" g JOIN students st ON st.id = g."studentId" AND st."schoolId" = g."schoolId"
         JOIN schools s ON s.id = g."schoolId" JOIN school_years sy ON sy.id = g."schoolYearId"
         JOIN courses c ON c.id = g."courseId" JOIN subjects sub ON sub.id = g."subjectId"
         ${table === 'technical_grades' ? 'JOIN technical_learning_outcomes ra ON ra.id = g."learningOutcomeId"' : ''}
         WHERE g."${column}" <> TRUNC(g."${column}"::numeric)`,
      )).join(' UNION ALL '));
      const headers = ['school', 'school_year', 'course', 'list_number', 'first_name', 'last_name', 'subject', 'source', 'field', 'value', 'block_or_ra', 'grade_id', 'student_id'];
      const labels = ['Escuela', 'Año escolar', 'Curso', 'Número de lista', 'Nombres', 'Apellidos', 'Asignatura o módulo', 'Tipo de registro', 'Campo', 'Nota actual', 'Bloque o RA', 'ID de calificación', 'ID de estudiante'];
      const escape = (value) => {
        const text = String(value ?? '');
        return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
      };
      const file = path.resolve(__dirname, '../../artifacts/notas-decimales-para-revision.csv');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '\uFEFF' + [labels, ...rows.map((row) => headers.map((key) => row[key]))].map((row) => row.map(escape).join(';')).join('\r\n'), 'utf8');
      console.log(`Informe generado con ${rows.length} notas: ${file}`);
    }
    if (process.argv[2] !== 'deploy') {
      if (!fractionalCount) console.log('Todas las notas ingresadas son enteros o valores nulos.');
      return;
    }
    const history = await prisma.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"');
    if (history.some((row) => !row.finished_at && !row.rolled_back_at)) throw new Error('Hay una migración fallida. No se aplicará ningún cambio.');
    const completed = new Set(history.filter((row) => row.finished_at).map((row) => row.migration_name));
    const pending = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !completed.has(entry.name)).map((entry) => entry.name);
    const migrationName = '20261104130000_integer_grade_constraints';
    if (pending.some((name) => name !== migrationName)) throw new Error(`Hay otras migraciones pendientes: ${pending.join(', ')}. No se aplicará ningún cambio.`);
    await verifyConstraints(fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migrationName, 'migration.sql'), 'utf8'));
    if (pending.length) {
      const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
        cwd: path.resolve(__dirname, '..'), env: { ...process.env, DATABASE_URL: connection.toString() },
        stdio: 'inherit', timeout: 90000,
      });
      if (result.error || result.status !== 0) throw new Error('La migración no se completó. Revisar su estado antes de continuar.');
    }
    const constraints = await prisma.$queryRawUnsafe(`SELECT conname, convalidated FROM pg_constraint
      WHERE conname IN ('academic_grades_integer_scores','technical_grades_integer_scores')
      AND conrelid IN ('public.academic_grades'::regclass, 'public.technical_grades'::regclass)`);
    if (constraints.length !== 2) throw new Error('No se verificaron las dos restricciones de enteros.');
    console.log('Verificadas las restricciones de enteros para nuevas escrituras. No se actualizaron notas históricas.');
  } finally { await prisma.$disconnect(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
