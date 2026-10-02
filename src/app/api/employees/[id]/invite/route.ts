import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { inviteEmployee } from '@/lib/auth/provision';
import { logAudit } from '@/lib/audit/log';
import { findEmployee } from '@/lib/employees';

const inviteSchema = z.object({ mode: z.enum(['email', 'link']).default('email') });

/** Gives an employee a portal login: emails an invite, or returns a one-time link for HR to share. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const employee = await findEmployee(params.id);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const body = inviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const result = await inviteEmployee(employee, body.data.mode, appUrl);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });

  await logAudit({
    userId: gate.user.id,
    action: result.outcome === 'link' ? 'portal_invite_link_created' : 'portal_invite_sent',
    resourceType: 'employee',
    resourceId: employee.id,
    newValues: { outcome: result.outcome, email: employee.email },
  });

  return NextResponse.json({ outcome: result.outcome, link: result.link ?? null });
}
