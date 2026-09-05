// Build first, then run node --test test/imports-routes.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { Workbook } = require('exceljs');
const { ImportsController } = require('../dist/src/imports/imports.controller');
const { ImportsService } = require('../dist/src/imports/imports.service');

test('HTTP template route returns an Excel file instead of looking up an import job', async () => {
  const workbook = new Workbook();
  workbook.addWorksheet('Datos').addRow(['numero_lista', 'modulo', 'RA12', 'RA12_R1', 'RA12_R2', 'RA12_ESP']);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const generated = [];
  const lookedUp = [];
  const module = await Test.createTestingModule({
    controllers: [ImportsController],
    providers: [{ provide: ImportsService, useValue: {
      generateTemplate: async (dto, user) => { generated.push({ dto, user }); return buffer; },
      findOne: async (id) => { lookedUp.push(id); return { id }; },
    } }],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Authentication is supplied only inside this isolated test application.
  app.use((request, response, next) => { request.user = { id: 'test-user', role: 'ADMIN' }; next(); });
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const query = new URLSearchParams({
      type: 'technical',
      schoolYearId: '11111111-1111-4111-8111-111111111111',
      courseId: '22222222-2222-4222-8222-222222222222',
      subjectId: '33333333-3333-4333-8333-333333333333',
    });
    const response = await fetch(`${origin}/api/imports/template?${query}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /spreadsheetml.sheet/);
    assert.match(response.headers.get('content-disposition'), /plantilla-technical.xlsx/);
    const downloaded = new Workbook();
    await downloaded.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.equal(downloaded.worksheets[0].getCell('C1').value, 'RA12');
    assert.equal(generated.length, 1);
    assert.equal(generated[0].dto.subjectId, query.get('subjectId'));
    assert.equal(generated[0].user.id, 'test-user');
    assert.deepEqual(lookedUp, []);

    const invalid = await fetch(`${origin}/api/imports/template?type=technical`);
    assert.equal(invalid.status, 400);
    assert.deepEqual(lookedUp, []);
    const detail = await fetch(`${origin}/api/imports/existing-job`);
    assert.deepEqual(await detail.json(), { id: 'existing-job' });
    assert.deepEqual(lookedUp, ['existing-job']);
  } finally { await app.close(); }
});
