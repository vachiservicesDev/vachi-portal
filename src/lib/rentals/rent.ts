import { addMonths } from '@/lib/dates';

export type ChargeStatus = 'upcoming' | 'due' | 'late' | 'partial' | 'paid';

/** "2026-11" or "2026-11-15" → "2026-11-01". */
export function periodStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

/** The rent due date in a month: the lease's due day, clamped to the month's last day. */
export function dueDateFor(period: string, dueDay: number): string {
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period.slice(0, 7)}-${String(Math.min(Math.max(dueDay, 1), lastDay)).padStart(2, '0')}`;
}

/** The last day rent can arrive before it counts as late. */
export function graceEnds(dueDate: string, graceDays: number): string {
  const d = new Date(`${dueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + graceDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Where one month's rent stands on `today`. Paid in full wins; after the grace period anything
 * short is late; before that, a part payment is "partial" and nothing paid is "due" (or
 * "upcoming" when the due date hasn't arrived).
 */
export function chargeStatus(
  charge: { amount: string | number; paidAmount: string | number; dueDate: string },
  graceDays: number,
  today: string,
): ChargeStatus {
  const amount = Number(charge.amount);
  const paid = Number(charge.paidAmount);
  if (paid >= amount) return 'paid';
  if (today > graceEnds(charge.dueDate, graceDays)) return 'late';
  if (paid > 0) return 'partial';
  return today < charge.dueDate ? 'upcoming' : 'due';
}

/** Whether a lease covers any day of the month starting `period`. */
export function leaseCoversPeriod(lease: { startDate: string; endDate: string | null }, period: string): boolean {
  const monthEnd = addMonths(period, 1);
  return lease.startDate < monthEnd && (!lease.endDate || lease.endDate >= period);
}

/** The next due date for a repeating reminder, or null when it doesn't repeat. */
export function nextReminderDate(dueDate: string, repeat: string): string | null {
  if (repeat === 'monthly') return addMonths(dueDate, 1);
  if (repeat === 'quarterly') return addMonths(dueDate, 3);
  if (repeat === 'yearly') return addMonths(dueDate, 12);
  return null;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
/** "$2,450.00", for notification text written on the server. */
export function usdText(value: string | number): string {
  return usd.format(Number(value));
}

/** "2026-11-01" → "November 2026". */
export function monthName(period: string): string {
  return new Date(`${period}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
