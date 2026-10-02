import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { employees, notifications, profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { POST as createEmployee, GET as listEmployees } from '@/app/api/employees/route';
import { POST as inviteEmployee } from '@/app/api/employees/[id]/invite/route';
import { POST as createTimesheet } from '@/app/api/timesheets/route';
import { POST as addEntry } from '@/app/api/timesheets/[id]/entries/route';
import { POST as submitTimesheet } from '@/app/api/timesheets/[id]/submit/route';
import { PATCH as reviewTimesheet } from '@/app/api/timesheets/[id]/review/route';
import { POST as createPayRun } from '@/app/api/payroll/runs/route';
import { POST as addStub } from '@/app/api/payroll/runs/[id]/stubs/route';
import { POST as createGreenCard } from '@/app/api/green-card/route';
import { PATCH as updateGreenCard } from '@/app/api/green-card/[id]/route';
import { GET as myGreenCard } from '@/app/api/green-card/me/route';
import { POST as createStemOpt } from '@/app/api/stem-opt/route';
import { POST as createPaf } from '@/app/api/paf/route';
import { PATCH as updatePaf } from '@/app/api/paf/[id]/route';
import { POST as createSummary } from '@/app/api/training/summaries/route';
import { PATCH as patchSummary } from '@/app/api/training/summaries/[id]/route';
import { GET as threads } from '@/app/api/messages/threads/route';
import { POST as sendMessage } from '@/app/api/messages/[userId]/route';
import { POST as readAll } from '@/app/api/notifications/read-all/route';
import { addMonths } from '@/lib/dates';
import { businessDays } from '@/lib/paf/schema';
import { resetDb, seedEmployee, seedProfile } from './db';
import { getRequest, jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

// Supabase Auth admin API, used by the invite route. Each test sets what it returns.
const authAdmin = {
  inviteUserByEmail: vi.fn(),
  generateLink: vi.fn(),
};
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: authAdmin, resetPasswordForEmail: vi.fn(async () => ({ error: null })) } }),
}));

const day = (iso: string) => iso;

