// Page building blocks, matching the website's admin (src/components/admin/ui.tsx there).
// No hooks here, so they work in server and client components.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Check } from './Check';

export function PageHeader({
  title,
  eyebrow,
  lead,
  actions,
  back,
}: {
  title: ReactNode;
  eyebrow?: string;
  lead?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-3xl">
        {back && (
          <Link href={back.href} className="link mb-3 inline-flex min-h-6 items-center text-sm">
            <span aria-hidden="true">←&nbsp;</span>
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="t-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-ink md:text-3xl">{title}</h1>
        {lead && <p className="mt-2 text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 md:shrink-0 md:flex-nowrap">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-lg border border-line bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6 md:p-8 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = 'live' | 'draft' | 'muted' | 'new' | 'danger' | 'warning' | 'info';
const tones: Record<Tone, string> = {
  live: 'bg-green-50 text-green-700 ring-1 ring-green-700/20',
  draft: 'bg-subtle text-muted ring-1 ring-line',
  muted: 'bg-subtle text-muted',
  new: 'bg-teal-50 text-teal-700 ring-1 ring-teal-700/20',
  info: 'bg-navy-50 text-navy-700 ring-1 ring-navy-700/20',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-800/25',
  danger: 'bg-danger-50 text-danger-700 ring-1 ring-danger-700/20',
};

/** A status chip. It always carries a word, never colour alone. */
export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-0.5 text-sm font-medium ${tones[tone]}`}>
      {tone === 'live' && <Check className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-white px-6 py-10 text-center">
      {title && <p className="font-display text-lg font-semibold text-ink">{title}</p>}
      {children && <div className={`text-ink-2 ${title ? 'mt-1' : ''}`}>{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'error', title, children }: { tone?: 'error' | 'success' | 'info'; title?: string; children?: ReactNode }) {
  if (tone === 'success') {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-green-700/25 bg-green-50 px-4 py-3 text-ink">
        <Check className="mt-1 h-4 w-4 shrink-0 text-green-700" />
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {children}
        </div>
      </div>
    );
  }
  if (tone === 'info') {
    return (
      <div role="note" className="rounded-lg border border-navy-700/15 bg-navy-50 px-4 py-3 text-ink-2">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children}
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-lg border border-danger-700/30 bg-danger-50 px-4 py-3 text-danger-700">
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/** Placeholder shown while a page's data loads. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="h-9 w-64 max-w-full animate-pulse rounded-md bg-subtle" />
      <div aria-hidden="true" className="h-5 w-96 max-w-full animate-pulse rounded-md bg-subtle" />
      <div aria-hidden="true" className="mt-4 h-40 animate-pulse rounded-lg bg-subtle" />
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return withTime ? `${dateTimeFmt.format(d)} ET` : dateFmt.format(d);
}

/** A date (or date and time) in US Eastern time, inside a <time> element. Shows a dash when empty. */
export function When({ iso, withTime = false, empty = '—' }: { iso: string | null | undefined; withTime?: boolean; empty?: string }) {
  const text = formatDate(iso, withTime);
  if (!text) return <span className="text-muted">{empty}</span>;
  return <time dateTime={iso ?? undefined}>{text}</time>;
}

export function DateRange({ from, to }: { from: string | null | undefined; to: string | null | undefined }) {
  return (
    <>
      <When iso={from} />
      <span aria-hidden="true"> – </span>
      <span className="sr-only"> to </span>
      <When iso={to} />
    </>
  );
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? money.format(n) : '—';
}

export function formatHours(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0 h';
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} h`;
}

/** Label/value pairs, two columns from tablet up. */
export function DetailList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  const cols = columns === 1 ? '' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={`grid gap-x-8 gap-y-5 ${cols}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="t-label text-muted">{item.label}</dt>
          <dd className="mt-1 break-words text-ink">{item.value === null || item.value === undefined || item.value === '' ? <span className="text-muted">—</span> : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A dashboard tile: big number, label, link. */
export function StatCard({ href, value, label, hint, tone }: { href: string; value: ReactNode; label: string; hint?: ReactNode; tone?: 'danger' | 'warning' }) {
  const accent = tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-amber-800' : 'text-ink';
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full flex-col rounded-lg border border-line bg-white p-5 shadow-[var(--shadow-panel)] transition-colors hover:border-navy-700 sm:p-6"
      >
        <span className={`font-display text-4xl font-semibold leading-none ${accent}`}>{value}</span>
        <span className="mt-3 font-medium text-ink group-hover:text-navy-700">{label}</span>
        {hint && <span className="mt-1 text-sm text-muted">{hint}</span>}
        <span aria-hidden="true" className="mt-auto pt-4 text-sm font-semibold text-navy-700">
          Open →
        </span>
      </Link>
    </li>
  );
}

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Shown as the card title on phones instead of a labelled row. */
  primary?: boolean;
  align?: 'left' | 'right';
  className?: string;
};

/**
 * A table on tablets and up; a stack of cards on phones, each value labelled with its column
 * header, so nothing scrolls sideways.
 */
export function DataTable<T>({ columns, rows, rowKey, caption }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption?: string }) {
  const primary = columns.find((c) => c.primary);
  const rest = columns.filter((c) => !c.primary);
  return (
    <div className="rounded-lg border border-line bg-white">
      <table className="hidden w-full text-left md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`t-label px-4 py-3 font-normal text-muted ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-middle transition-colors hover:bg-subtle/60">
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3.5 text-[0.9375rem] text-ink-2 ${c.primary ? 'font-medium text-ink' : ''} ${c.align === 'right' ? 'text-right' : ''} ${c.className ?? ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="p-4">
            {primary && <div className="font-medium text-ink">{primary.cell(row)}</div>}
            <dl className={`grid gap-2 ${primary ? 'mt-3' : ''}`}>
              {rest.map((c) => (
                <div key={c.header} className="flex items-center justify-between gap-4">
                  <dt className="t-label shrink-0 text-muted">{c.header}</dt>
                  <dd className="min-w-0 text-right text-[0.9375rem] text-ink-2">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group font-semibold text-navy-700 hover:text-navy-800 hover:underline">
      {children}
      <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
        &nbsp;→
      </span>
    </Link>
  );
}
