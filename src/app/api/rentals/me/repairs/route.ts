import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { repairRequests } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { createNotification } from '@/lib/notifications/create';
import { tenantLease } from '@/lib/rentals/access';
import { repairCreateSchema } from '@/lib/rentals/schemas';

/** A tenant reports something that needs fixing in their home; the landlord is notified. */
export async function POST(request: NextRequest) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await tenantLease(gate.user.id);
  if (!found) return NextResponse.json({ message: "You don't have an active lease in the portal." }, { status: 403 });

  const body = repairCreateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: 'Invalid input', errors: body.error.flatten() }, { status: 400 });

  const [repair] = await db
    .insert(repairRequests)
    .values({ ...body.data, propertyId: found.property.id, reportedBy: gate.user.id })
    .returning({ id: repairRequests.id, title: repairRequests.title, urgency: repairRequests.urgency, status: repairRequests.status, createdAt: repairRequests.createdAt });

  await createNotification({
    userId: found.property.ownerId,
    type: 'repair_reported',
    title: repair.urgency === 'urgent' ? 'Urgent repair reported' : 'Repair reported',
    message: `${found.lease.tenantName} at ${found.property.name}: "${repair.title}".`,
    priority: repair.urgency === 'urgent' ? 'high' : 'medium',
    actionUrl: `/admin/rentals/${found.property.id}`,
    actionLabel: 'Schedule it',
  });
  return NextResponse.json({ repair }, { status: 201 });
}
