import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { getCompany } from '@/lib/payroll/company';
import { loadRegister, registerCsv } from '@/lib/payroll/totals';
import { renderRegisterPdf } from '@/lib/payroll/yearEndPdf';

const querySchema = z
  .object({
    kind: z.enum(['month', 'quarter', 'year']),
    year: z.coerce.number().int().min(2020).max(2100),
    index: z.coerce.number().int().min(1).max(12).default(1),
    format: z.enum(['json', 'csv', 'pdf']).default('json'),
  })
  .refine((q) => q.kind !== 'quarter' || q.index <= 4, {
    path: ['index'],
    message: 'A quarter is 1 to 4.',
  });

/**
 * The payroll register for a month, quarter or year (by pay date), as JSON for the page, or as a
 * CSV or PDF for an auditor. Includes the employer taxes and the Form 941 figures.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  const q = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ message: 'Invalid input', errors: q.error.flatten() }, { status: 400 });
  const { kind, year, index, format } = q.data;

  const register = await loadRegister({
    kind,
    year,
    index: kind === 'year' ? 1 : index,
  });
  if (format === 'json') return NextResponse.json({ register });

  await logAudit({
    userId: gate.user.id,
    action: 'payroll_report_exported',
    resourceType: 'payroll',
    newValues: { period: register.period.label, format },
  });
  const filename = `payroll-register-${register.period.label.replace(/\s+/g, '-')}.${format}`;
  const headers = {
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  };
  if (format === 'csv')
    return new NextResponse(registerCsv(register), {
      headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
    });
  const bytes = await renderRegisterPdf(register, await getCompany());
  return new NextResponse(Buffer.from(bytes), {
    headers: { ...headers, 'Content-Type': 'application/pdf' },
  });
}
