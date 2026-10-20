// Run with: node --import tsx --test test/technical-learning-outcomes.spec.ts
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, SubjectType, UserRole, type TechnicalLearningOutcome } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuditService } from '../src/audit/audit.service';
import { PermissionsService } from '../src/common/services/permissions.service';
import type { AuthenticatedUser } from '../src/common/types/authenticated-user.type';
import type { PrismaService } from '../src/prisma/prisma.service';
import {
  CreateLearningOutcomesBatchDto,
  UpdateLearningOutcomeWeightsDto,
} from '../src/technical-learning-outcomes/dto/save-learning-outcomes.dto';
import { TechnicalLearningOutcomesService } from '../src/technical-learning-outcomes/technical-learning-outcomes.service';

const schoolId = randomUUID();
const subjectId = randomUUID();
const admin: AuthenticatedUser = {
  id: randomUUID(),
  schoolId,
  teacherId: null,
  email: 'prueba@example.test',
  fullName: 'Prueba local',
  role: UserRole.ADMIN,
  isActive: true,
};

function outcome(order: number, weight: number, isActive = true): TechnicalLearningOutcome {
  return {
    id: randomUUID(),
    schoolId,
    subjectId,
    code: `RA${order}`,
    name: `RA${order}`,
    order,
    weight: new Prisma.Decimal(weight),
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: admin.id,
    updatedBy: admin.id,
  };
}

function harness(initial: TechnicalLearningOutcome[] = [], failAudit = false) {
  let records = [...initial];
  let transactions = 0;
  let auditCount = 0;
  const subject = { id: subjectId, schoolId, type: SubjectType.TECHNICAL };
  const prisma = {
    subject: { findUnique: () => subject, findFirst: () => subject },
    $transaction: async (
      action: (tx: unknown) => Promise<TechnicalLearningOutcome[]>,
      options: { isolationLevel: string },
    ) => {
      transactions += 1;
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
      let pending = [...records];
      let pendingAudits = 0;
      const result = await action({
        technicalLearningOutcome: {
          findMany: ({
            where,
          }: {
            where: { schoolId: string; subjectId: string; isActive?: boolean };
          }) => {
            assert.equal(where.schoolId, schoolId);
            assert.equal(where.subjectId, subjectId);
            return pending.filter(
              (item) => where.isActive === undefined || item.isActive === where.isActive,
            );
          },
          create: ({ data }: { data: TechnicalLearningOutcome }) => {
            const created = { ...data, id: randomUUID(), weight: new Prisma.Decimal(data.weight) };
            pending.push(created);
            return created;
          },
          update: ({
            where,
            data,
          }: {
            where: { id: string };
            data: { weight: number; updatedBy: string };
          }) => {
            const current = pending.find((item) => item.id === where.id);
            assert.ok(current);
            const updated = { ...current, ...data, weight: new Prisma.Decimal(data.weight) };
            pending = pending.map((item) => (item.id === updated.id ? updated : item));
            return updated;
          },
        },
        auditLog: {
          createMany: ({ data }: { data: unknown[] }) => {
            if (failAudit) throw new Error('Audit unavailable');
            pendingAudits += data.length;
          },
        },
      });
      records = pending;
      auditCount += pendingAudits;
      return result;
    },
  } as unknown as PrismaService;
  const permissions = new PermissionsService(prisma);
  const service = new TechnicalLearningOutcomesService(
    prisma,
    permissions,
    new AuditService(prisma, permissions),
  );
  return {
    service,
    records: () => records,
    audits: () => auditCount,
    transactions: () => transactions,
  };
}

void test('creates an initial batch with zero weights and one audit per RA', async () => {
  const h = harness();
  const items = [1, 2, 3, 4, 5].map((order) => ({
    schoolId,
    subjectId,
    code: `RA${order}`,
    name: `RA${order}`,
    order,
    weight: 0,
    isActive: true,
  }));
  await h.service.createBatch({ items }, admin);
  assert.equal(h.records().length, 5);
  assert.equal(h.audits(), 5);
  assert.equal(h.transactions(), 1);
  assert.deepEqual(
    h.records().map((item) => Number(item.weight)),
    [0, 0, 0, 0, 0],
  );
});

