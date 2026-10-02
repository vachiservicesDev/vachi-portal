/** Same calendar day `months` later, clamped to the month's last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(isoDay: string, months: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Today's date in US Eastern time, as YYYY-MM-DD. */
export function todayEastern(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/** Whole days from today (Eastern) to an ISO day; negative when it has passed. */
export function daysUntil(isoDay: string): number {
  const a = Date.parse(`${todayEastern()}T00:00:00Z`);
  const b = Date.parse(`${isoDay.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
