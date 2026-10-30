import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { employees, payRuns, payStubs } from '@/db/schema';
import { ownsEmployee } from '@/lib/employees';
import { buildStatement, detailOf } from './stub';
import { getCompany } from './company';

/**
 * One pay stub as a full statement, for HR or for the employee it belongs to. Employees only see
 * stubs in processed pay runs; anyone else gets the same "not found" as a missing id.
 */
export async function loadStatement(id: string, profile: { id: string; email: string; role: string }) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db
    .select({ stub: payStubs, run: payRuns, employee: employees })
    .from(payStubs)
    .innerJoin(payRuns, eq(payRuns.id, payStubs.payRunId))
    .innerJoin(employees, eq(employees.id, payStubs.employeeId))
    .where(eq(payStubs.id, id))
    .limit(1);
  if (!row) return null;
  if (profile.role !== 'admin' && (!ownsEmployee(row.employee, profile) || row.run.status !== 'processed')) return null;

  const year = row.run.payDate.slice(0, 4);
  const earlier = await db
    .select({ deductions: payStubs.deductions, grossPay: payStubs.grossPay, netPay: payStubs.netPay })
    .from(payStubs)
    .innerJoin(payRuns, eq(payRuns.id, payStubs.payRunId))
    .where(
      and(
        eq(payStubs.employeeId, row.employee.id),
        ne(payStubs.id, row.stub.id),
        eq(payRuns.status, 'processed'),
        gte(payRuns.payDate, `${year}-01-01`),
        lte(payRuns.payDate, row.run.payDate),
      ),
    );

  const current = detailOf(row.stub.deductions, Number(row.stub.grossPay), Number(row.stub.netPay));
  const history = earlier.map((s) => detailOf(s.deductions, Number(s.grossPay), Number(s.netPay)));
  return { stub: row.stub, run: row.run, employee: row.employee, company: await getCompany(), statement: buildStatement(current, history) };
}

export type LoadedStatement = NonNullable<Awaited<ReturnType<typeof loadStatement>>>;
