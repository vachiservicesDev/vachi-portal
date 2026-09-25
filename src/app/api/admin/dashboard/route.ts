import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  employees,
  i9Records,
  onboardingSessions,
  timesheets,
  weeklyTrainingSummaries,
} from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { and, eq, isNotNull, lt, ne } from 'drizzle-orm';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().slice(0, 10);

  const [
    pendingOnboarding,
    overdueI9Section2,
    pendingTimesheets,
    pendingSummaries,
    expiringVisas,
  ] = await Promise.all([
    db
      .select({ id: onboardingSessions.id })
      .from(onboardingSessions)
      .where(ne(onboardingSessions.status, 'completed')),
    db
      .select({ id: i9Records.id })
      .from(i9Records)
      .where(and(eq(i9Records.status, 'section2_pending'), lt(i9Records.section2DueAt, today))),
    db.select({ id: timesheets.id }).from(timesheets).where(eq(timesheets.status, 'submitted')),
    db
      .select({ id: weeklyTrainingSummaries.id })
      .from(weeklyTrainingSummaries)
      .where(eq(weeklyTrainingSummaries.status, 'submitted')),
    db
      .select({ id: employees.id })
      .from(employees)
      .where(and(isNotNull(employees.visaExpiryDate), lt(employees.visaExpiryDate, in30DaysStr))),
  ]);

  return NextResponse.json({
    pendingOnboarding: pendingOnboarding.length,
    overdueI9Section2: overdueI9Section2.length,
    pendingTimesheets: pendingTimesheets.length,
    pendingTrainingSummaries: pendingSummaries.length,
    visasExpiringSoon: expiringVisas.length,
  });
}
