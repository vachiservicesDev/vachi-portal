import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, onboardingSessions } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { desc } from 'drizzle-orm';

const createSessionSchema = z.object({
  employeeEmail: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employmentType: z.enum(['w2', '1099']),
  startDate: z.string(),
  position: z.string().optional(),
  department: z.string().optional(),
  visaType: z
    .enum(['OPT', 'STEM_OPT', 'H1B', 'L1', 'O1', 'TN', 'E3', 'Other'])
    .optional()
    .default('Other'),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const sessions = await db
    .select()
    .from(onboardingSessions)
    .orderBy(desc(onboardingSessions.createdAt));

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSessionSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const { employeeEmail, firstName, lastName, employmentType, startDate, position, department, visaType } =
    body.data;

  // employees.userId stays null until this person actually signs up and
  // gets a Supabase Auth account + profile — matches how onboarding starts
  // before the employee has ever logged in.
  const [employee] = await db
    .insert(employees)
    .values({
      firstName,
      lastName,
      email: employeeEmail,
      visaType,
      position,
      department,
      startDate,
    })
    .returning();

  const [session] = await db
    .insert(onboardingSessions)
    .values({
      employeeId: employee.id,
      employmentType,
      status: 'draft',
      formData: { employeeName: `${firstName} ${lastName}`, startDate, position, department, visaType },
      createdBy: gate.user.id,
    })
    .returning();

  return NextResponse.json({ session, employee }, { status: 201 });
}
