import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { payRuns } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { desc } from 'drizzle-orm';

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const createSchema = z
  .object({
    payPeriodStart: day('Enter the first day of the pay period.'),
    payPeriodEnd: day('Enter the last day of the pay period.'),
    payDate: day('Enter the pay date.'),
  })
  .refine((v) => v.payPeriodEnd >= v.payPeriodStart, { message: 'The period must end on or after it starts.', path: ['payPeriodEnd'] });

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const runs = await db.select().from(payRuns).orderBy(desc(payRuns.payDate));
  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [run] = await db
    .insert(payRuns)
    .values({ ...body.data, provider: 'manual', createdBy: gate.user.id })
    .returning();

  return NextResponse.json({ run }, { status: 201 });
}
