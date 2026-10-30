import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { taxSetupOf } from '@/lib/payroll/setup';
import { buildW2, paidStubs } from '@/lib/payroll/totals';
import { validYear } from '@/lib/payroll/w2';

/**
 * Every employee's W-2 for a year, with W-3 style totals, and what is missing before filing:
 * the SSN's last four digits, a mailing address, and the employee's consent to an electronic copy.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const year = validYear(request.nextUrl.searchParams.get('year') ?? String(new Date().getUTCFullYear()));
  if (!year) return NextResponse.json({ message: 'Choose a year from 2020 on.' }, { status: 400 });

  const stubs = await paidStubs(`${year}-01-01`, `${year}-12-31`);
  const ids = [...new Set(stubs.map((s) => s.employeeId))];
  const people = ids.length ? await db.select().from(employees).where(inArray(employees.id, ids)) : [];
  const rows = people
    .map((e) => {
      const setup = taxSetupOf(e.w4);
      const w2 = buildW2(
        year,
        stubs.filter((s) => s.employeeId === e.id).map((s) => s.figures),
      );
      const missing = [!setup.ssnLast4 && 'SSN', !e.address && 'mailing address'].filter(Boolean) as string[];
      return {
        employeeId: e.id,
        name: `${e.lastName}, ${e.firstName}`,
        w2,
        missing,
        electronic: Boolean(setup.w2ConsentAt),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (pick: (r: (typeof rows)[number]) => number) => Math.round(rows.reduce((s, r) => s + pick(r), 0) * 100) / 100;
  const w3 = {
    forms: rows.length,
    box1: sum((r) => r.w2.box1),
    box2: sum((r) => r.w2.box2),
    box3: sum((r) => r.w2.box3),
    box4: sum((r) => r.w2.box4),
    box5: sum((r) => r.w2.box5),
    box6: sum((r) => r.w2.box6),
    box12D: sum((r) => r.w2.box12.find((b) => b.code === 'D')?.amount ?? 0),
    box16: sum((r) => r.w2.states.reduce((s, x) => s + x.wages, 0)),
    box17: sum((r) => r.w2.states.reduce((s, x) => s + x.tax, 0)),
  };
  return NextResponse.json({
    year,
    final: year < new Date().getUTCFullYear(),
    rows,
    w3,
  });
}
