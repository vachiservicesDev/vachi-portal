import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { employees, performanceReviews } from '@/db/schema';
import { requireActiveUser, requireAdmin } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

const createSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  goals: z.string().optional(),
});

export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  if (gate.profile.role === 'admin') {
    const reviews = await db
      .select({
        id: performanceReviews.id,
        periodStart: performanceReviews.periodStart,
        periodEnd: performanceReviews.periodEnd,
        rating: performanceReviews.rating,
        status: performanceReviews.status,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
      })
      .from(performanceReviews)
      .innerJoin(employees, eq(employees.id, performanceReviews.employeeId))
      .orderBy(desc(performanceReviews.periodStart));
    return NextResponse.json({ reviews });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, gate.profile.email))
    .limit(1);
  if (!employee) return NextResponse.json({ reviews: [] });

  const reviews = await db
    .select()
    .from(performanceReviews)
    .where(eq(performanceReviews.employeeId, employee.id))
    .orderBy(desc(performanceReviews.periodStart));

  return NextResponse.json({ reviews });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, {
      status: 400,
    });
  }

  const [review] = await db
    .insert(performanceReviews)
    .values({ ...body.data, reviewerId: gate.user.id })
    .returning();

  return NextResponse.json({ review }, { status: 201 });
}
