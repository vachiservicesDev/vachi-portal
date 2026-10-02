import { ownEmployee } from '@/lib/employees';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, performanceReviews } from '@/db/schema';
import { requireActiveUser, requireAdmin } from '@/lib/auth/requireAdmin';
import { and, desc, eq, ne } from 'drizzle-orm';

const day = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const createSchema = z
  .object({
    employeeId: z.string().uuid('Choose an employee.'),
    periodStart: day('Enter the start of the review period.'),
    periodEnd: day('Enter the end of the review period.'),
    rating: z.coerce.number().int().min(1, 'Rating is 1 to 5.').max(5, 'Rating is 1 to 5.').optional(),
    strengths: z.string().max(10000).optional(),
    areasForImprovement: z.string().max(10000).optional(),
    goals: z.string().max(10000).optional(),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { message: 'The period must end on or after it starts.', path: ['periodEnd'] });

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (gate.profile.role === 'admin') {
    const reviews = await db
      .select({
        id: performanceReviews.id,
        employeeId: performanceReviews.employeeId,
        periodStart: performanceReviews.periodStart,
        periodEnd: performanceReviews.periodEnd,
        rating: performanceReviews.rating,
        strengths: performanceReviews.strengths,
        areasForImprovement: performanceReviews.areasForImprovement,
        goals: performanceReviews.goals,
        status: performanceReviews.status,
        submittedAt: performanceReviews.submittedAt,
        employeeAcknowledgedAt: performanceReviews.employeeAcknowledgedAt,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
      })
      .from(performanceReviews)
      .innerJoin(employees, eq(employees.id, performanceReviews.employeeId))
      .orderBy(desc(performanceReviews.periodStart));
    return NextResponse.json({ reviews });
  }

  const [employee] = await db.select().from(employees).where(ownEmployee(gate.profile)).limit(1);
  if (!employee) return NextResponse.json({ reviews: [] });

  // Drafts stay with HR until they're shared.
  const reviews = await db
    .select({
      id: performanceReviews.id,
      periodStart: performanceReviews.periodStart,
      periodEnd: performanceReviews.periodEnd,
      rating: performanceReviews.rating,
      strengths: performanceReviews.strengths,
      areasForImprovement: performanceReviews.areasForImprovement,
      goals: performanceReviews.goals,
      status: performanceReviews.status,
      submittedAt: performanceReviews.submittedAt,
      employeeAcknowledgedAt: performanceReviews.employeeAcknowledgedAt,
    })
    .from(performanceReviews)
    .where(and(eq(performanceReviews.employeeId, employee.id), ne(performanceReviews.status, 'draft')))
    .orderBy(desc(performanceReviews.periodStart));

  return NextResponse.json({ reviews });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, body.data.employeeId)).limit(1);
  if (!employee) return NextResponse.json({ message: 'Employee not found' }, { status: 404 });

  const [review] = await db
    .insert(performanceReviews)
    .values({ ...body.data, reviewerId: gate.user.id })
    .returning();

  return NextResponse.json({ review }, { status: 201 });
}
