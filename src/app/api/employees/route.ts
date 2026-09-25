import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { desc } from 'drizzle-orm';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const rows = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
      startDate: employees.startDate,
    })
    .from(employees)
    .orderBy(desc(employees.createdAt));

  return NextResponse.json({ employees: rows });
}
