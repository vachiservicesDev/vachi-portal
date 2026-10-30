import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rentalLeases, rentalProperties, repairRequests } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createNotification } from '@/lib/notifications/create';
import { dec, repairUpdateSchema } from '@/lib/rentals/schemas';

const visitTime = (iso: Date) =>
  iso.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

/**
 * Schedules, updates or closes a repair. Setting a visit time moves an open repair to
 * "scheduled", and the tenant is told about the visit and when the repair is marked done.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const [found] = await db
    .select({ repair: repairRequests })
    .from(repairRequests)
    .innerJoin(rentalProperties, eq(rentalProperties.id, repairRequests.propertyId))
    .where(and(eq(repairRequests.id, params.id), eq(rentalProperties.ownerId, gate.user.id)))
    .limit(1);
  if (!found) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  const before = found.repair;

  const body = repairUpdateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const d = body.data;
  const appointmentAt = d.appointmentAt === undefined ? undefined : d.appointmentAt ? new Date(d.appointmentAt) : null;
  let status = d.status ?? before.status;
  if (appointmentAt && status === 'open') status = 'scheduled';

  const [repair] = await db
    .update(repairRequests)
    .set({
      status,
      ...(appointmentAt !== undefined ? { appointmentAt } : {}),
      ...(d.vendorName !== undefined ? { vendorName: d.vendorName || null } : {}),
      ...(d.vendorPhone !== undefined ? { vendorPhone: d.vendorPhone || null } : {}),
      ...(d.cost !== undefined ? { cost: d.cost === '' ? null : dec(d.cost) } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      completedAt: status === 'done' ? (before.completedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(repairRequests.id, before.id))
    .returning();

  // The tenant on the home's current lease hears about a new visit time and the finished repair.
  const [lease] = await db
    .select({ tenantUserId: rentalLeases.tenantUserId })
    .from(rentalLeases)
    .where(and(eq(rentalLeases.propertyId, repair.propertyId), eq(rentalLeases.status, 'active')))
    .orderBy(desc(rentalLeases.startDate))
    .limit(1);
  const tenant = lease?.tenantUserId;
  if (tenant) {
    const newVisit = repair.appointmentAt && repair.appointmentAt.getTime() !== before.appointmentAt?.getTime();
    if (newVisit && repair.status === 'scheduled') {
      await createNotification({
        userId: tenant,
        type: 'repair_scheduled',
        title: 'Repair visit scheduled',
        message: `"${repair.title}": a visit is set for ${visitTime(repair.appointmentAt!)}${repair.vendorName ? ` with ${repair.vendorName}` : ''}.`,
        actionUrl: '/rental',
        actionLabel: 'See details',
      });
    }
    if (repair.status === 'done' && before.status !== 'done') {
      await createNotification({
        userId: tenant,
        type: 'repair_done',
        title: 'Repair marked done',
        message: `"${repair.title}" is marked as fixed. If it isn't, report it again or message your landlord.`,
        actionUrl: '/rental',
      });
    }
  }
  return NextResponse.json({ repair });
}
