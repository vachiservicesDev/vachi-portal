import { daysUntil } from '@/lib/dates';
import { Chip, formatDate } from './ui';

/** "Done", "Overdue", "Due in 12 days" or the due date, toned by urgency. */
export function DueChip({ due, done, soonDays = 30 }: { due: string | null | undefined; done?: string | null; soonDays?: number }) {
  if (done) return <Chip tone="live">Done {formatDate(done)}</Chip>;
  if (!due) return <Chip tone="muted">No due date</Chip>;
  const days = daysUntil(due);
  if (days < 0) return <Chip tone="danger">Overdue since {formatDate(due)}</Chip>;
  if (days === 0) return <Chip tone="danger">Due today</Chip>;
  if (days <= soonDays) return <Chip tone="warning">Due in {days} {days === 1 ? 'day' : 'days'}</Chip>;
  return <Chip tone="muted">Due {formatDate(due)}</Chip>;
}
