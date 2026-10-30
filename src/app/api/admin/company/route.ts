import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { companySettings } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { getCompany } from '@/lib/payroll/company';

const companySchema = z.object({
  legalName: z.string().trim().min(1, 'Enter the company’s legal name.').max(200),
  address: z.string().trim().max(500).optional().default(''),
  ein: z
    .string()
    .trim()
    .regex(/^(\d{2}-?\d{7})?$/, 'Use the 9-digit EIN, like 12-3456789.')
    .optional()
    .default(''),
  phone: z.string().trim().max(30).optional().default(''),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  return NextResponse.json({ company: await getCompany() });
}

/** The employer details printed on every pay stub. */
export async function PUT(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const body = companySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });
  const d = body.data;
  const ein = d.ein ? `${d.ein.replace('-', '').slice(0, 2)}-${d.ein.replace('-', '').slice(2)}` : null;
  const values = { legalName: d.legalName, address: d.address || null, ein, phone: d.phone || null, updatedAt: new Date() };
  await db.insert(companySettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: companySettings.id, set: values });
  await logAudit({ userId: gate.user.id, action: 'company_settings_updated', resourceType: 'company_settings', newValues: values });
  return NextResponse.json({ company: await getCompany() });
}
