import { ownsEmployee } from '@/lib/employees';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, i9Records } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { eq } from 'drizzle-orm';

const section1Schema = z
  .object({
    legalFirstName: z.string().trim().min(1, 'Enter your legal first name.'),
    legalLastName: z.string().trim().min(1, 'Enter your legal last name.'),
    otherLastNames: z.string().trim().optional(),
    address: z.string().trim().min(1, 'Enter your home address.'),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth.'),
    ssn: z
      .string()
      .regex(/^\d{3}-?\d{2}-?\d{4}$/, 'Enter 9 digits, like 123-45-6789.')
      .optional(),
    email: z.string().email('Enter a valid email, like name@example.com.').optional(),
    phone: z.string().trim().optional(),
    citizenshipStatus: z.enum([
      'us_citizen',
      'noncitizen_national',
      'lawful_permanent_resident',
      'alien_authorized_to_work',
    ]),
    alienRegistrationNumber: z.string().trim().optional(),
    workAuthorizationExpiration: z.string().optional(),
    i94AdmissionNumber: z.string().trim().optional(),
    foreignPassportNumber: z.string().trim().optional(),
    foreignPassportCountry: z.string().trim().optional(),
    signedByName: z.string().trim().min(1, 'Type your full legal name to sign.'), // typed-name attestation; see docs/PLAN.md re: upgrading to the certified e-sign vendor
  })
  .superRefine((v, ctx) => {
    // The form's own rules: permanent residents give an A-Number; workers authorized to work give
    // an A-Number, I-94 number or foreign passport.
    if (v.citizenshipStatus === 'lawful_permanent_resident' && !v.alienRegistrationNumber) {
      ctx.addIssue({ code: 'custom', path: ['alienRegistrationNumber'], message: 'Enter your A-Number or USCIS number.' });
    }
    if (v.citizenshipStatus === 'alien_authorized_to_work' && !v.alienRegistrationNumber && !v.i94AdmissionNumber && !v.foreignPassportNumber) {
      ctx.addIssue({ code: 'custom', path: ['alienRegistrationNumber'], message: 'Enter one of: A-Number/USCIS number, Form I-94 number, or foreign passport number.' });
    }
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
    if (!ownsEmployee(employee, gate.profile)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
  }

  if (record.status !== 'section1_pending') {
    return NextResponse.json({ message: 'Section 1 has already been submitted. Ask HR if something needs correcting.' }, { status: 409 });
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
