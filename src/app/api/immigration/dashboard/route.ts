import { NextResponse } from 'next/server';
import { db } from '@/db';
import { employees } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { isNotNull } from 'drizzle-orm';

/**
 * The immigration-tracker "dashboard" isn't its own table - it's visa
 * expiry data already on `employees`, surfaced with urgency buckets so
 * admins don't have to eyeball raw dates. Document-level expiry (the
 * `documents` table) joins in once that feature has real data flowing
 * through it.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const rows = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      visaType: employees.visaType,
      visaExpiryDate: employees.visaExpiryDate,
      status: employees.status,
    })
    .from(employees)
    .where(isNotNull(employees.visaExpiryDate));

  const now = new Date();
  const withUrgency = rows.map((e) => {
    const daysUntilExpiry = e.visaExpiryDate
      ? Math.floor((new Date(e.visaExpiryDate).getTime() - now.getTime()) / 86_400_000)
      : null;

    let urgency: 'expired' | 'critical' | 'warning' | 'ok' = 'ok';
    if (daysUntilExpiry !== null) {
      if (daysUntilExpiry < 0) urgency = 'expired';
      else if (daysUntilExpiry <= 30) urgency = 'critical';
      else if (daysUntilExpiry <= 90) urgency = 'warning';
    }

    return { ...e, daysUntilExpiry, urgency };
  });

  withUrgency.sort((a, b) => (a.daysUntilExpiry ?? Infinity) - (b.daysUntilExpiry ?? Infinity));

  return NextResponse.json({ employees: withUrgency });
}
