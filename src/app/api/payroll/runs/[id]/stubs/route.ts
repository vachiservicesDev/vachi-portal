import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { payStubs } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const createSchema = z.object({
  employeeId: z.string().uuid(),
  grossPay: z.coerce.number().nonnegative(),
  netPay: z.coerce.number().nonnegative(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
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
