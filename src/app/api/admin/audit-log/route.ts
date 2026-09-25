import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, profiles } from '@/db/schema';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      createdAt: auditLogs.createdAt,
      actorEmail: profiles.email,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return NextResponse.json({ entries: rows });
}
