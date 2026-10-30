'use client';

import Link from 'next/link';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { REMINDER_KINDS, labelFrom, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FieldRow, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, EmptyState, Loading, PageHeader, Panel, StatCard, When, formatMoney } from '@/components/ui/ui';

interface Home {
  id: string;
  name: string;
  address: string;
  city: string | null;
  tenantName: string | null;
  monthlyRent: string | null;
  leaseEnds: string | null;
}

interface Overview {
  homes: number;
  occupied: number;
  month: string;
  expected: string;
  collected: string;
  behind: { chargeId: string; propertyId: string; home: string; tenantName: string; period: string; dueDate: string; owed: string }[];
  repairs: { id: string; propertyId: string; home: string; title: string; urgency: string; status: string; appointmentAt: string | null; createdAt: string }[];
  reminders: { id: string; propertyId: string; home: string; kind: string; title: string; amount: string | null; dueDate: string }[];
}

const monthLabel = (period: string) => new Date(`${period}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function AdminRentalsPage() {
  const overview = useResource<Overview>('/api/rentals/overview');
  const homes = useResource<{ properties: Home[] }>('/api/rentals/properties');
  const action = useAction();
  const rentAction = useAction();
  const o = overview.data;
  const list = homes.data?.properties ?? [];

  async function addHome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('add', '/api/rentals/properties', { body: formValues(form) }, 'Home added. Open it to add the tenant and lease.');
    if (result.ok) {
      form.reset();
      homes.reload();
      overview.reload();
    }
  }

  async function addRent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const month = String(new FormData(e.currentTarget).get('month') ?? '');
    const result = await rentAction.run<{ created: number; skipped: number }>('rent', '/api/rentals/charges/generate', { body: { month } });
    if (result.ok && result.data) {
      const { created, skipped } = result.data;
      rentAction.setSuccess(
        created === 0 && skipped === 0
          ? 'No active leases cover that month.'
          : `Added rent for ${created} ${created === 1 ? 'home' : 'homes'}${skipped ? `; ${skipped} already had it` : ''}.`,
      );
      overview.reload();
    }
  }

  const thisMonth = o?.month.slice(0, 7) ?? '';
  const behindTotal = (o?.behind ?? []).reduce((sum, b) => sum + Number(b.owed), 0);

  return (
    <>
      <PageHeader eyebrow="Rentals" title="Rental homes" lead="Rent, repairs, insurance and HOA for your homes in one place. Tenants sign in to see their rent, report repairs and message you." />
      <div className="grid gap-8">
        {overview.error && <Alert title="Couldn't load the overview">{overview.error}</Alert>}
        <section aria-label="This month">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              href="#rent"
              value={o ? formatMoney(o.collected) : '–'}
              label={o ? `Collected for ${monthLabel(o.month)}` : 'Collected this month'}
              hint={o ? `of ${formatMoney(o.expected)} expected` : undefined}
            />
            <StatCard href="#behind" value={o ? o.behind.length : '–'} label="Behind on rent" hint={o && behindTotal ? `${formatMoney(behindTotal)} owed` : 'Everyone is up to date.'} tone={o?.behind.length ? 'danger' : undefined} />
            <StatCard href="#repairs" value={o ? o.repairs.length : '–'} label="Open repairs" hint="Reported and not fixed yet." tone={o?.repairs.some((r) => r.urgency === 'urgent' && r.status === 'open') ? 'warning' : undefined} />
            <StatCard href="#reminders" value={o ? o.reminders.length : '–'} label="Bills due in 30 days" hint="Insurance, HOA, tax and more." tone={o?.reminders.some((r) => r.dueDate < new Date().toISOString().slice(0, 10)) ? 'warning' : undefined} />
          </ul>
        </section>

        <Panel id="rent" title="Add a month's rent" description="Adds the rent to every active lease for that month. Running it again never charges twice.">
          <form onSubmit={addRent} noValidate className="grid gap-5">
            <FormStatus error={rentAction.error} success={rentAction.success} fieldErrors={rentAction.fieldErrors} labels={{ month: 'Month' }} />
            <div className="flex flex-wrap items-end gap-4">
              <label className="grid gap-1.5">
                <span className="font-medium text-ink">Month</span>
                <input key={thisMonth} type="month" name="month" defaultValue={thisMonth} required className="min-h-11 rounded-md border border-line-input bg-white px-3 text-ink focus:border-teal-600" />
              </label>
              <Button type="submit" busy={rentAction.busy === 'rent'} busyLabel="Adding…">
                Add rent
              </Button>
            </div>
          </form>
        </Panel>

        <section id="behind">
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Behind on rent</h2>
          {overview.loading && !o ? (
            <Loading />
          ) : !o?.behind.length ? (
            <EmptyState>Nobody is behind. Rent counts as late once the grace period after the due date has passed.</EmptyState>
          ) : (
            <DataTable
              caption="Tenants behind on rent"
              rows={o.behind}
              rowKey={(b) => b.chargeId}
              columns={[
                { header: 'Tenant', primary: true, cell: (b) => <Link href={`/admin/rentals/${b.propertyId}`} className="font-semibold text-navy-700 hover:underline">{b.tenantName}</Link> },
                { header: 'Home', cell: (b) => b.home },
                { header: 'Month', cell: (b) => monthLabel(b.period) },
                { header: 'Was due', cell: (b) => <When iso={b.dueDate} /> },
                { header: 'Still owed', align: 'right', cell: (b) => <span className="font-semibold text-danger-700">{formatMoney(b.owed)}</span> },
              ]}
            />
          )}
        </section>

        <section id="repairs">
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Repairs to handle</h2>
          {overview.loading && !o ? (
            <Loading />
          ) : !o?.repairs.length ? (
            <EmptyState>No open repairs.</EmptyState>
          ) : (
            <DataTable
              caption="Open repairs"
              rows={o.repairs}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Repair', primary: true, cell: (r) => <Link href={`/admin/rentals/${r.propertyId}#repairs`} className="font-semibold text-navy-700 hover:underline">{r.title}</Link> },
                { header: 'Home', cell: (r) => r.home },
                { header: 'Urgency', cell: (r) => <Chip tone={statusOf('repairUrgency', r.urgency).tone}>{statusOf('repairUrgency', r.urgency).label}</Chip> },
                { header: 'Status', cell: (r) => <Chip tone={statusOf('repair', r.status).tone}>{statusOf('repair', r.status).label}</Chip> },
                { header: 'Visit', cell: (r) => <When iso={r.appointmentAt} withTime empty="Not set" /> },
              ]}
            />
          )}
        </section>

        <section id="reminders">
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Bills and renewals coming up</h2>
          {overview.loading && !o ? (
            <Loading />
          ) : !o?.reminders.length ? (
            <EmptyState>Nothing due in the next 30 days. Add insurance, HOA and tax reminders on each home&apos;s page.</EmptyState>
          ) : (
            <DataTable
              caption="Reminders due soon"
              rows={o.reminders}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Reminder', primary: true, cell: (r) => <Link href={`/admin/rentals/${r.propertyId}#reminders`} className="font-semibold text-navy-700 hover:underline">{r.title}</Link> },
                { header: 'Home', cell: (r) => r.home },
                { header: 'Type', cell: (r) => labelFrom(REMINDER_KINDS, r.kind) },
                { header: 'Amount', align: 'right', cell: (r) => formatMoney(r.amount) },
                { header: 'Due', cell: (r) => <When iso={r.dueDate} /> },
              ]}
            />
          )}
        </section>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Your homes</h2>
          {homes.error && <Alert title="Couldn't load your homes">{homes.error}</Alert>}
          {homes.loading && !homes.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <EmptyState title="No homes yet">Add your first home below.</EmptyState>
          ) : (
            <DataTable
              caption="Rental homes"
              rows={list}
              rowKey={(h) => h.id}
              columns={[
                { header: 'Home', primary: true, cell: (h) => <Link href={`/admin/rentals/${h.id}`} className="font-semibold text-navy-700 hover:underline">{h.name}</Link> },
                { header: 'Address', cell: (h) => [h.address, h.city].filter(Boolean).join(', ') },
                { header: 'Tenant', cell: (h) => h.tenantName ?? <Chip tone="new">Vacant</Chip> },
                { header: 'Rent', align: 'right', cell: (h) => formatMoney(h.monthlyRent) },
                { header: 'Lease ends', cell: (h) => <When iso={h.leaseEnds} empty={h.tenantName ? 'Month to month' : '—'} /> },
              ]}
            />
          )}
        </section>

        <Panel title="Add a home">
          <form onSubmit={addHome} noValidate className="grid gap-5">
            <FormStatus
              error={action.error}
              success={action.success}
              fieldErrors={action.fieldErrors}
              labels={{ name: 'Name', address: 'Street address', city: 'City', state: 'State', zip: 'ZIP code' }}
            />
            <FieldRow>
              <TextField name="name" label="Name" required hint='What you call it, like "Unit 12" or "Wooster Heights townhome".' errors={action.fieldErrors} maxLength={150} />
              <TextField name="address" label="Street address" required errors={action.fieldErrors} autoComplete="street-address" />
            </FieldRow>
            <FieldRow cols={3}>
              <TextField name="city" label="City" defaultValue="Danbury" errors={action.fieldErrors} />
              <TextField name="state" label="State" defaultValue="CT" maxLength={2} errors={action.fieldErrors} />
              <TextField name="zip" label="ZIP code" inputMode="numeric" errors={action.fieldErrors} />
            </FieldRow>
            <FieldRow>
              <TextField name="hoaName" label="HOA name" errors={action.fieldErrors} />
              <TextAreaField name="hoaContact" label="HOA contact" rows={2} hint="Manager, phone, email, portal." errors={action.fieldErrors} />
            </FieldRow>
            <div>
              <Button type="submit" busy={action.busy === 'add'} busyLabel="Adding…">
                Add home
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
