import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { timesheetEntries, timesheets } from '@/db/schema';

/** Employees can change a timesheet while it's a draft, or after HR returns it. */
export const EDITABLE: string[] = ['draft', 'rejected'];

/** Keeps the timesheet's totals in step with its entries, so drafts show real hours too. */
export async function recalcTotals(timesheetId: string) {
  const entries = await db.select().from(timesheetEntries).where(eq(timesheetEntries.timesheetId, timesheetId));
  const total = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const overtime = entries.filter((e) => e.isOvertime).reduce((sum, e) => sum + Number(e.hours), 0);
  await db
    .update(timesheets)
    .set({ totalHours: String(total), overtimeHours: String(overtime), updatedAt: new Date() })
    .where(eq(timesheets.id, timesheetId));
}
