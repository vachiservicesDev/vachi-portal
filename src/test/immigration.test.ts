import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { GET as dashboard } from '@/app/api/immigration/dashboard/route';
import { POST as createStemOpt, GET as listStemOpt } from '@/app/api/stem-opt/route';
import { PATCH as updateStemOpt } from '@/app/api/stem-opt/[id]/route';
import { GET as myStemOpt } from '@/app/api/stem-opt/me/route';
import { POST as createPaf, GET as listPaf } from '@/app/api/paf/route';
import { POST as createGreenCard } from '@/app/api/green-card/route';
import { PATCH as updateGreenCard } from '@/app/api/green-card/[id]/route';
import { GET as myGreenCard } from '@/app/api/green-card/me/route';
import { eq } from 'drizzle-orm';
import { resetDb, seedEmployee, seedProfile } from './db';
import { jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

describe('Immigration & compliance modules (Phase 6)', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await seedProfile({ role: 'admin' });
    adminId = admin.id;
    setCurrentUser(adminId);
  });

  it('immigration dashboard buckets by urgency correctly', async () => {
    // Offsets from the real current time, not fixed dates - avoids mocking
    // Date entirely (Date.now = ... doesn't affect `new Date()` in V8, and
    // vi.useFakeTimers() risks hanging the real DB driver's own timers).
    const offset = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const expiredDate = offset(-10);
    const criticalDate = offset(15);
    const okDate = offset(200);

    await seedEmployee({ visaExpiryDate: expiredDate });
    await seedEmployee({ visaExpiryDate: criticalDate });
    await seedEmployee({ visaExpiryDate: okDate });
    await seedEmployee({ visaExpiryDate: null as unknown as string }); // excluded - no expiry set

    const res = await dashboard();
    const { employees } = await res.json();
    const nonNull = employees.filter((e: { visaExpiryDate: string | null }) => e.visaExpiryDate !== null);
    expect(nonNull).toHaveLength(3);

    const byExpiry = Object.fromEntries(
      nonNull.map((e: { visaExpiryDate: string; urgency: string }) => [e.visaExpiryDate, e.urgency]),
    );
    expect(byExpiry[expiredDate]).toBe('expired');
    expect(byExpiry[criticalDate]).toBe('critical');
    expect(byExpiry[okDate]).toBe('ok');
    // sorted soonest-first
    expect(nonNull[0].visaExpiryDate).toBe(expiredDate);
  });

  it('STEM OPT: 12-month self-evaluation due date is computed from training start date', async () => {
    const { employee, profile } = await seedEmployee();
    const res = await createStemOpt(
      jsonRequest({
        employeeId: employee.id,
        employerName: 'Vachi Services LLC',
        trainingStartDate: '2026-01-15',
        trainingEndDate: '2028-01-15',
      }),
    );
    expect(res.status).toBe(201);
    const { plan } = await res.json();
    expect(plan.selfEvaluationDueAt).toBe('2027-01-15');
    expect(plan.finalEvaluationDueAt).toBe('2028-01-15');

    setCurrentUser(adminId);
    const markRes = await updateStemOpt(jsonRequest({ selfEvaluationCompletedAt: true }), {
      params: { id: plan.id },
    });
    expect((await markRes.json()).plan.selfEvaluationCompletedAt).not.toBeNull();

    setCurrentUser(profile!.id);
    const mine = await myStemOpt();
    expect((await mine.json()).plan.employerName).toBe('Vachi Services LLC');

    setCurrentUser(adminId);
    const adminList = await listStemOpt();
    expect((await adminList.json()).plans).toHaveLength(1);
  });

  it('marking the final evaluation complete also closes out plan status', async () => {
    const { employee } = await seedEmployee();
    const createRes = await createStemOpt(
      jsonRequest({
        employeeId: employee.id,
        employerName: 'Vachi Services LLC',
        trainingStartDate: '2026-01-15',
        trainingEndDate: '2028-01-15',
      }),
    );
    const { plan } = await createRes.json();

    const res = await updateStemOpt(jsonRequest({ finalEvaluationCompletedAt: true }), {
      params: { id: plan.id },
    });
    expect((await res.json()).plan.status).toBe('completed');
  });

  it('PAF is admin/compliance-only - not exposed to any employee-facing route', async () => {
    const { employee } = await seedEmployee();
    const res = await createPaf(
      jsonRequest({
        employeeId: employee.id,
        lcaCaseNumber: 'I-200-26001-123456',
        lcaFilingDate: '2026-01-01',
        worksite: '123 Business Rd, City, ST',
      }),
    );
    expect(res.status).toBe(201);

    const list = await listPaf();
    expect((await list.json()).files).toHaveLength(1);
    // (No GET /api/paf/me exists at all - the absence is the point.)
  });

  it('green card: stage changes are audit-logged and visible to the employee', async () => {
    const { employee, profile } = await seedEmployee();
    const createRes = await createGreenCard(jsonRequest({ employeeId: employee.id }));
    const { case: gcCase } = await createRes.json();
    expect(gcCase.stage).toBe('perm_prep');

    const updateRes = await updateGreenCard(jsonRequest({ stage: 'perm_filed' }), {
      params: { id: gcCase.id },
    });
    expect((await updateRes.json()).case.stage).toBe('perm_filed');

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, gcCase.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('green_card.stage_changed');

    setCurrentUser(profile!.id);
    const mine = await myGreenCard();
    expect((await mine.json()).case.stage).toBe('perm_filed');
  });
});
