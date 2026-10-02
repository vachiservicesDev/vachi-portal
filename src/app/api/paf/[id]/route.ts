import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, h1bPublicAccessFiles } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { logAudit } from '@/lib/audit/log';
import { updatePafSchema } from '@/lib/paf/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const [row] = await db
    .select({ file: h1bPublicAccessFiles, employeeFirstName: employees.firstName, employeeLastName: employees.lastName })
    .from(h1bPublicAccessFiles)
    .innerJoin(employees, eq(employees.id, h1bPublicAccessFiles.employeeId))
    .where(eq(h1bPublicAccessFiles.id, params.id))
    .limit(1);
  if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({ file: { ...row.file, employeeFirstName: row.employeeFirstName, employeeLastName: row.employeeLastName } });
}

/** Replaces the editable fields. Optional fields left out are cleared. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const body = updatePafSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const d = body.data;
  const [updated] = await db
    .update(h1bPublicAccessFiles)
    .set({
      lcaCaseNumber: d.lcaCaseNumber,
      lcaFilingDate: d.lcaFilingDate,
      worksite: d.worksite,
      wageLevel: d.wageLevel ?? null,
      prevailingWage: d.prevailingWage !== undefined ? String(d.prevailingWage) : null,
      actualWage: d.actualWage !== undefined ? String(d.actualWage) : null,
      postingStartDate: d.postingStartDate ?? null,
      postingEndDate: d.postingEndDate ?? null,
      updatedAt: new Date(),
    })
    .where(eq(h1bPublicAccessFiles.id, params.id))
    .returning();
  if (!updated) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  await logAudit({ userId: gate.user.id, action: 'paf.updated', resourceType: 'h1b_public_access_file', resourceId: updated.id, newValues: { lcaCaseNumber: updated.lcaCaseNumber } });

  return NextResponse.json({ file: updated });
}
