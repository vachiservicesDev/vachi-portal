import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { inviteEmployee, setStartingPassword } from '@/lib/auth/provision';
import { logAudit } from '@/lib/audit/log';
import { findEmployee } from '@/lib/employees';

const inviteSchema = z.object({
  mode: z.enum(['email', 'link', 'password']).default('email'),
  // Only for mode "password". Left out, the server generates one.
  password: z.string().min(10, 'Use at least 10 characters.').max(72, 'Keep it under 72 characters.').optional(),
});

/**
 * Gives an employee a portal login: emails an invite, returns a one-time link for HR to share, or
 * sets a starting password HR hands over (they're asked to change it on first sign-in).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const employee = await findEmployee(params.id);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const body = inviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  if (body.data.mode === 'password') {
    const result = await setStartingPassword(employee, body.data.password);
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
    // The password itself is never written to the audit log.
    await logAudit({
      userId: gate.user.id,
      action: 'portal_password_set',
      resourceType: 'employee',
      resourceId: employee.id,
      newValues: { email: employee.email },
    });
    return NextResponse.json({ outcome: result.outcome, password: result.password });
  }

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
