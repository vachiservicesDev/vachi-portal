import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { loadStatement } from '@/lib/payroll/load';
import { renderStubPdf } from '@/lib/payroll/pdf';

/** The stub as a downloadable PDF earnings statement. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await loadStatement(params.id, gate.profile);
  if (!found) return NextResponse.json({ message: 'Pay stub not found' }, { status: 404 });

  const bytes = await renderStubPdf(found);
  const inline = new URL(request.url).searchParams.get('view') === '1';
  const filename = `pay-stub-${found.run.payDate}-${found.employee.lastName.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
