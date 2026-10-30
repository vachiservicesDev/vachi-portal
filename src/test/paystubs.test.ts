import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { employees, notifications } from '@/db/schema';
import { POST as createTimesheet } from '@/app/api/timesheets/route';
import { POST as addEntry } from '@/app/api/timesheets/[id]/entries/route';
import { POST as submitTimesheet } from '@/app/api/timesheets/[id]/submit/route';
import { PATCH as reviewTimesheet } from '@/app/api/timesheets/[id]/review/route';
import { POST as createPayRun } from '@/app/api/payroll/runs/route';
import { PATCH as updateRun } from '@/app/api/payroll/runs/[id]/route';
import { POST as addStub } from '@/app/api/payroll/runs/[id]/stubs/route';
import { DELETE as removeStub } from '@/app/api/payroll/runs/[id]/stubs/[stubId]/route';
import { GET as suggest } from '@/app/api/payroll/runs/[id]/suggest/route';
import { GET as myStubs } from '@/app/api/payroll/stubs/me/route';
import { GET as getStatement } from '@/app/api/payroll/stubs/[id]/route';
import { GET as getPdf } from '@/app/api/payroll/stubs/[id]/pdf/route';
import { PUT as savePay } from '@/app/api/employees/[id]/pay/route';
import { GET as getMyW4, PUT as saveMyW4 } from '@/app/api/me/w4/route';
import { GET as getCompany, PUT as saveCompany } from '@/app/api/admin/company/route';
import { buildStatement, buildStub, stubInputSchema } from '@/lib/payroll/stub';
import { computeTaxes } from '@/lib/payroll/taxes';
import { federalWithholding, stateWithholding, w4Schema } from '@/lib/payroll/w4';
import { resetDb, seedEmployee, seedProfile } from './db';
import { getRequest, jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

const put = (body: unknown) => new NextRequest('http://localhost/test', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const w4 = (o: Partial<ReturnType<typeof w4Schema.parse>> = {}) => w4Schema.parse({ filingStatus: 'single', ...o });

describe('federal withholding (IRS Pub 15-T 2026, percentage method)', () => {
  it('matches hand-worked 2026 figures', () => {
    // $2,000 biweekly, single: (52,000 − 16,100) → 1,240 + 23,500 × 12% = 4,060 a year.
    expect(federalWithholding(2000, 'biweekly', w4())).toBe(156.15);
    // $3,000 biweekly, married jointly: (78,000 − 32,200) → 2,480 + 21,000 × 12% = 5,000.
    expect(federalWithholding(3000, 'biweekly', w4({ filingStatus: 'married_jointly' }))).toBe(192.31);
    // Step 2 checked halves the standard deduction and brackets: 620 + 2,280 + 18,750 × 22% = 7,025.
    expect(federalWithholding(2000, 'biweekly', w4({ multipleJobs: true }))).toBe(270.19);
    // Step 3 credits come off the annual tax; Step 4(c) is added per period.
    expect(federalWithholding(2000, 'biweekly', w4({ dependentsAmount: 2000 }))).toBe(79.23);
    expect(federalWithholding(2000, 'biweekly', w4({ extraWithholding: 25 }))).toBe(181.15);
    // Head of household, monthly $5,000: (60,000 − 24,150) → 1,770 + 18,150 × 12% = 3,948.
    expect(federalWithholding(5000, 'monthly', w4({ filingStatus: 'head_of_household' }))).toBe(329);
  });

  it('withholds nothing when exempt or below the standard deduction', () => {
    expect(federalWithholding(2000, 'biweekly', w4({ exempt: true }))).toBe(0);
    expect(federalWithholding(500, 'biweekly', w4())).toBe(0);
  });

  it('no-tax states withhold nothing; taxing states use their formula, even before the state form is in', () => {
    const input = { wages: 2000, frequency: 'biweekly' as const, federalTax: 0 };
    expect(stateWithholding('TX', {}, input)).toBe(0);
    expect(stateWithholding('CA', {}, input)).toBeGreaterThan(0);
    expect(stateWithholding('XX', {}, input)).toBeNull();
    expect(stateWithholding(null, {}, input)).toBeNull();
  });

  it('stops Social Security at the wage base and keeps pre-tax deductions out of income tax', () => {
    const t = computeTaxes({ gross: 10_000, retirement: 1000, healthInsurance: 200, frequency: 'biweekly', setup: { federal: w4() }, workState: 'TX', ficaWagesYtd: 180_000 });
    // FICA wages exclude health insurance (section 125) but not 401(k): 9,800, only 4,500 under the base.
    expect(t.socialSecurity).toBe(279);
    expect(t.medicare).toBe(142.1);
    expect(t.federalTax).toBe(federalWithholding(8800, 'biweekly', w4()));
    expect(t.stateTax).toBe(0);
  });
});

describe('pay stub totals', () => {
  it('adds up lines server-side and carries year-to-date', () => {
    const first = buildStub(stubInputSchema.parse({ employeeId: crypto.randomUUID(), regularHours: 80, regularRate: 25, federalTax: 150, socialSecurity: 124, medicare: 29, retirement: 100 }));
    expect(first.grossPay).toBe(2000);
    expect(first.netPay).toBe(1597);
    const second = buildStub(stubInputSchema.parse({ employeeId: crypto.randomUUID(), regularHours: 80, regularRate: 25, overtimeHours: 4, overtimeRate: 37.5, federalTax: 170, socialSecurity: 133.3, medicare: 31.18 }));
    const s = buildStatement(second.detail, [first.detail]);
    expect(s.totals.gross).toEqual([2150, 4150]);
    expect(s.earnings.find((e) => e.label === 'Overtime')).toMatchObject({ hours: 4, rate: 37.5, current: 150, ytd: 150 });
    // A deduction from earlier in the year still shows, at 0 this period.
    expect(s.deductions).toEqual([{ label: '401(k)', current: 0, ytd: 100 }]);
    expect(s.totals.net[1]).toBe(first.netPay + second.netPay);
  });

  it('rejects stubs that take out more than they pay', () => {
    const r = buildStub(stubInputSchema.parse({ employeeId: crypto.randomUUID(), salary: 100, federalTax: 200 }));
    expect(r.error?.field).toBe('federalTax');
  });
});

describe('pay stubs end to end', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    adminId = (await seedProfile({ role: 'admin' })).id;
    setCurrentUser(adminId);
  });

  async function approvedWeek(profileId: string, regular: number, overtime: number) {
    setCurrentUser(profileId);
    const { timesheet } = await (await createTimesheet(jsonRequest({ weekStarting: '2026-03-02', weekEnding: '2026-03-08' }))).json();
    for (let day = 0; day < regular / 8; day++) {
      await addEntry(jsonRequest({ date: `2026-03-0${2 + day}`, hours: 8, isOvertime: false }), { params: { id: timesheet.id } });
    }
    if (overtime) await addEntry(jsonRequest({ date: '2026-03-07', hours: overtime, isOvertime: true }), { params: { id: timesheet.id } });
    await submitTimesheet(getRequest(), { params: { id: timesheet.id } });
    setCurrentUser(adminId);
    await reviewTimesheet(jsonRequest({ decision: 'approved' }), { params: { id: timesheet.id } });
  }

  it('fills from pay setup and timesheets, hides drafts, and serves the statement and PDF', async () => {
    const { employee, profile } = await seedEmployee();
    await db.update(employees).set({ address: '12 Main St\nAustin, TX 78701' }).where(eq(employees.id, employee.id));
    const setup = await savePay(put({ payType: 'hourly', payRate: 25, payFrequency: 'biweekly', workState: 'tx', federal: { filingStatus: 'married_jointly' } }), { params: { id: employee.id } });
    expect(setup.status).toBe(200);
    expect((await saveCompany(put({ legalName: 'Vachi Services LLC', address: '1 Corp Way\nDallas, TX 75201', ein: '123456789', phone: '555-0100' }))).status).toBe(200);
    expect((await (await getCompany()).json()).company.ein).toBe('12-3456789');

    await approvedWeek(profile!.id, 40, 5);
    const { run } = await (await createPayRun(jsonRequest({ payPeriodStart: '2026-03-02', payPeriodEnd: '2026-03-15', payDate: '2026-03-20' }))).json();

    const hint = await (await suggest(getRequest(`http://localhost/test?employeeId=${employee.id}`), { params: { id: run.id } })).json();
    expect(hint).toMatchObject({ payType: 'hourly', payRate: 25, frequency: 'biweekly', workState: 'TX', regularHours: 40, overtimeHours: 5, missing: [] });

    const gross = 40 * 25 + 5 * 37.5;
    const taxes = computeTaxes({ gross, retirement: 0, healthInsurance: 0, frequency: 'biweekly', setup: hint.setup, workState: 'TX', ficaWagesYtd: 0 });
    const added = await addStub(
      jsonRequest({ employeeId: employee.id, regularHours: 40, regularRate: 25, overtimeHours: 5, overtimeRate: 37.5, federalTax: taxes.federalTax, socialSecurity: taxes.socialSecurity, medicare: taxes.medicare, depositLast4: '4321' }),
      { params: { id: run.id } },
    );
    expect(added.status).toBe(201);
    const { stub } = await added.json();
    expect(Number(stub.grossPay)).toBe(1187.5);
    expect(stub.deductions).toMatchObject({ filingStatus: 'married_jointly', depositLast4: '4321' });

    // Not visible to the employee until the run is processed.
    setCurrentUser(profile!.id);
    expect((await (await myStubs()).json()).stubs).toHaveLength(0);
    expect((await getStatement(getRequest(), { params: { id: stub.id } })).status).toBe(404);

    setCurrentUser(adminId);
    await updateRun(jsonRequest({ status: 'processed' }), { params: { id: run.id } });

    setCurrentUser(profile!.id);
    expect((await (await myStubs()).json()).stubs).toHaveLength(1);
    const { statement } = await (await getStatement(getRequest(), { params: { id: stub.id } })).json();
    expect(statement.totals.gross).toEqual([1187.5, 1187.5]);
    const pdf = await getPdf(getRequest(), { params: { id: stub.id } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toMatch(/attachment; filename="pay-stub-2026-03-20-employee\.pdf"/i);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');

    // Another employee can't open it.
    const other = await seedEmployee();
    setCurrentUser(other.profile!.id);
    expect((await getPdf(getRequest(), { params: { id: stub.id } })).status).toBe(404);
  });

  it('salary splits across pay periods and only draft stubs can be removed', async () => {
    const { employee } = await seedEmployee();
    await savePay(put({ payType: 'salary', annualSalary: 78000, payFrequency: 'semimonthly', workState: 'CA' }), { params: { id: employee.id } });
    const { run } = await (await createPayRun(jsonRequest({ payPeriodStart: '2026-03-01', payPeriodEnd: '2026-03-15', payDate: '2026-03-15' }))).json();
    const hint = await (await suggest(getRequest(`http://localhost/test?employeeId=${employee.id}`), { params: { id: run.id } })).json();
    expect(hint.salaryPerPeriod).toBe(3250);
    expect(hint.missing).toEqual(expect.arrayContaining(['federal W-4', 'DE 4 state withholding form']));

    // The DE 4 answers save with the pay setup and come back for the stub form.
    const saved = await savePay(
      put({ payType: 'salary', annualSalary: 78000, payFrequency: 'semimonthly', workState: 'CA', federal: { filingStatus: 'single' }, state: { mode: 'formula', status: 'married', allowances: '2', exempt: false } }),
      { params: { id: employee.id } },
    );
    expect(saved.status).toBe(200);
    const again = await (await suggest(getRequest(`http://localhost/test?employeeId=${employee.id}`), { params: { id: run.id } })).json();
    expect(again.setup.state).toMatchObject({ mode: 'formula', status: 'married', allowances: 2 });
    expect(again.missing).toEqual(['mailing address']);

    const { stub } = await (await addStub(jsonRequest({ employeeId: employee.id, salary: 3250 }), { params: { id: run.id } })).json();
    await updateRun(jsonRequest({ status: 'processed' }), { params: { id: run.id } });
    expect((await removeStub(getRequest(), { params: { id: run.id, stubId: stub.id } })).status).toBe(409);
    await updateRun(jsonRequest({ status: 'draft' }), { params: { id: run.id } });
    expect((await removeStub(getRequest(), { params: { id: run.id, stubId: stub.id } })).status).toBe(200);
  });

  it('employees fill in their own W-4, HR is told, and only HR sets pay', async () => {
    const { employee, profile } = await seedEmployee();
    setCurrentUser(profile!.id);
    expect((await savePay(put({ payType: 'hourly', payRate: 99, payFrequency: 'weekly', workState: 'TX' }), { params: { id: employee.id } })).status).toBe(403);

    // Unsigned forms are refused: the W-4 needs the perjury statement and a typed name.
    expect((await saveMyW4(put({ federal: { filingStatus: 'head_of_household' }, ssnLast4: '1234', signedName: 'Pat Lee' }))).status).toBe(400);
    const res = await saveMyW4(put({ federal: { filingStatus: 'head_of_household', dependentsAmount: 2000 }, ssnLast4: '1234', signedName: 'Pat Lee', perjury: true }));
    expect(res.status).toBe(200);
    const mine = await (await getMyW4()).json();
    expect(mine.w4.federal).toMatchObject({ filingStatus: 'head_of_household', dependentsAmount: 2000, submittedBy: 'employee', signedName: 'Pat Lee' });
    expect(mine.w4.ssnLast4).toBe('1234');
    const sent = await db.select().from(notifications).where(eq(notifications.userId, adminId));
    expect(sent.map((n) => n.type)).toContain('w4_submitted');
  });
});
