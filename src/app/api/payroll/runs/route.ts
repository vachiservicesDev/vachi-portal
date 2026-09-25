import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { payRuns } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { desc } from 'drizzle-orm';

const createSchema = z.object({
  payPeriodStart: z.string(),
  payPeriodEnd: z.string(),
  payDate: z.string(),
});

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
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const [run] = await db
    .insert(payRuns)
    .values({ ...body.data, provider: 'manual', createdBy: gate.user.id })
    .returning();

  return NextResponse.json({ run }, { status: 201 });
}
