import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, i9Records } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const section1Schema = z.object({
  legalFirstName: z.string().min(1),
  legalLastName: z.string().min(1),
  otherLastNames: z.string().optional(),
  address: z.string().min(1),
  dateOfBirth: z.string().min(1),
  ssn: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  citizenshipStatus: z.enum([
    'us_citizen',
    'noncitizen_national',
    'lawful_permanent_resident',
    'alien_authorized_to_work',
  ]),
  alienRegistrationNumber: z.string().optional(),
  workAuthorizationExpiration: z.string().optional(),
  i94AdmissionNumber: z.string().optional(),
  foreignPassportNumber: z.string().optional(),
  foreignPassportCountry: z.string().optional(),
  signedByName: z.string().min(1), // typed-name attestation; see docs/PLAN.md re: upgrading to the certified e-sign vendor
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [record] = await db.select().from(i9Records).where(eq(i9Records.id, params.id)).limit(1);
  if (!record) return NextResponse.json({ message: 'Record not found' }, { status: 404 });

  if (gate.profile.role !== 'admin') {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, record.employeeId))
      .limit(1);
    if (!employee || employee.email !== gate.profile.email) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
  }

  const body = section1Schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const { signedByName, ...section1Data } = body.data;

  const [updated] = await db
    .update(i9Records)
    .set({
      section1Data,
      section1SignedByName: signedByName,
      section1CompletedAt: new Date(),
      status: 'section2_pending',
      updatedAt: new Date(),
    })
    .where(eq(i9Records.id, params.id))
    .returning();

  return NextResponse.json({ record: updated });
}
