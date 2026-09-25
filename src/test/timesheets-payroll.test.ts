import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { auditLogs, notifications } from '@/db/schema';
import { POST as createTimesheet, GET as listTimesheets } from '@/app/api/timesheets/route';
import { POST as addEntry } from '@/app/api/timesheets/[id]/entries/route';
import { POST as submitTimesheet } from '@/app/api/timesheets/[id]/submit/route';
import { PATCH as reviewTimesheet } from '@/app/api/timesheets/[id]/review/route';
import { POST as createPayRun } from '@/app/api/payroll/runs/route';
import { POST as addStub } from '@/app/api/payroll/runs/[id]/stubs/route';
import { GET as myStubs } from '@/app/api/payroll/stubs/me/route';
import { eq } from 'drizzle-orm';
import { resetDb, seedEmployee, seedProfile } from './db';
import { getRequest, jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

describe('Timesheets & Payroll (Phase 5)', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await seedProfile({ role: 'admin' });
    adminId = admin.id;
    setCurrentUser(adminId);
  });

  it('submit computes total/overtime hours from entries server-side (not trusting a client total)', async () => {
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);

    const createRes = await createTimesheet(
      jsonRequest({ weekStarting: '2026-01-05', weekEnding: '2026-01-11' }),
    );
    const { timesheet } = await createRes.json();

    await addEntry(jsonRequest({ date: '2026-01-05', hours: 8, isOvertime: false }), {
      params: { id: timesheet.id },
    });
    await addEntry(jsonRequest({ date: '2026-01-06', hours: 10, isOvertime: true }), {
      params: { id: timesheet.id },
    });

    const submitRes = await submitTimesheet(getRequest(), { params: { id: timesheet.id } });
    expect(submitRes.status).toBe(200);
    const { timesheet: submitted } = await submitRes.json();
    expect(Number(submitted.totalHours)).toBe(18);
    expect(Number(submitted.overtimeHours)).toBe(10);
    expect(submitted.status).toBe('submitted');
  });

  it('refuses to submit an empty timesheet', async () => {
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);
    const createRes = await createTimesheet(jsonRequest({ weekStarting: '2026-01-05', weekEnding: '2026-01-11' }));
    const { timesheet } = await createRes.json();

    const res = await submitTimesheet(getRequest(), { params: { id: timesheet.id } });
    expect(res.status).toBe(400);
  });

  it('cannot add entries to a timesheet once submitted', async () => {
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);
    const createRes = await createTimesheet(jsonRequest({ weekStarting: '2026-01-05', weekEnding: '2026-01-11' }));
    const { timesheet } = await createRes.json();
    await addEntry(jsonRequest({ date: '2026-01-05', hours: 8 }), { params: { id: timesheet.id } });
    await submitTimesheet(getRequest(), { params: { id: timesheet.id } });

    const res = await addEntry(jsonRequest({ date: '2026-01-06', hours: 4 }), { params: { id: timesheet.id } });
    expect(res.status).toBe(400);
  });

  it('admin rejection notifies the employee, logs an audit entry, and sets the reason', async () => {
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);
    const createRes = await createTimesheet(jsonRequest({ weekStarting: '2026-01-05', weekEnding: '2026-01-11' }));
    const { timesheet } = await createRes.json();
    await addEntry(jsonRequest({ date: '2026-01-05', hours: 8 }), { params: { id: timesheet.id } });
    await submitTimesheet(getRequest(), { params: { id: timesheet.id } });

    setCurrentUser(adminId);
    const res = await reviewTimesheet(
      jsonRequest({ decision: 'rejected', rejectionReason: 'Missing project code' }),
      { params: { id: timesheet.id } },
    );
    expect(res.status).toBe(200);
    const { timesheet: reviewed } = await res.json();
    expect(reviewed.status).toBe('rejected');
    expect(reviewed.rejectionReason).toBe('Missing project code');

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, timesheet.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('timesheet.rejected');

    const notifs = await db.select().from(notifications).where(eq(notifications.userId, profile!.id));
    expect(notifs.some((n) => n.type === 'timesheet_reviewed' && n.priority === 'high')).toBe(true);
  });

  it('admin sees all timesheets, employee only their own', async () => {
    const { profile: empA } = await seedEmployee();
    const { profile: empB } = await seedEmployee();

    setCurrentUser(empA!.id);
    await createTimesheet(jsonRequest({ weekStarting: '2026-01-05', weekEnding: '2026-01-11' }));
    setCurrentUser(empB!.id);
    await createTimesheet(jsonRequest({ weekStarting: '2026-01-05', weekEnding: '2026-01-11' }));

    setCurrentUser(adminId);
    const adminView = await listTimesheets();
    expect((await adminView.json()).timesheets).toHaveLength(2);

    setCurrentUser(empA!.id);
    const empView = await listTimesheets();
    expect((await empView.json()).timesheets).toHaveLength(1);
  });

  it('payroll: manual pay run + stub, employee sees only their own stub', async () => {
    const { employee, profile } = await seedEmployee();
    const { profile: otherProfile } = await seedEmployee();

    const runRes = await createPayRun(
      jsonRequest({ payPeriodStart: '2026-01-01', payPeriodEnd: '2026-01-15', payDate: '2026-01-20' }),
    );
    const { run } = await runRes.json();
    expect(run.provider).toBe('manual');

    await addStub(jsonRequest({ employeeId: employee.id, grossPay: 5000, netPay: 3800 }), {
      params: { id: run.id },
    });

    setCurrentUser(profile!.id);
    const mine = await myStubs();
    const { stubs } = await mine.json();
    expect(stubs).toHaveLength(1);
    expect(stubs[0].netPay).toBe('3800.00');

    setCurrentUser(otherProfile!.id);
    const theirs = await myStubs();
    expect((await theirs.json()).stubs).toHaveLength(0);
  });
});
