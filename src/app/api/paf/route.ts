import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, h1bPublicAccessFiles } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createPafSchema } from '@/lib/paf/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const files = await db
    .select({
      id: h1bPublicAccessFiles.id,
      lcaCaseNumber: h1bPublicAccessFiles.lcaCaseNumber,
      lcaFilingDate: h1bPublicAccessFiles.lcaFilingDate,
      postingStartDate: h1bPublicAccessFiles.postingStartDate,
      postingEndDate: h1bPublicAccessFiles.postingEndDate,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
    })
    .from(h1bPublicAccessFiles)
    .innerJoin(employees, eq(employees.id, h1bPublicAccessFiles.employeeId))
    .orderBy(desc(h1bPublicAccessFiles.lcaFilingDate));

  return NextResponse.json({ files });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createPafSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, body.data.employeeId)).limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const [file] = await db
    .insert(h1bPublicAccessFiles)
    .values({
      ...body.data,
      prevailingWage: body.data.prevailingWage !== undefined ? String(body.data.prevailingWage) : undefined,
      actualWage: body.data.actualWage !== undefined ? String(body.data.actualWage) : undefined,
    })
    .returning();

  return NextResponse.json({ file }, { status: 201 });
}
