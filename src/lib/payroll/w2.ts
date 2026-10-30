import { NextResponse } from 'next/server';
import { getCompany } from './company';
import { taxSetupOf } from './setup';
import { buildW2, paidStubs, ssnMasked, type W2 } from './totals';
import { renderW2Pdf } from './yearEndPdf';
import type { employees } from '@/db/schema';

type Employee = typeof employees.$inferSelect;

/** Tax years from 2020 to this one, for picking a W-2 or a report. */
export function validYear(raw: string | null | undefined): number | null {
  const y = Number(raw);
  return Number.isInteger(y) && y >= 2020 && y <= new Date().getUTCFullYear() ? y : null;
}

/** Every year the employee was paid, newest first, each with its W-2 figures. */
export async function w2sFor(employee: Employee): Promise<W2[]> {
  const stubs = await paidStubs('2020-01-01', `${new Date().getUTCFullYear()}-12-31`, employee.id);
  const years = [...new Set(stubs.map((s) => Number(s.payDate.slice(0, 4))))].sort((a, b) => b - a);
  return years.map((y) =>
    buildW2(
      y,
      stubs.filter((s) => s.payDate.startsWith(String(y))).map((s) => s.figures),
    ),
  );
}

export async function w2For(employee: Employee, year: number): Promise<W2> {
  const stubs = await paidStubs(`${year}-01-01`, `${year}-12-31`, employee.id);
  return buildW2(
    year,
    stubs.map((s) => s.figures),
  );
}

/** The W-2 copies B, C and 2 as a PDF download. */
export async function w2PdfResponse(employee: Employee, year: number) {
  const w2 = await w2For(employee, year);
  if (!w2.stubs) return NextResponse.json({ message: `No processed pay stubs in ${year}.` }, { status: 404 });
  const bytes = await renderW2Pdf(
    w2,
    {
      name: `${employee.firstName} ${employee.lastName}`,
      address: employee.address,
      ssn: ssnMasked(taxSetupOf(employee.w4)),
      controlNumber: employee.id.slice(0, 8).toUpperCase(),
    },
    await getCompany(),
  );
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="W-2-${year}-${employee.lastName.replace(/[^A-Za-z0-9-]/g, '')}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
