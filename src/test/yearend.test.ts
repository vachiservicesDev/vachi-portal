import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createPayRun } from '@/app/api/payroll/runs/route';
import { PATCH as updateRun } from '@/app/api/payroll/runs/[id]/route';
import { POST as addStub } from '@/app/api/payroll/runs/[id]/stubs/route';
import { PUT as saveMyW4 } from '@/app/api/me/w4/route';
import { GET as myW2s, POST as consentW2 } from '@/app/api/me/w2/route';
import { GET as myW2Pdf } from '@/app/api/me/w2/[year]/pdf/route';
import { GET as w2Summary } from '@/app/api/payroll/w2/route';
import { GET as adminW2Pdf } from '@/app/api/payroll/w2/[employeeId]/[year]/pdf/route';
import { GET as report } from '@/app/api/payroll/reports/route';
import { buildRegister, buildW2, figuresOf, periodRange, type PaidStub } from '@/lib/payroll/totals';
import { buildStub, stubInputSchema } from '@/lib/payroll/stub';
import { renderW2Pdf } from '@/lib/payroll/yearEndPdf';
import { resetDb, seedEmployee, seedProfile } from './db';
import { getRequest, jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

const stub = (o: Record<string, unknown>) => buildStub(stubInputSchema.parse({ employeeId: crypto.randomUUID(), ...o })).detail;
const paid = (employeeId: string, payDate: string, o: Record<string, unknown>): PaidStub => ({
  stubId: crypto.randomUUID(),
  payDate,
  employeeId,
  firstName: 'Pat',
  lastName: employeeId,
  workState: 'CA',
  figures: figuresOf(stub(o), 'CA'),
});

describe('W-2 boxes', () => {
  it('takes 401(k) out of box 1 only and health insurance out of boxes 1, 3 and 5', () => {
    const f = figuresOf(
      stub({
        salary: 5000,
        federalTax: 500,
        socialSecurity: 297.6,
        medicare: 69.6,
        stateTax: 200,
        stateCode: 'CA',
        retirement: 300,
        healthInsurance: 200,
      }),
      null,
    );
    const w2 = buildW2(2026, [f, f]);
    expect(w2).toMatchObject({
      box1: 9000,
      box2: 1000,
      box3: 9600,
      box4: 595.2,
      box5: 9600,
      box6: 139.2,
      box12: [{ code: 'D', amount: 600 }],
    });
    expect(w2.states).toEqual([{ code: 'CA', wages: 9000, tax: 400 }]);
  });

  it('keeps 401(k) in Pennsylvania wages and caps box 3 at the wage base', () => {
    const f = figuresOf(
      stub({
        salary: 100_000,
        stateTax: 3070,
        stateCode: 'PA',
        retirement: 5000,
      }),
      null,
    );
    const w2 = buildW2(2026, [f, f]);
    expect(w2.box1).toBe(190_000);
    expect(w2.box3).toBe(184_500);
    expect(w2.box5).toBe(200_000);
    expect(w2.states).toEqual([{ code: 'PA', wages: 200_000, tax: 6140 }]);
  });
});

describe('W-2 edge cases', () => {
  it('keeps the pay-time state when nothing was withheld, so a later move does not shift wages', () => {
    const f = figuresOf(stub({ salary: 4000, stateCode: 'TX' }), 'CA');
    expect(f.stateCode).toBe('TX');
  });

  it('reports local wages only for stubs with local tax, and puts a third state on a second W-2', async () => {
    const f = (state: string, local = 0) => figuresOf(stub({ salary: 1000, stateTax: 10, stateCode: state, localTax: local }), null);
    const w2 = buildW2(2026, [f('CA', 5), f('NY'), f('PA')]);
    expect(w2).toMatchObject({ localWages: 1000, local: 5 });
    const { PDFDocument } = await import('pdf-lib');
    const bytes = await renderW2Pdf(w2, { name: 'Pat Lee', address: null, ssn: 'XXX-XX-1234', controlNumber: 'X' }, { name: 'Co', address: '', ein: '', phone: '' });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});

describe('payroll register', () => {
  it('works out periods', () => {
    expect(periodRange({ kind: 'quarter', year: 2026, index: 1 })).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
      label: 'Q1 2026',
    });
    expect(periodRange({ kind: 'month', year: 2028, index: 2 })).toMatchObject({
      from: '2028-02-01',
      to: '2028-02-29',
      label: 'February 2028',
    });
    expect(periodRange({ kind: 'year', year: 2026, index: 1 })).toMatchObject({
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });

  it('gives Form 941 figures and applies the FUTA and Social Security wage bases year to date', () => {
    const q = { kind: 'quarter' as const, year: 2026, index: 2 };
    // Employee A already earned $180,000 in Q1, so only $4,500 more is Social Security wages and none is FUTA.
    const earlier = [paid('a', '2026-03-31', { salary: 180_000 })];
    const stubs = [
      paid('a', '2026-04-30', {
        salary: 10_000,
        federalTax: 2000,
        socialSecurity: 279,
        medicare: 145,
      }),
      paid('b', '2026-05-15', {
        salary: 4000,
        federalTax: 300,
        socialSecurity: 248,
        medicare: 58,
        stateTax: 150,
        stateCode: 'CA',
        healthInsurance: 100,
      }),
      paid('b', '2026-05-29', {
        salary: 4000,
        federalTax: 300,
        socialSecurity: 248,
        medicare: 58,
        stateTax: 150,
        stateCode: 'CA',
        healthInsurance: 100,
      }),
    ];
    const r = buildRegister(q, stubs, earlier);
    expect(r.totals).toMatchObject({
      stubs: 3,
      gross: 18_000,
      health: 200,
      socialSecurityWages: 4500 + 7800,
      medicareWages: 17_800,
      futaWages: 7000,
      federal: 2600,
      state: 300,
    });
    expect(r.employer.form941).toMatchObject({
      line2: 17_800,
      line3: 2600,
      line5aTax: 1525.2,
      line5cTax: 516.2,
      line5d: 0,
      line6: 4641.4,
    });
    expect(r.employer.futa).toBe(42);
    expect(r.months.map((m) => m.month)).toEqual(['2026-04', '2026-05']);
    expect(r.months.reduce((s, m) => s + m.liability, 0)).toBeCloseTo(4641.4, 2);
    // A's stub has no state line, so it counts under their work state.
    expect(r.states).toEqual([{ code: 'CA', wages: 17_800, tax: 300 }]);
    expect(r.employees.map((e) => e.name)).toEqual(['a, Pat', 'b, Pat']);
  });
});

describe('year-end end to end', () => {
  let adminId: string;
  beforeEach(async () => {
    await resetDb();
    adminId = (await seedProfile({ role: 'admin' })).id;
    setCurrentUser(adminId);
  });

  it('lets the employee consent and download their W-2, and admins pull reports', async () => {
    const { employee, profile } = await seedEmployee();
    const { run } = await (
      await createPayRun(
        jsonRequest({
          payPeriodStart: '2025-12-01',
          payPeriodEnd: '2025-12-15',
          payDate: '2025-12-19',
        }),
      )
    ).json();
    await addStub(
      jsonRequest({
        employeeId: employee.id,
        salary: 3000,
        federalTax: 250,
        socialSecurity: 186,
        medicare: 43.5,
        stateTax: 90,
        stateCode: 'CA',
        retirement: 150,
      }),
      { params: { id: run.id } },
    );
    // A draft run never counts.
    const { run: draft } = await (
      await createPayRun(
        jsonRequest({
          payPeriodStart: '2025-12-16',
          payPeriodEnd: '2025-12-31',
          payDate: '2025-12-31',
        }),
      )
    ).json();
    await addStub(jsonRequest({ employeeId: employee.id, salary: 9999 }), {
      params: { id: draft.id },
    });
    await updateRun(jsonRequest({ status: 'processed' }), {
      params: { id: run.id },
    });

    setCurrentUser(profile!.id);
    await saveMyW4(
      new NextRequest('http://localhost/test', {
        method: 'PUT',
        body: JSON.stringify({
          federal: { filingStatus: 'single' },
          ssnLast4: '6789',
          signedName: 'Pat Lee',
          perjury: true,
        }),
      }),
    );
    const list = await (await myW2s()).json();
    expect(list.consentAt).toBeNull();
    expect(list.w2s).toHaveLength(1);
    expect(list.w2s[0]).toMatchObject({
      year: 2025,
      box1: 2850,
      box2: 250,
      box3: 3000,
      box12: [{ code: 'D', amount: 150 }],
    });
    expect((await myW2Pdf(getRequest(), { params: { year: '2025' } })).status).toBe(403);
    await consentW2(jsonRequest({ consent: true }));
    const pdf = await myW2Pdf(getRequest(), { params: { year: '2025' } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('Content-Type')).toBe('application/pdf');
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    // The consent survives a later W-4.
    await saveMyW4(
      new NextRequest('http://localhost/test', {
        method: 'PUT',
        body: JSON.stringify({
          federal: { filingStatus: 'married_jointly' },
          ssnLast4: '6789',
          signedName: 'Pat Lee',
          perjury: true,
        }),
      }),
    );
    expect((await (await myW2s()).json()).consentAt).not.toBeNull();
    // Employees can't reach the admin reports.
    expect((await w2Summary(getRequest('http://localhost/api/payroll/w2?year=2025'))).status).toBe(403);
    expect((await report(getRequest('http://localhost/api/payroll/reports?kind=year&year=2025'))).status).toBe(403);

    setCurrentUser(adminId);
    const summary = await (await w2Summary(getRequest('http://localhost/api/payroll/w2?year=2025'))).json();
    expect(summary.final).toBe(true);
    expect(summary.w3).toMatchObject({
      forms: 1,
      box1: 2850,
      box2: 250,
      box12D: 150,
      box17: 90,
    });
    expect(summary.rows[0]).toMatchObject({ electronic: true });
    expect(
      (
        await adminW2Pdf(getRequest(), {
          params: { employeeId: employee.id, year: '2025' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await adminW2Pdf(getRequest(), {
          params: { employeeId: employee.id, year: '2024' },
        })
      ).status,
    ).toBe(404);

    const json = await (await report(getRequest('http://localhost/api/payroll/reports?kind=quarter&year=2025&index=4'))).json();
    expect(json.register.totals).toMatchObject({
      stubs: 1,
      gross: 3000,
      net: 2280.5,
    });
    const csv = await report(getRequest('http://localhost/api/payroll/reports?kind=month&year=2025&index=12&format=csv'));
    expect(csv.headers.get('Content-Type')).toContain('text/csv');
    const text = await csv.text();
    expect(text).toContain('TOTAL');
    expect(text).toContain('Line 3 Federal income tax withheld,250.00');
    const regPdf = await report(getRequest('http://localhost/api/payroll/reports?kind=year&year=2025&format=pdf'));
    expect(
      Buffer.from(await regPdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    expect((await report(getRequest('http://localhost/api/payroll/reports?kind=quarter&year=2025&index=5'))).status).toBe(400);
  });
});
