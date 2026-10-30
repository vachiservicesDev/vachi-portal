'use client';

import Link from 'next/link';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { REPAIR_URGENCIES, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, DetailList, EmptyState, Loading, PageHeader, Panel, When, formatMoney } from '@/components/ui/ui';

interface Rental {
  home: { name: string; address: string; city: string | null; state: string; zip: string | null };
  lease: { startDate: string; endDate: string | null; monthlyRent: string; dueDay: number; graceDays: number; lateFee: string | null; securityDeposit: string | null };
  landlordId: string | null;
  charges: { id: string; period: string; dueDate: string; amount: string; paidAmount: string; paidOn: string | null; status: string }[];
  repairs: { id: string; title: string; description: string | null; urgency: string; status: string; appointmentAt: string | null; vendorName: string | null; createdAt: string; completedAt: string | null }[];
}

const monthLabel = (period: string) => new Date(`${period}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** A tenant's home in the portal: what they owe, their repairs, and their lease. */
export default function TenantRentalPage() {
  const { data, error, loading, reload } = useResource<{ rental: Rental | null }>('/api/rentals/me');
  const action = useAction();
  const rental = data?.rental;

  async function report(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('report', '/api/rentals/me/repairs', { body: formValues(form) }, "Sent. Your landlord has been notified and you'll see the visit time here once it's set.");
    if (result.ok) {
      form.reset();
      reload();
    }
  }

  if (loading && !data) return <Loading />;
  if (!rental)
    return (
      <>
        <PageHeader eyebrow="Rental portal" title="My rental" />
        {error ? <Alert title="Couldn't load your rental">{error}</Alert> : <EmptyState title="No active lease">Your landlord hasn&apos;t linked a lease to this account yet, or your lease has ended.</EmptyState>}
      </>
    );

  const { home, lease, charges, repairs } = rental;
  const owed = charges.filter((c) => c.status !== 'paid' && c.status !== 'upcoming');
  const owedTotal = owed.reduce((sum, c) => sum + Number(c.amount) - Number(c.paidAmount), 0);
  const latest = charges[0];
  const openRepairs = repairs.filter((r) => r.status === 'open' || r.status === 'scheduled');

  return (
    <>
      <PageHeader eyebrow="Rental portal" title={home.name} lead={[home.address, home.city, `${home.state} ${home.zip ?? ''}`.trim()].filter(Boolean).join(', ')} />
      <div className="grid gap-8">
        <Panel
          title="Rent"
          actions={owedTotal > 0 ? <Chip tone={owed.some((c) => c.status === 'late') ? 'danger' : 'new'}>{formatMoney(owedTotal)} due</Chip> : latest ? <Chip tone="live">All paid</Chip> : undefined}
          description={`${formatMoney(lease.monthlyRent)} a month, due on the ${ordinal(lease.dueDay)}. It counts as late after ${lease.graceDays} days.`}
        >
          {charges.length === 0 ? (
            <EmptyState>No rent has been added yet.</EmptyState>
          ) : (
            <DataTable
              caption="Your rent by month"
              rows={charges}
              rowKey={(c) => c.id}
              columns={[
                { header: 'Month', primary: true, cell: (c) => monthLabel(c.period) },
                { header: 'Due', cell: (c) => <When iso={c.dueDate} /> },
                { header: 'Rent', align: 'right', cell: (c) => formatMoney(c.amount) },
                { header: 'Paid', align: 'right', cell: (c) => formatMoney(c.paidAmount) },
                { header: 'Status', cell: (c) => <Chip tone={statusOf('rent', c.status).tone}>{statusOf('rent', c.status).label}</Chip> },
              ]}
            />
          )}
          <p className="mt-4 text-sm text-muted">Pay your landlord the usual way. They record each payment here, and you get a notification when they do.</p>
        </Panel>

        <Panel title="Report a repair" description="Tell your landlord what needs fixing. You'll be notified when a visit is scheduled.">
          <form onSubmit={report} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ title: 'What needs fixing' }} />
            <FieldRow>
              <TextField name="title" label="What needs fixing" required maxLength={200} hint='Like "Kitchen sink leaking".' errors={action.fieldErrors} />
              <SelectField name="urgency" label="How urgent is it?" options={REPAIR_URGENCIES} defaultValue="normal" errors={action.fieldErrors} />
            </FieldRow>
            <TextAreaField name="description" label="Details" rows={3} hint="Where it is, when it started, and good times for someone to come by." errors={action.fieldErrors} />
            <Alert tone="info">For a fire, gas smell or other emergency, call 911 first.</Alert>
            <div>
              <Button type="submit" busy={action.busy === 'report'} busyLabel="Sending…">
                Send to landlord
              </Button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Your repairs</h2>
          {repairs.length === 0 ? (
            <EmptyState>Nothing reported yet.</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {[...openRepairs, ...repairs.filter((r) => !openRepairs.includes(r))].map((r) => {
                const s = statusOf('repair', r.status);
                return (
                  <li key={r.id} className="rounded-lg border border-line bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{r.title}</p>
                        <p className="mt-1 text-sm text-muted">
                          Reported <When iso={r.createdAt} />
                          {r.status === 'done' && r.completedAt && (
                            <>
                              {' · '}Fixed <When iso={r.completedAt} />
                            </>
                          )}
                        </p>
                      </div>
                      <Chip tone={s.tone}>{s.label}</Chip>
                    </div>
                    {r.status === 'scheduled' && r.appointmentAt && (
                      <p className="mt-3 rounded-md bg-navy-50 px-3 py-2 text-ink">
                        Visit: <strong><When iso={r.appointmentAt} withTime /></strong>
                        {r.vendorName && <> with {r.vendorName}</>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Panel title="Your lease">
          <DetailList
            items={[
              { label: 'Monthly rent', value: formatMoney(lease.monthlyRent) },
              { label: 'Due', value: `${ordinal(lease.dueDay)} of each month` },
              { label: 'Lease started', value: <When iso={lease.startDate} /> },
              { label: 'Lease ends', value: <When iso={lease.endDate} empty="Month to month" /> },
              { label: 'Late fee', value: lease.lateFee ? formatMoney(lease.lateFee) : 'None' },
              { label: 'Security deposit', value: formatMoney(lease.securityDeposit) },
            ]}
          />
          {rental.landlordId && (
            <p className="mt-6 border-t border-line pt-6">
              Questions? <Link href={`/messages/${rental.landlordId}`} className="link">Message your landlord</Link>.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
