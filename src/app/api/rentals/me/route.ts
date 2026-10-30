import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, rentCharges, repairRequests } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { todayEastern } from '@/lib/dates';
import { tenantLease } from '@/lib/rentals/access';
import { chargeStatus } from '@/lib/rentals/rent';

/**
 * The signed-in tenant's home, lease terms, rent history and repairs. Landlord-only fields
 * (repair notes and costs, other leases, reminders) are never included.
 */
export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await tenantLease(gate.user.id);
  if (!found) return NextResponse.json({ rental: null });
  const { lease, property } = found;

  const [charges, repairs, [landlord]] = await Promise.all([
    db.select().from(rentCharges).where(eq(rentCharges.leaseId, lease.id)).orderBy(desc(rentCharges.period)),
    db
      .select({
        id: repairRequests.id,
        title: repairRequests.title,
        description: repairRequests.description,
        urgency: repairRequests.urgency,
        status: repairRequests.status,
        appointmentAt: repairRequests.appointmentAt,
        vendorName: repairRequests.vendorName,
        createdAt: repairRequests.createdAt,
        completedAt: repairRequests.completedAt,
      })
      .from(repairRequests)
      .where(eq(repairRequests.propertyId, property.id))
      .orderBy(desc(repairRequests.createdAt)),
    db.select({ id: profiles.id, email: profiles.email }).from(profiles).where(eq(profiles.id, property.ownerId)).limit(1),
  ]);

  const today = todayEastern();
  const since = new Date(`${lease.startDate}T00:00:00Z`);
  return NextResponse.json({
    rental: {
      home: { name: property.name, address: property.address, city: property.city, state: property.state, zip: property.zip },
      lease: {
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRent: lease.monthlyRent,
        dueDay: lease.dueDay,
        graceDays: lease.graceDays,
        lateFee: lease.lateFee,
        securityDeposit: lease.securityDeposit,
      },
      landlordId: landlord?.id ?? null,
      charges: charges.map((c) => ({
        id: c.id,
        period: c.period,
        dueDate: c.dueDate,
        amount: c.amount,
        paidAmount: c.paidAmount,
        paidOn: c.paidOn,
        status: chargeStatus(c, lease.graceDays, today),
      })),
      // Repairs from before this lease began belong to an earlier tenant.
      repairs: repairs.filter((r) => r.createdAt >= since),
    },
  });
}
