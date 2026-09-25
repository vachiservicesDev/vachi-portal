import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, i9Records } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, gate.profile.email))
    .limit(1);
  if (!employee) return NextResponse.json({ record: null });

  const [record] = await db
    .select()
    .from(i9Records)
    .where(eq(i9Records.employeeId, employee.id))
    .limit(1);

  return NextResponse.json({ record: record ?? null });
}