describe('Portal rules added in the design-system pass', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    const admin = await seedProfile({ role: 'admin' });
    adminId = admin.id;
    setCurrentUser(adminId);
  });

  describe('employees and invites', () => {
    it('rejects a duplicate email regardless of case, and lists the new employee', async () => {
      const ok = await createEmployee(jsonRequest({ firstName: 'Asha', lastName: 'Rao', email: 'Asha@Example.com', startDate: '2026-01-05' }));
      expect(ok.status).toBe(201);
      const dup = await createEmployee(jsonRequest({ firstName: 'A', lastName: 'R', email: 'asha@example.COM', startDate: '2026-01-05' }));
      expect(dup.status).toBe(409);
      const { employees: rows } = await (await listEmployees()).json();
      expect(rows).toHaveLength(1);
    });

    it('a shareable invite link creates the login, a profile and links the employee', async () => {
      const { employee } = await seedEmployee({ linkToProfile: false, email: 'new.hire@example.com' });
      const newUserId = '7a0f6f5e-0c51-4bb1-9f0e-2a4d8b7f7c11';
      authAdmin.generateLink.mockResolvedValueOnce({ data: { user: { id: newUserId }, properties: { action_link: 'https://auth.test/verify?token=abc' } }, error: null });

      const res = await inviteEmployee(jsonRequest({ mode: 'link' }), { params: { id: employee.id } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.outcome).toBe('link');
      expect(body.link).toContain('token=abc');
      expect(authAdmin.generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'invite', email: 'new.hire@example.com' }));

      const [linked] = await db.select().from(employees).where(eq(employees.id, employee.id));
      expect(linked.userId).toBe(newUserId);
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, newUserId));
      expect(profile.role).toBe('employee');
    });

    it('never downgrades an existing admin login when linking it to an employee', async () => {
      const existingAdmin = await seedProfile({ role: 'admin', email: 'boss@example.com' });
      const { employee } = await seedEmployee({ linkToProfile: false, email: 'boss@example.com' });
      authAdmin.inviteUserByEmail.mockResolvedValueOnce({ data: { user: null }, error: { message: 'A user with this email address has already been registered' } });
      authAdmin.generateLink.mockResolvedValueOnce({ data: { user: { id: existingAdmin.id }, properties: { action_link: 'x' } }, error: null });

      const res = await inviteEmployee(jsonRequest({ mode: 'email' }), { params: { id: employee.id } });
      expect(res.status).toBe(200);
      expect((await res.json()).outcome).toBe('existing-account');
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, existingAdmin.id));
      expect(profile.role).toBe('admin');
    });

    it('refuses to invite an inactive employee and is admin-only', async () => {
      const { employee, profile } = await seedEmployee({ linkToProfile: false });
      await db.update(employees).set({ status: 'inactive' }).where(eq(employees.id, employee.id));
      const res = await inviteEmployee(jsonRequest({ mode: 'link' }), { params: { id: employee.id } });
      expect(res.status).toBe(409);
      expect(authAdmin.generateLink).not.toHaveBeenCalled();

      const { profile: someone } = await seedEmployee();
      setCurrentUser(someone!.id);
      const blocked = await inviteEmployee(jsonRequest({ mode: 'link' }), { params: { id: employee.id } });
      expect(blocked.status).toBe(403);
      void profile;
    });
  });

  describe('timesheets', () => {
    it('only submitted timesheets can be reviewed; a returned one can be fixed and resubmitted', async () => {
      const { profile } = await seedEmployee();
      setCurrentUser(profile!.id);
      const { timesheet } = await (await createTimesheet(jsonRequest({ weekStarting: '2026-02-02', weekEnding: '2026-02-08' }))).json();

      setCurrentUser(adminId);
      const tooEarly = await reviewTimesheet(jsonRequest({ decision: 'approved' }), { params: { id: timesheet.id } });
      expect(tooEarly.status).toBe(409);

      setCurrentUser(profile!.id);
      await addEntry(jsonRequest({ date: '2026-02-02', hours: 8 }), { params: { id: timesheet.id } });
      const outside = await addEntry(jsonRequest({ date: '2026-03-01', hours: 8 }), { params: { id: timesheet.id } });
      expect(outside.status).toBe(400);
      await submitTimesheet(getRequest(), { params: { id: timesheet.id } });

      setCurrentUser(adminId);
      const returned = await reviewTimesheet(jsonRequest({ decision: 'rejected', rejectionReason: 'Missing Tuesday' }), { params: { id: timesheet.id } });
      expect(returned.status).toBe(200);

      setCurrentUser(profile!.id);
      const fix = await addEntry(jsonRequest({ date: '2026-02-03', hours: 8 }), { params: { id: timesheet.id } });
      expect(fix.status).toBe(201);
      const resubmit = await submitTimesheet(getRequest(), { params: { id: timesheet.id } });
      expect(resubmit.status).toBe(200);
      expect(Number((await resubmit.json()).timesheet.totalHours)).toBe(16);
    });

    it('one timesheet per employee per week', async () => {
      const { profile } = await seedEmployee();
      setCurrentUser(profile!.id);
      await createTimesheet(jsonRequest({ weekStarting: '2026-02-02', weekEnding: '2026-02-08' }));
      const again = await createTimesheet(jsonRequest({ weekStarting: '2026-02-02', weekEnding: '2026-02-08' }));
      expect(again.status).toBe(409);
    });
  });

  describe('payroll', () => {
    it('validates dates and amounts and blocks a second stub for the same employee', async () => {
      const badRun = await createPayRun(jsonRequest({ payPeriodStart: '2026-02-15', payPeriodEnd: '2026-02-01', payDate: '2026-02-20' }));
      expect(badRun.status).toBe(400);
      expect((await badRun.json()).errors.fieldErrors.payPeriodEnd).toBeDefined();

      const { run } = await (await createPayRun(jsonRequest({ payPeriodStart: '2026-02-01', payPeriodEnd: '2026-02-15', payDate: '2026-02-20' }))).json();
      const { employee } = await seedEmployee();

      const netTooHigh = await addStub(jsonRequest({ employeeId: employee.id, grossPay: '1000', netPay: '1200' }), { params: { id: run.id } });
      expect(netTooHigh.status).toBe(400);

      const ok = await addStub(jsonRequest({ employeeId: employee.id, grossPay: '4000', netPay: '3100.50' }), { params: { id: run.id } });
      expect(ok.status).toBe(201);
      const dup = await addStub(jsonRequest({ employeeId: employee.id, grossPay: '4000', netPay: '3100' }), { params: { id: run.id } });
      expect(dup.status).toBe(409);

      const missingRun = await addStub(jsonRequest({ employeeId: employee.id, grossPay: '1', netPay: '1' }), { params: { id: '00000000-0000-4000-8000-000000000000' } });
      expect(missingRun.status).toBe(404);
    });
  });

  describe('immigration', () => {
    it('green card: one case per employee, notes stay with HR, priority date can be set and cleared', async () => {
      const { employee, profile } = await seedEmployee();
      const { case: gc } = await (await createGreenCard(jsonRequest({ employeeId: employee.id }))).json();
      const dup = await createGreenCard(jsonRequest({ employeeId: employee.id }));
      expect(dup.status).toBe(409);

      const set = await updateGreenCard(jsonRequest({ stage: 'perm_filed', priorityDate: '2026-03-01', notes: 'Attorney: J. Doe' }), { params: { id: gc.id } });
      expect((await set.json()).case.priorityDate).toBe('2026-03-01');

      setCurrentUser(profile!.id);
      const mine = (await (await myGreenCard()).json()).case;
      expect(mine.stage).toBe('perm_filed');
      expect(mine).not.toHaveProperty('notes');

      setCurrentUser(adminId);
      const cleared = await updateGreenCard(jsonRequest({ stage: 'perm_filed', priorityDate: '' }), { params: { id: gc.id } });
      expect((await cleared.json()).case.priorityDate).toBeNull();
    });

    it('STEM OPT: end must be after start and within 24 months; one plan per employee', async () => {
      const { employee } = await seedEmployee({ visaType: 'STEM_OPT' });
      const base = { employeeId: employee.id, employerName: 'Vachi Services LLC', trainingStartDate: '2026-01-31' };
      expect((await createStemOpt(jsonRequest({ ...base, trainingEndDate: '2026-01-01' }))).status).toBe(400);
      expect((await createStemOpt(jsonRequest({ ...base, trainingEndDate: '2028-03-01' }))).status).toBe(400);

      const ok = await createStemOpt(jsonRequest({ ...base, trainingEndDate: '2028-01-31' }));
      expect(ok.status).toBe(201);
      expect((await ok.json()).plan.selfEvaluationDueAt).toBe('2027-01-31');
      expect((await createStemOpt(jsonRequest({ ...base, trainingEndDate: '2027-06-30' }))).status).toBe(409);
    });

    it('PAF: actual wage must meet the prevailing wage, on create and on edit', async () => {
      const { employee } = await seedEmployee();
      const base = { employeeId: employee.id, lcaCaseNumber: 'I-200-26001-000001', lcaFilingDate: '2026-02-02', worksite: '1 Main St, Austin TX' };
      const low = await createPaf(jsonRequest({ ...base, prevailingWage: '120000', actualWage: '110000' }));
      expect(low.status).toBe(400);
      expect((await low.json()).errors.fieldErrors.actualWage).toBeDefined();

      const { file } = await (await createPaf(jsonRequest({ ...base, prevailingWage: '120000', actualWage: '125000', wageLevel: 'II' }))).json();
      const { employeeId: _ignored, ...editable } = base;
      const edit = await updatePaf(jsonRequest({ ...editable, prevailingWage: '130000', actualWage: '125000' }), { params: { id: file.id } });
      expect(edit.status).toBe(400);
    });

    it('date helpers: month math clamps to month end, business days skip weekends', () => {
      expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
      expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
      expect(businessDays(day('2026-02-02'), day('2026-02-13'))).toBe(10);
      expect(businessDays(day('2026-02-07'), day('2026-02-08'))).toBe(0);
    });
  });

  describe('weekly summaries', () => {
    it('employee edits a returned summary and resubmits; HR must say why when returning', async () => {
      const { profile } = await seedEmployee();
      setCurrentUser(profile!.id);
      const { summary } = await (await createSummary(jsonRequest({ weekStarting: '2026-02-02', weekEnding: '2026-02-06', content: 'First pass', submit: true }))).json();
      const dupWeek = await createSummary(jsonRequest({ weekStarting: '2026-02-02', weekEnding: '2026-02-06', content: 'Again' }));
      expect(dupWeek.status).toBe(409);
      const lockedForEmployee = await patchSummary(jsonRequest({ content: 'sneaky edit' }), { params: { id: summary.id } });
      expect(lockedForEmployee.status).toBe(409);

      setCurrentUser(adminId);
      const noReason = await patchSummary(jsonRequest({ status: 'rejected' }), { params: { id: summary.id } });
      expect(noReason.status).toBe(400);
      const returned = await patchSummary(jsonRequest({ status: 'rejected', reviewComments: 'Add what you learned' }), { params: { id: summary.id } });
      expect(returned.status).toBe(200);
      const notifs = await db.select().from(notifications).where(eq(notifications.userId, profile!.id));
      expect(notifs.map((n) => n.type)).toContain('summary_returned');

      setCurrentUser(profile!.id);
      const resubmitted = await patchSummary(jsonRequest({ content: 'Second pass with learnings', submit: true }), { params: { id: summary.id } });
      expect((await resubmitted.json()).summary.status).toBe('submitted');
    });
  });

  describe('messages and notifications', () => {
    it('employees can only message HR; nobody can message an unknown id', async () => {
      const { profile: a } = await seedEmployee();
      const { profile: b } = await seedEmployee();
      setCurrentUser(a!.id);

      const list = (await (await threads()).json()).partners;
      expect(list.map((p: { id: string }) => p.id)).toEqual([adminId]);

      expect((await sendMessage(jsonRequest({ body: 'hi' }), { params: { userId: b!.id } })).status).toBe(404);
      expect((await sendMessage(jsonRequest({ body: 'hi' }), { params: { userId: 'not-a-uuid' } })).status).toBe(404);
      expect((await sendMessage(jsonRequest({ body: '   ' }), { params: { userId: adminId } })).status).toBe(400);
      expect((await sendMessage(jsonRequest({ body: 'Question about PTO' }), { params: { userId: adminId } })).status).toBe(201);

      setCurrentUser(adminId);
      const mine = (await (await threads()).json()).partners;
      const withA = mine.find((p: { id: string }) => p.id === a!.id);
      expect(withA.unread).toBe(1);
      expect(withA.firstName).toBe('Test');
      expect(mine[0].id).toBe(a!.id); // the conversation with a message sorts first
    });

    it('mark all as read only touches the caller’s notifications', async () => {
      const { profile } = await seedEmployee();
      await db.insert(notifications).values([
        { userId: adminId, type: 't', title: 'A', message: 'a' },
        { userId: adminId, type: 't', title: 'B', message: 'b' },
        { userId: profile!.id, type: 't', title: 'C', message: 'c' },
      ]);
      const res = await readAll();
      expect((await res.json()).updated).toBe(2);
      const [theirs] = await db.select().from(notifications).where(eq(notifications.userId, profile!.id));
      expect(theirs.status).toBe('unread');
    });
  });
});
