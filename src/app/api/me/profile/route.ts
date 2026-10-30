import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { ownEmployee } from '@/lib/employees';
import { logAudit } from '@/lib/audit/log';
import { eq } from 'drizzle-orm';

const selfSchema = z.object({
  phoneNumber: z.string().trim().max(20, 'Keep this under 20 characters.').nullable().optional(),
  address: z.string().trim().max(500, 'Keep this under 500 characters.').nullable().optional(),
});

async function own(profile: { id: string; email: string }) {
  const [employee] = await db.select().from(employees).where(ownEmployee(profile)).limit(1);
  return employee ?? null;
}

/** The signed-in employee's own contact details. Name, email and job details stay with HR. */
export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const e = await own(gate.profile);
  if (!e) return NextResponse.json({ message: 'No employee record is linked to this login yet. Ask HR.' }, { status: 404 });
  return NextResponse.json({
    employee: { firstName: e.firstName, lastName: e.lastName, email: e.email, position: e.position, department: e.department, phoneNumber: e.phoneNumber, address: e.address },
  });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const e = await own(gate.profile);
  if (!e) return NextResponse.json({ message: 'No employee record is linked to this login yet. Ask HR.' }, { status: 404 });

  const body = selfSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  const changes = {
    ...(body.data.phoneNumber !== undefined && { phoneNumber: body.data.phoneNumber || null }),
    ...(body.data.address !== undefined && { address: body.data.address || null }),
  };

  const [updated] = await db.update(employees).set({ ...changes, updatedAt: new Date() }).where(eq(employees.id, e.id)).returning();
  await logAudit({
    userId: gate.user.id,
    action: 'employee_self_updated',
    resourceType: 'employee',
    resourceId: e.id,
    oldValues: { phoneNumber: e.phoneNumber, address: e.address },
    newValues: changes,
  });
  return NextResponse.json({ employee: { phoneNumber: updated.phoneNumber, address: updated.address } });
}
