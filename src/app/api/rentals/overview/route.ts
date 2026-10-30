import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { rentCharges, rentalLeases, rentalProperties, rentalReminders, repairRequests } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { todayEastern } from '@/lib/dates';
import { chargeStatus, periodStart } from '@/lib/rentals/rent';

/**
 * The landlord's rentals home: this month's rent (expected vs collected), anyone behind, open
 * repairs, and insurance/HOA/tax reminders due in the next 30 days or overdue.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const today = todayEastern();
  const month = periodStart(today);
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);

  const homes = await db
    .select({ id: rentalProperties.id, name: rentalProperties.name })
    .from(rentalProperties)
    .where(eq(rentalProperties.ownerId, gate.user.id));
  const ids = homes.map((h) => h.id);
  const nameOf = new Map(homes.map((h) => [h.id, h.name]));
  if (!ids.length) return NextResponse.json({ homes: 0, occupied: 0, month, expected: 0, collected: 0, behind: [], repairs: [], reminders: [] });

  const [leases, repairs, reminders] = await Promise.all([
    db.select().from(rentalLeases).where(inArray(rentalLeases.propertyId, ids)),
    db
      .select()
      .from(repairRequests)
      .where(and(inArray(repairRequests.propertyId, ids), inArray(repairRequests.status, ['open', 'scheduled'])))
      .orderBy(asc(repairRequests.createdAt)),
    db
      .select()
      .from(rentalReminders)
      .where(and(inArray(rentalReminders.propertyId, ids), isNull(rentalReminders.doneAt), lte(rentalReminders.dueDate, soon.toISOString().slice(0, 10))))
      .orderBy(asc(rentalReminders.dueDate)),
  ]);
  const leaseOf = new Map(leases.map((l) => [l.id, l]));
  const charges = leases.length ? await db.select().from(rentCharges).where(inArray(rentCharges.leaseId, leases.map((l) => l.id))) : [];

  let expected = 0;
  let collected = 0;
  const behind = [];
  for (const c of charges) {
    const lease = leaseOf.get(c.leaseId)!;
    const status = chargeStatus(c, lease.graceDays, today);
    if (c.period === month) {
      expected += Number(c.amount);
      collected += Number(c.paidAmount);
    }
    if (status === 'late' || (status === 'partial' && c.period < month)) {
      behind.push({
        chargeId: c.id,
        propertyId: lease.propertyId,
        home: nameOf.get(lease.propertyId),
        tenantName: lease.tenantName,
        period: c.period,
        dueDate: c.dueDate,
        owed: (Number(c.amount) - Number(c.paidAmount)).toFixed(2),
        lateFee: lease.lateFee,
      });
    }
  }
  behind.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Urgent first, then scheduled visits soonest first, then the oldest unscheduled.
  const rank = (r: (typeof repairs)[number]) => (r.urgency === 'urgent' && r.status === 'open' ? 0 : r.status === 'open' ? 2 : 1);
  repairs.sort((a, b) => rank(a) - rank(b) || (a.appointmentAt?.getTime() ?? 0) - (b.appointmentAt?.getTime() ?? 0));

  return NextResponse.json({
    homes: homes.length,
    occupied: new Set(leases.filter((l) => l.status === 'active').map((l) => l.propertyId)).size,
    month,
    expected: expected.toFixed(2),
    collected: collected.toFixed(2),
    behind,
    repairs: repairs.map((r) => ({ ...r, home: nameOf.get(r.propertyId) })),
    reminders: reminders.map((r) => ({ ...r, home: nameOf.get(r.propertyId) })),
  });
}
