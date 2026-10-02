import { Button } from '@/components/ui/Button';
import { Chip, EmptyState, When, formatHours } from '@/components/ui/ui';

export interface Entry {
  id: string;
  date: string;
  hours: string;
  taskDescription: string | null;
  isOvertime: boolean | null;
}

/** A timesheet's daily entries with a total; pass onDelete to allow removing entries. */
export function EntryList({ entries, onDelete, busy }: { entries: Entry[]; onDelete?: (id: string) => void; busy?: string | null }) {
  if (entries.length === 0) return <EmptyState>No hours logged yet.</EmptyState>;
  const total = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  return (
    <div className="rounded-lg border border-line">
      <ul className="divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className="w-28 shrink-0 font-medium text-ink">
              <When iso={e.date} />
            </span>
            <span className="min-w-0 flex-1 text-ink-2">{e.taskDescription || <span className="text-muted">No description</span>}</span>
            {e.isOvertime && <Chip tone="warning">Overtime</Chip>}
            <span className="w-16 text-right font-medium tabular-nums text-ink">{formatHours(e.hours)}</span>
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(e.id)} busy={busy === e.id} busyLabel="Removing" aria-label={`Remove entry for ${e.date}`}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line bg-subtle px-4 py-3">
        <span className="t-label text-muted">Total</span>
        <span className="font-display text-lg font-semibold tabular-nums text-ink">{formatHours(total)}</span>
      </div>
    </div>
  );
}
