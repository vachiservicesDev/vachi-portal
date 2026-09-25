import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, i9Records } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [record] = await db.select().from(i9Records).where(eq(i9Records.id, params.id)).limit(1);
  if (!record) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, record.employeeId))
    .limit(1);

  return NextResponse.json({ record, employee });
}
