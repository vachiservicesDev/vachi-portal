import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { employees, profiles } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { findEmployee, findEmployeeByEmail, updateEmployeeSchema } from '@/lib/employees';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const employee = await findEmployee(params.id);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const [profile] = employee.userId
    ? await db.select().from(profiles).where(eq(profiles.id, employee.userId)).limit(1)
    : [];

  return NextResponse.json({
    employee,
    access: profile
      ? { status: profile.isActive ? 'active' : 'disabled', role: profile.role, email: profile.email }
      : { status: 'none', role: null, email: null },
    isSelf: employee.userId === gate.user.id,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const employee = await findEmployee(params.id);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const body = updateEmployeeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  }
  const { role, ...fields } = body.data;

  if (fields.email && fields.email !== employee.email.toLowerCase()) {
    if (employee.userId) {
      return NextResponse.json(
        {
          message: "This employee already has a portal login, so their email can't be changed here.",
          errors: { fieldErrors: { email: ["Change the login email in Supabase first; it's tied to their account."] } },
        },
        { status: 409 },
      );
    }
    if (await findEmployeeByEmail(fields.email)) {
      return NextResponse.json(
        { message: 'Another employee already uses this email.', errors: { fieldErrors: { email: ['Another employee already uses this email.'] } } },
        { status: 409 },
      );
    }
  }

  const isSelf = employee.userId === gate.user.id;
  if (isSelf && (role === 'employee' || fields.status === 'inactive')) {
    return NextResponse.json({ message: "You can't remove your own admin access or deactivate yourself." }, { status: 409 });
  }

  const [updated] = await db
    .update(employees)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(employees.id, employee.id))
    .returning();

  // Keep portal access in step with the record: inactive employees can't sign in.
  if (employee.userId) {
    const profileChanges: Partial<typeof profiles.$inferInsert> = {};
    if (fields.status) profileChanges.isActive = fields.status !== 'inactive';
    if (role) profileChanges.role = role;
    if (Object.keys(profileChanges).length) {
      await db
        .update(profiles)
        .set({ ...profileChanges, updatedAt: new Date() })
        .where(eq(profiles.id, employee.userId));
    }
  }

  await logAudit({
    userId: gate.user.id,
    action: 'employee_updated',
    resourceType: 'employee',
    resourceId: employee.id,
    oldValues: Object.fromEntries(Object.keys(fields).map((k) => [k, employee[k as keyof typeof employee]])),
    newValues: role ? { ...fields, role } : fields,
  });

  return NextResponse.json({ employee: updated });
}