void test('rejects over-allocation and mixed-school batches before persisting any RA', async () => {
  const h = harness([outcome(1, 70)]);
  const item = { schoolId, subjectId, code: 'RA2', name: 'RA2', order: 2, weight: 31 };
  await assert.rejects(h.service.createBatch({ items: [item] }, admin), BadRequestException);
  assert.equal(h.records().length, 1);
  assert.equal(h.audits(), 0);
  await assert.rejects(
    h.service.createBatch({ items: [item, { ...item, schoolId: randomUUID() }] }, admin),
    BadRequestException,
  );
  assert.equal(h.transactions(), 1);
});

void test('saves a final redistribution of 70/30 without rejecting the temporary 70/50', async () => {
  const first = outcome(1, 50);
  const second = outcome(2, 50);
  const h = harness([first, second]);
  await h.service.updateWeights(
    subjectId,
    {
      items: [
        { id: first.id, weight: 70 },
        { id: second.id, weight: 30 },
      ],
    },
    admin,
  );
  assert.deepEqual(
    h.records().map((item) => Number(item.weight)),
    [70, 30],
  );
  assert.equal(h.audits(), 2);
});

void test('keeps existing data when final weights exceed 100 or an RA belongs to another module', async () => {
  const first = outcome(1, 50);
  const h = harness([first, outcome(2, 50)]);
  await assert.rejects(
    h.service.updateWeights(subjectId, { items: [{ id: first.id, weight: 60 }] }, admin),
    BadRequestException,
  );
  await assert.rejects(
    h.service.updateWeights(subjectId, { items: [{ id: randomUUID(), weight: 10 }] }, admin),
    NotFoundException,
  );
  assert.deepEqual(
    h.records().map((item) => Number(item.weight)),
    [50, 50],
  );
  assert.equal(h.audits(), 0);
});

void test('ignores inactive RA weights and adds decimal weights exactly', async () => {
  const first = outcome(1, 0);
  const second = outcome(2, 0);
  const third = outcome(3, 0);
  const inactive = outcome(4, 100, false);
  const h = harness([first, second, third, inactive]);
  await h.service.updateWeights(
    subjectId,
    {
      items: [
        { id: first.id, weight: 33.33 },
        { id: second.id, weight: 33.33 },
        { id: third.id, weight: 33.34 },
      ],
    },
    admin,
  );
  assert.deepEqual(
    h.records().map((item) => Number(item.weight)),
    [33.33, 33.33, 33.34, 100],
  );
});

void test('includes audit writes in the same transaction as configuration changes', async () => {
  const first = outcome(1, 40);
  const h = harness([first], true);
  await assert.rejects(
    h.service.updateWeights(subjectId, { items: [{ id: first.id, weight: 60 }] }, admin),
    /Audit unavailable/,
  );
  assert.equal(Number(h.records()[0].weight), 40);
});

void test('denies weight changes to another school without opening a transaction', async () => {
  const h = harness([outcome(1, 100)]);
  await assert.rejects(
    h.service.updateWeights(subjectId, { items: [] }, { ...admin, schoolId: randomUUID() }),
    ForbiddenException,
  );
  assert.equal(h.transactions(), 0);
});

void test('validates nested batches, unique RA IDs and weight precision', async () => {
  const valid = { items: [{ id: randomUUID(), weight: 33.33 }] };
  assert.equal((await validate(plainToInstance(UpdateLearningOutcomeWeightsDto, valid))).length, 0);
  for (const invalid of [
    { items: [] },
    { items: [{ ...valid.items[0], weight: -1 }] },
    { items: [{ ...valid.items[0], weight: 100.01 }] },
    { items: [{ ...valid.items[0], weight: 1.111 }] },
    { items: [valid.items[0], valid.items[0]] },
  ]) {
    assert.ok(
      (await validate(plainToInstance(UpdateLearningOutcomeWeightsDto, invalid))).length > 0,
    );
  }
  assert.ok(
    (await validate(plainToInstance(CreateLearningOutcomesBatchDto, { items: [] }))).length > 0,
  );
  assert.ok(
    (await validate(plainToInstance(CreateLearningOutcomesBatchDto, { items: [{}] }))).length > 0,
  );
});
