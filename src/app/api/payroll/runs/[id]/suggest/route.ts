import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, payRuns, payStubs, timesheetEntries, timesheets } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { detailOf } from '@/lib/payroll/stub';
import { taxSetupOf } from '@/lib/payroll/setup';
import { STATE_RULES } from '@/lib/payroll/states/rules';
import { PAY_FREQUENCIES, frequencyFromPeriod, type PayFrequency } from '@/lib/payroll/w4';
import { and, desc, eq, gte, lte, ne } from 'drizzle-orm';

/**
 * Everything needed to fill one employee's stub in this run: their pay setup and W-4, hours from
 * approved timesheets in the pay period, and wages already paid this year (for the Social
 * Security wage base and year-to-date). The form computes the taxes from these, live.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const employeeId = request.nextUrl.searchParams.get('employeeId') ?? '';
  if (!z.string().uuid().safeParse(params.id).success || !z.string().uuid().safeParse(employeeId).success) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  const [run] = await db.select().from(payRuns).where(eq(payRuns.id, params.id)).limit(1);
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!run || !employee) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const entries = await db
    .select({ hours: timesheetEntries.hours, isOvertime: timesheetEntries.isOvertime })
    .from(timesheetEntries)
    .innerJoin(timesheets, eq(timesheets.id, timesheetEntries.timesheetId))
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        eq(timesheets.status, 'approved'),
        gte(timesheetEntries.date, run.payPeriodStart),
        lte(timesheetEntries.date, run.payPeriodEnd),
      ),
    );
  const round = (n: number) => Math.round(n * 100) / 100;
  const regularHours = round(entries.filter((e) => !e.isOvertime).reduce((s, e) => s + Number(e.hours), 0));
  const overtimeHours = round(entries.filter((e) => e.isOvertime).reduce((s, e) => s + Number(e.hours), 0));

  const earlier = await db
    .select({ deductions: payStubs.deductions, grossPay: payStubs.grossPay, netPay: payStubs.netPay, payDate: payRuns.payDate })
    .from(payStubs)
    .innerJoin(payRuns, eq(payRuns.id, payStubs.payRunId))
    .where(and(eq(payStubs.employeeId, employeeId), ne(payStubs.payRunId, run.id), eq(payRuns.status, 'processed'), lte(payRuns.payDate, run.payDate)))
    .orderBy(desc(payRuns.payDate));
  const last = earlier[0] ? detailOf(earlier[0].deductions, Number(earlier[0].grossPay), Number(earlier[0].netPay)) : null;

  const year = run.payDate.slice(0, 4);
  const ficaWagesYtd = round(
    earlier
      .filter((s) => s.payDate.startsWith(year))
      .map((s) => detailOf(s.deductions, Number(s.grossPay), Number(s.netPay)))
      .reduce((sum, d) => sum + d.earnings.reduce((a, e) => a + e.amount, 0) - d.deductions.filter((x) => x.label === 'Health insurance').reduce((a, x) => a + x.amount, 0), 0),
  );

  const frequency = (employee.payFrequency as PayFrequency | null) ?? frequencyFromPeriod(run.payPeriodStart, run.payPeriodEnd);
  const payRate = employee.payRate ? Number(employee.payRate) : (last?.earnings.find((e) => e.label === 'Regular')?.rate ?? null);
  const salaryPerPeriod = employee.payType === 'salary' && employee.annualSalary ? round(Number(employee.annualSalary) / PAY_FREQUENCIES[frequency]) : null;

  return NextResponse.json({
    payType: employee.payType ?? (salaryPerPeriod ? 'salary' : 'hourly'),
    payRate,
    salaryPerPeriod,
    frequency,
    workState: employee.workState,
    setup: taxSetupOf(employee.w4),
    regularHours,
    overtimeHours,
    ficaWagesYtd,
    lastDeductions: { retirement: last?.deductions.find((d) => d.label === '401(k)')?.amount ?? null, healthInsurance: last?.deductions.find((d) => d.label === 'Health insurance')?.amount ?? null },
    depositLast4: last?.depositLast4 ?? null,
    paymentMethod: last?.paymentMethod ?? 'direct_deposit',
    missing: [
      !employee.payType && 'pay type and rate',
      !taxSetupOf(employee.w4).federal && 'federal W-4',
      !employee.workState && 'work state',
      employee.workState && STATE_RULES[employee.workState] && !taxSetupOf(employee.w4).state && `${STATE_RULES[employee.workState].form} state withholding form`,
      !employee.address && 'mailing address',
    ].filter(Boolean),
  });
}
