import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { employees, profiles } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { createEmployeeSchema, findEmployeeByEmail } from '@/lib/employees';

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
      position: employees.position,
      department: employees.department,
      status: employees.status,
      visaType: employees.visaType,
      visaExpiryDate: employees.visaExpiryDate,
      userId: employees.userId,
      role: profiles.role,
      profileActive: profiles.isActive,
    })
    .from(employees)
    .leftJoin(profiles, eq(profiles.id, employees.userId))
    .orderBy(desc(employees.createdAt));

  return NextResponse.json({ employees: rows });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createEmployeeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  }

  if (await findEmployeeByEmail(body.data.email)) {
    return NextResponse.json(
      { message: 'An employee with this email already exists.', errors: { fieldErrors: { email: ['An employee with this email already exists.'] } } },
      { status: 409 },
    );
  }

  const [employee] = await db
    .insert(employees)
    .values({ ...body.data, status: body.data.status ?? 'active' })
    .returning();

  await logAudit({ userId: gate.user.id, action: 'employee_created', resourceType: 'employee', resourceId: employee.id, newValues: body.data });

  return NextResponse.json({ employee }, { status: 201 });
}
