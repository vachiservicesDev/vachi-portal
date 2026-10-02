import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { payRuns, payStubs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const createSchema = z
  .object({
    employeeId: z.string().uuid('Choose an employee.'),
    grossPay: z.coerce.number().nonnegative('Gross pay can’t be negative.'),
    netPay: z.coerce.number().nonnegative('Net pay can’t be negative.'),
  })
  .refine((v) => v.netPay <= v.grossPay, { message: 'Net pay can’t be more than gross pay.', path: ['netPay'] });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const [run] = await db.select({ id: payRuns.id, status: payRuns.status }).from(payRuns).where(eq(payRuns.id, params.id)).limit(1);
  if (!run) return NextResponse.json({ message: 'Pay run not found' }, { status: 404 });
  if (run.status === 'processed') return NextResponse.json({ message: 'This pay run is processed. Reopen it to add stubs.' }, { status: 409 });

  const [existing] = await db
    .select({ id: payStubs.id })
    .from(payStubs)
    .where(and(eq(payStubs.payRunId, params.id), eq(payStubs.employeeId, body.data.employeeId)))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { message: 'This employee already has a stub in this pay run.', errors: { fieldErrors: { employeeId: ['Already has a stub in this pay run.'] } } },
      { status: 409 },
    );
  }

  const [stub] = await db
    .insert(payStubs)
    .values({
      payRunId: params.id,
      employeeId: body.data.employeeId,
      grossPay: String(body.data.grossPay),
      netPay: String(body.data.netPay),
    })
    .returning();

  return NextResponse.json({ stub }, { status: 201 });
}
