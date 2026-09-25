import { db } from '@/db';
import { auditLogs } from '@/db/schema';

interface LogAuditInput {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: unknown;
  newValues?: unknown;
}

/**
 * Fire-and-forget audit trail entry. Wired into a representative set of
 * sensitive admin actions (I-9 Section 2 completion, timesheet approval,
 * green card stage changes) rather than every write in the app - the
 * pattern is here, extend it to other admin mutations as they matter.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    oldValues: input.oldValues,
    newValues: input.newValues,
  });
}
