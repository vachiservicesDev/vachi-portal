'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, formValues, useAction, useResource } from '@/lib/client/api';
import { PAYMENT_METHODS, REMINDER_KINDS, REMINDER_REPEATS, REPAIR_STATUSES, REPAIR_URGENCIES, labelFrom, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, DetailList, EmptyState, Loading, PageHeader, Panel, When, formatMoney } from '@/components/ui/ui';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string;
  zip: string | null;
  hoaName: string | null;
  hoaContact: string | null;
  notes: string | null;
}
interface Lease {
  id: string;
  tenantUserId: string | null;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  startDate: string;
  endDate: string | null;
  monthlyRent: string;
  dueDay: number;
  graceDays: number;
  lateFee: string | null;
  securityDeposit: string | null;
  status: string;
}
interface Charge {
  id: string;
  leaseId: string;
  period: string;
  dueDate: string;
  amount: string;
  paidAmount: string;
  paidOn: string | null;
  paymentMethod: string | null;
  note: string | null;
  status: string;
}
interface Repair {
  id: string;
  title: string;
  description: string | null;
  urgency: string;
  status: string;
  appointmentAt: string | null;
  vendorName: string | null;
  vendorPhone: string | null;
  cost: string | null;
  notes: string | null;
  createdAt: string;
}
interface Reminder {
  id: string;
  kind: string;
  title: string;
  provider: string | null;
  reference: string | null;
  amount: string | null;
  dueDate: string;
  repeat: string;
  notes: string | null;
  doneAt: string | null;
}
interface Detail {
  property: Property;
  leases: Lease[];
  charges: Charge[];
  repairs: Repair[];
  reminders: Reminder[];
}

const monthLabel = (period: string) => new Date(`${period}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** "2026-11-04T14:30:00.000Z" → the value a datetime-local input expects, in the viewer's time. */
function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function RentalHomePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useResource<Detail>(`/api/rentals/properties/${params.id}`);
  const back = { href: '/admin/rentals', label: 'All rental homes' };

  if (loading && !data) return <Loading />;
  if (!data)
    return (
      <>
        <PageHeader back={back} title="Rental home" />
        <Alert title="Couldn't load this home">{error}</Alert>
      </>
    );

  const { property, leases, charges, repairs, reminders } = data;
  const lease = leases.find((l) => l.status === 'active') ?? null;
  const past = leases.filter((l) => l.status !== 'active');
  const address = [property.address, property.city, `${property.state} ${property.zip ?? ''}`.trim()].filter(Boolean).join(', ');

  return (
    <>
      <PageHeader back={back} eyebrow="Rental home" title={property.name} lead={address} actions={lease ? <Chip tone="live">Occupied</Chip> : <Chip tone="new">Vacant</Chip>} />
      <div className="grid gap-8">
        {lease ? <LeasePanel lease={lease} onChange={reload} /> : <NewLeasePanel propertyId={property.id} onChange={reload} />}
        {lease && <RentPanel lease={lease} charges={charges.filter((c) => c.leaseId === lease.id)} onChange={reload} />}
        <RepairsPanel propertyId={property.id} repairs={repairs} onChange={reload} />
        <RemindersPanel propertyId={property.id} reminders={reminders} onChange={reload} />
        <HomePanel property={property} onChange={reload} onDeleted={() => router.push('/admin/rentals')} />
        {past.length > 0 && (
          <section>
            <h2 className="font-display mb-3 text-xl font-semibold text-ink">Past leases</h2>
            <DataTable
              caption="Past leases"
              rows={past}
              rowKey={(l) => l.id}
              columns={[
                { header: 'Tenant', primary: true, cell: (l) => l.tenantName },
                { header: 'Rent', align: 'right', cell: (l) => formatMoney(l.monthlyRent) },
                { header: 'From', cell: (l) => <When iso={l.startDate} /> },
                { header: 'To', cell: (l) => <When iso={l.endDate} /> },
              ]}
            />
          </section>
        )}
      </div>
    </>
  );
}

function LeasePanel({ lease, onChange }: { lease: Lease; onChange: () => void }) {
  const action = useAction();
  const [link, setLink] = useState<string | null>(null);

  async function invite(mode: 'email' | 'link') {
    setLink(null);
    const result = await action.run<{ outcome: string; link: string | null }>(mode, `/api/rentals/leases/${lease.id}/invite`, { body: { mode } });
    if (!result.ok || !result.data) return;
    if (result.data.link) {
      setLink(result.data.link);
      action.setSuccess('Invite link created. Text or email it to your tenant; it works once and expires in 24 hours.');
    } else {
      action.setSuccess(`Invite emailed to ${lease.tenantEmail}.`);
    }
    onChange();
  }

  async function endLease() {
    if (!window.confirm(`End ${lease.tenantName}'s lease? They'll no longer see this home in the portal. Rent history is kept.`)) return;
    const result = await action.run('end', `/api/rentals/leases/${lease.id}`, { method: 'PATCH', body: { status: 'ended' } });
    if (result.ok) onChange();
  }

  return (
    <Panel title="Tenant and lease" actions={<Chip tone="live">Active lease</Chip>}>
      <div className="grid gap-6">
        <FormStatus error={action.error} success={action.success} />
        {link && (
          <div className="grid gap-2">
            <label htmlFor="invite-link" className="font-medium text-ink">
              Invite link
            </label>
            <input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-h-11 w-full rounded-md border border-line-input bg-subtle px-3 font-mono text-sm text-ink" />
          </div>
        )}
        <DetailList
          items={[
            { label: 'Tenant', value: lease.tenantName },
            { label: 'Email', value: lease.tenantEmail },
            { label: 'Phone', value: lease.tenantPhone ?? '—' },
            { label: 'Portal access', value: lease.tenantUserId ? 'Invited' : 'Not invited yet' },
            { label: 'Monthly rent', value: formatMoney(lease.monthlyRent) },
            { label: 'Due', value: `${ordinal(lease.dueDay)} of each month, late after ${lease.graceDays} days` },
            { label: 'Late fee', value: lease.lateFee ? formatMoney(lease.lateFee) : 'None' },
            { label: 'Security deposit', value: formatMoney(lease.securityDeposit) },
            { label: 'Lease starts', value: <When iso={lease.startDate} /> },
            { label: 'Lease ends', value: <When iso={lease.endDate} empty="Month to month" /> },
          ]}
        />
        <div className="flex flex-wrap gap-3 border-t border-line pt-6">
          <Button variant="secondary" onClick={() => invite('link')} busy={action.busy === 'link'} busyLabel="Creating…">
            {lease.tenantUserId ? 'New sign-in link' : 'Create invite link'}
          </Button>
          <Button variant="secondary" onClick={() => invite('email')} busy={action.busy === 'email'} busyLabel="Sending…">
            Email the invite
          </Button>
          <Button variant="danger" onClick={endLease} busy={action.busy === 'end'} busyLabel="Ending…">
            End lease
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function NewLeasePanel({ propertyId, onChange }: { propertyId: string; onChange: () => void }) {
  const action = useAction();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await action.run('save', `/api/rentals/properties/${propertyId}/leases`, { body: formValues(e.currentTarget) });
    if (result.ok) onChange();
  }

  return (
    <Panel title="Add the tenant and lease" description="This home is vacant. Add the lease once it's signed, then invite the tenant to the portal.">
      <form onSubmit={save} noValidate className="grid gap-5">
        <FormStatus
          error={action.error}
          fieldErrors={action.fieldErrors}
          labels={{ tenantName: 'Tenant name', tenantEmail: 'Tenant email', startDate: 'Lease starts', endDate: 'Lease ends', monthlyRent: 'Monthly rent', dueDay: 'Rent due day' }}
        />
        <FieldRow cols={3}>
          <TextField name="tenantName" label="Tenant name" required errors={action.fieldErrors} />
          <TextField name="tenantEmail" label="Tenant email" type="email" required errors={action.fieldErrors} />
          <TextField name="tenantPhone" label="Tenant phone" type="tel" errors={action.fieldErrors} />
        </FieldRow>
        <FieldRow cols={3}>
          <TextField name="monthlyRent" label="Monthly rent ($)" type="number" inputMode="decimal" min={0} step="0.01" required errors={action.fieldErrors} />
          <TextField name="dueDay" label="Rent due day" type="number" min={1} max={28} defaultValue={1} required hint="Day of the month, 1 to 28." errors={action.fieldErrors} />
          <TextField name="graceDays" label="Grace period (days)" type="number" min={0} max={31} defaultValue={9} hint="Connecticut doesn't allow a late fee until 9 days after the due date." errors={action.fieldErrors} />
        </FieldRow>
        <FieldRow cols={3}>
          <TextField name="startDate" label="Lease starts" type="date" required errors={action.fieldErrors} />
          <TextField name="endDate" label="Lease ends" type="date" hint="Leave empty for month to month." errors={action.fieldErrors} />
          <TextField name="securityDeposit" label="Security deposit ($)" type="number" inputMode="decimal" min={0} step="0.01" hint="Connecticut caps this at 2 months' rent (1 month if the tenant is 62 or older)." errors={action.fieldErrors} />
        </FieldRow>
        <FieldRow cols={3}>
          <TextField name="lateFee" label="Late fee ($)" type="number" inputMode="decimal" min={0} step="0.01" errors={action.fieldErrors} />
        </FieldRow>
        <div>
          <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving…">
            Save lease
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function RentPanel({ lease, charges, onChange }: { lease: Lease; charges: Charge[]; onChange: () => void }) {
  const action = useAction();
  const open = charges.filter((c) => c.status !== 'paid');
  const [chosen, setChosen] = useState<string>('');
  const selected = charges.find((c) => c.id === (chosen || open[open.length - 1]?.id));

  async function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const { chargeId: _ignored, ...body } = formValues(e.currentTarget);
    const result = await action.run('pay', `/api/rentals/charges/${selected.id}`, { method: 'PATCH', body }, `Payment recorded for ${monthLabel(selected.period)}.`);
    if (result.ok) {
      setChosen('');
      onChange();
    }
  }

  return (
    <Panel id="rent" title="Rent" description={`${formatMoney(lease.monthlyRent)} a month. Add each month's rent from the Rental homes page, then record payments here as they arrive.`}>
      <div className="grid gap-8">
        {charges.length === 0 ? (
          <EmptyState>No rent added yet. Use &quot;Add a month&apos;s rent&quot; on the Rental homes page.</EmptyState>
        ) : (
          <DataTable
            caption="Rent by month"
            rows={charges}
            rowKey={(c) => c.id}
            columns={[
              { header: 'Month', primary: true, cell: (c) => monthLabel(c.period) },
              { header: 'Due', cell: (c) => <When iso={c.dueDate} /> },
              { header: 'Rent', align: 'right', cell: (c) => formatMoney(c.amount) },
              { header: 'Paid', align: 'right', cell: (c) => formatMoney(c.paidAmount) },
              { header: 'Paid on', cell: (c) => (c.paidOn ? <><When iso={c.paidOn} />{c.paymentMethod ? ` · ${labelFrom(PAYMENT_METHODS, c.paymentMethod)}` : ''}</> : '—') },
              { header: 'Status', cell: (c) => <Chip tone={statusOf('rent', c.status).tone}>{statusOf('rent', c.status).label}</Chip> },
            ]}
          />
        )}
        {open.length > 0 && selected && (
          <form key={selected.id + selected.paidAmount} onSubmit={record} noValidate className="grid gap-5 border-t border-line pt-6">
            <h3 className="font-display text-lg font-semibold text-ink">Record a payment</h3>
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ paidAmount: 'Total paid', paidOn: 'Paid on' }} />
            <FieldRow>
              <SelectField
                name="chargeId"
                label="Month"
                required
                value={selected.id}
                onChange={(e) => setChosen(e.target.value)}
                options={open.map((c) => ({ value: c.id, label: `${monthLabel(c.period)}: ${formatMoney(Number(c.amount) - Number(c.paidAmount))} still owed` }))}
              />
              <TextField
                name="paidAmount"
                label="Total paid for this month ($)"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required
                defaultValue={selected.amount}
                hint="The full amount received so far, not just this payment."
                errors={action.fieldErrors}
              />
            </FieldRow>
            <FieldRow cols={3}>
              <TextField name="paidOn" label="Paid on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} errors={action.fieldErrors} />
              <SelectField name="paymentMethod" label="How they paid" placeholder="Choose one" options={PAYMENT_METHODS} errors={action.fieldErrors} />
              <TextField name="note" label="Note" errors={action.fieldErrors} />
            </FieldRow>
            <div>
              <Button type="submit" busy={action.busy === 'pay'} busyLabel="Saving…">
                Record payment
              </Button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

function RepairsPanel({ propertyId, repairs, onChange }: { propertyId: string; repairs: Repair[]; onChange: () => void }) {
  const action = useAction();

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('add', `/api/rentals/properties/${propertyId}/repairs`, { body: formValues(form) }, 'Repair added.');
    if (result.ok) {
      form.reset();
      onChange();
    }
  }

  return (
    <Panel id="repairs" title="Repairs" description="Tenants report repairs from their portal and you're notified. Set a visit time and they're told automatically.">
      <div className="grid gap-6">
        {repairs.length === 0 ? (
          <EmptyState>No repairs yet.</EmptyState>
        ) : (
          <ul className="grid gap-4">
            {repairs.map((r) => (
              <RepairItem key={r.id + r.status + (r.appointmentAt ?? '')} repair={r} onChange={onChange} />
            ))}
          </ul>
        )}
        <details className="rounded-lg border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-navy-700">Log a repair yourself</summary>
          <form onSubmit={add} noValidate className="grid gap-5 border-t border-line p-4">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ title: 'What needs fixing' }} />
            <FieldRow>
              <TextField name="title" label="What needs fixing" required maxLength={200} errors={action.fieldErrors} id="f-new-repair-title" />
              <SelectField name="urgency" label="Urgency" options={REPAIR_URGENCIES} defaultValue="normal" errors={action.fieldErrors} id="f-new-repair-urgency" />
            </FieldRow>
            <TextAreaField name="description" label="Details" rows={3} errors={action.fieldErrors} id="f-new-repair-description" />
            <div>
              <Button type="submit" busy={action.busy === 'add'} busyLabel="Adding…">
                Add repair
              </Button>
            </div>
          </form>
        </details>
      </div>
    </Panel>
  );
}

function RepairItem({ repair: r, onChange }: { repair: Repair; onChange: () => void }) {
  const action = useAction();
  const status = statusOf('repair', r.status);
  const urgency = statusOf('repairUrgency', r.urgency);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const visit = String(fd.get('appointmentAt') ?? '');
    const body = {
      status: String(fd.get('status')),
      appointmentAt: visit ? new Date(visit).toISOString() : '',
      vendorName: String(fd.get('vendorName') ?? ''),
      vendorPhone: String(fd.get('vendorPhone') ?? ''),
      cost: String(fd.get('cost') ?? ''),
      notes: String(fd.get('notes') ?? ''),
    };
    const result = await action.run('save', `/api/rentals/repairs/${r.id}`, { method: 'PATCH', body }, 'Repair updated.');
    if (result.ok) onChange();
  }

  const fid = (name: string) => `f-${name}-${r.id}`;
  return (
    <li className="rounded-lg border border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{r.title}</p>
          <p className="mt-1 text-sm text-muted">
            Reported <When iso={r.createdAt} />
            {r.appointmentAt && (
              <>
                {' · '}Visit <When iso={r.appointmentAt} withTime />
              </>
            )}
            {r.vendorName && ` · ${r.vendorName}`}
          </p>
          {r.description && <p className="mt-2 whitespace-pre-line text-ink-2">{r.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {r.urgency !== 'normal' && <Chip tone={urgency.tone}>{urgency.label}</Chip>}
          <Chip tone={status.tone}>{status.label}</Chip>
        </div>
      </div>
      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-navy-700">Schedule or update</summary>
        <form onSubmit={save} noValidate className="mt-3 grid gap-5">
          <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} />
          <FieldRow>
            <SelectField name="status" label="Status" options={REPAIR_STATUSES} defaultValue={r.status} id={fid('status')} />
            <div className="grid gap-1.5">
              <label htmlFor={fid('appointmentAt')} className="font-medium text-ink">
                Visit date and time
              </label>
              <input id={fid('appointmentAt')} name="appointmentAt" type="datetime-local" defaultValue={toLocalInput(r.appointmentAt)} className="min-h-11 rounded-md border border-line-input bg-white px-3 text-ink focus:border-teal-600" />
            </div>
          </FieldRow>
          <FieldRow cols={3}>
            <TextField name="vendorName" label="Who's fixing it" defaultValue={r.vendorName} id={fid('vendorName')} />
            <TextField name="vendorPhone" label="Their phone" type="tel" defaultValue={r.vendorPhone} id={fid('vendorPhone')} />
            <TextField name="cost" label="Cost ($)" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={r.cost} id={fid('cost')} errors={action.fieldErrors} />
          </FieldRow>
          <TextAreaField name="notes" label="Private notes" rows={2} defaultValue={r.notes} hint="Only you see these." id={fid('notes')} />
          <div>
            <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving…">
              Save repair
            </Button>
          </div>
        </form>
      </details>
    </li>
  );
}

function RemindersPanel({ propertyId, reminders, onChange }: { propertyId: string; reminders: Reminder[]; onChange: () => void }) {
  const action = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const active = reminders.filter((r) => !r.doneAt);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await action.run('add', `/api/rentals/properties/${propertyId}/reminders`, { body: formValues(form) }, 'Reminder added.');
    if (result.ok) {
      form.reset();
      onChange();
    }
  }

  async function act(r: Reminder, kind: 'done' | 'delete') {
    if (kind === 'delete' && !window.confirm(`Delete "${r.title}"?`)) return;
    setBusyId(r.id + kind);
    setRowError(null);
    const result = kind === 'done' ? await api(`/api/rentals/reminders/${r.id}/done`, { method: 'POST' }) : await api(`/api/rentals/reminders/${r.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!result.ok) setRowError(result.message);
    else onChange();
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <Panel id="reminders" title="Insurance, HOA and bills" description="Renewals and dues for this home. Repeating ones roll to the next date when you mark them paid.">
      <div className="grid gap-6">
        {rowError && <Alert>{rowError}</Alert>}
        {active.length === 0 ? (
          <EmptyState>No reminders yet. Add your landlord insurance renewal and HOA dues below.</EmptyState>
        ) : (
          <DataTable
            caption="Reminders"
            rows={active}
            rowKey={(r) => r.id}
            columns={[
              {
                header: 'Reminder',
                primary: true,
                cell: (r) => (
                  <span>
                    {r.title}
                    {(r.provider || r.reference) && <span className="block text-sm font-normal text-muted">{[r.provider, r.reference].filter(Boolean).join(' · ')}</span>}
                  </span>
                ),
              },
              { header: 'Type', cell: (r) => labelFrom(REMINDER_KINDS, r.kind) },
              { header: 'Amount', align: 'right', cell: (r) => formatMoney(r.amount) },
              { header: 'Due', cell: (r) => (r.dueDate < today ? <Chip tone="danger">Overdue <When iso={r.dueDate} /></Chip> : <When iso={r.dueDate} />) },
              { header: 'Repeats', cell: (r) => labelFrom(REMINDER_REPEATS, r.repeat) },
              {
                header: 'Actions',
                align: 'right',
                cell: (r) => (
                  <span className="inline-flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => act(r, 'done')} busy={busyId === r.id + 'done'} busyLabel="Saving…">
                      {r.repeat === 'none' ? 'Mark done' : 'Mark paid'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act(r, 'delete')} busy={busyId === r.id + 'delete'} busyLabel="Deleting…">
                      Delete
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        )}
        <details className="rounded-lg border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-navy-700">Add a reminder</summary>
          <form onSubmit={add} noValidate className="grid gap-5 border-t border-line p-4">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ kind: 'Type', title: 'Title', dueDate: 'Due date' }} />
            <FieldRow>
              <SelectField name="kind" label="Type" required placeholder="Choose a type" options={REMINDER_KINDS} errors={action.fieldErrors} />
              <TextField name="title" label="Title" required hint='Like "Landlord insurance renewal".' errors={action.fieldErrors} id="f-reminder-title" />
            </FieldRow>
            <FieldRow cols={3}>
              <TextField name="dueDate" label="Due date" type="date" required errors={action.fieldErrors} />
              <SelectField name="repeat" label="Repeats" options={REMINDER_REPEATS} defaultValue="none" errors={action.fieldErrors} />
              <TextField name="amount" label="Amount ($)" type="number" inputMode="decimal" min={0} step="0.01" errors={action.fieldErrors} id="f-reminder-amount" />
            </FieldRow>
            <FieldRow>
              <TextField name="provider" label="Company" hint="Insurer, HOA or town." errors={action.fieldErrors} />
              <TextField name="reference" label="Policy or account number" errors={action.fieldErrors} />
            </FieldRow>
            <div>
              <Button type="submit" busy={action.busy === 'add'} busyLabel="Adding…">
                Add reminder
              </Button>
            </div>
          </form>
        </details>
      </div>
    </Panel>
  );
}

function HomePanel({ property, onChange, onDeleted }: { property: Property; onChange: () => void; onDeleted: () => void }) {
  const action = useAction();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Send empty values too, so clearing a field sticks.
    const body = Object.fromEntries(['name', 'address', 'city', 'state', 'hoaName', 'hoaContact', 'notes'].map((k) => [k, String(fd.get(k) ?? '').trim()]));
    const zip = String(fd.get('zip') ?? '').trim();
    const result = await action.run('save', `/api/rentals/properties/${property.id}`, { method: 'PATCH', body: zip ? { ...body, zip } : body }, 'Home details saved.');
    if (result.ok) onChange();
  }

  async function remove() {
    if (!window.confirm(`Delete ${property.name}? This also deletes its leases, rent history, repairs and reminders, and can't be undone.`)) return;
    const result = await action.run('delete', `/api/rentals/properties/${property.id}`, { method: 'DELETE' });
    if (result.ok) onDeleted();
  }

  return (
    <Panel title="Home details and HOA">
      <form onSubmit={save} noValidate className="grid gap-5">
        <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={{ name: 'Name', address: 'Street address', zip: 'ZIP code' }} />
        <FieldRow>
          <TextField name="name" label="Name" required defaultValue={property.name} errors={action.fieldErrors} id="f-home-name" />
          <TextField name="address" label="Street address" required defaultValue={property.address} errors={action.fieldErrors} id="f-home-address" />
        </FieldRow>
        <FieldRow cols={3}>
          <TextField name="city" label="City" defaultValue={property.city} errors={action.fieldErrors} id="f-home-city" />
          <TextField name="state" label="State" defaultValue={property.state} maxLength={2} errors={action.fieldErrors} id="f-home-state" />
          <TextField name="zip" label="ZIP code" defaultValue={property.zip} errors={action.fieldErrors} id="f-home-zip" />
        </FieldRow>
        <FieldRow>
          <TextField name="hoaName" label="HOA name" defaultValue={property.hoaName} errors={action.fieldErrors} id="f-home-hoaName" />
          <TextAreaField name="hoaContact" label="HOA contact" rows={2} defaultValue={property.hoaContact} errors={action.fieldErrors} id="f-home-hoaContact" />
        </FieldRow>
        <TextAreaField name="notes" label="Notes" rows={3} defaultValue={property.notes} hint="Appliances, paint colors, alarm codes, anything worth keeping." errors={action.fieldErrors} id="f-home-notes" />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving…">
            Save details
          </Button>
          <Button variant="danger" onClick={remove} busy={action.busy === 'delete'} busyLabel="Deleting…">
            Delete home
          </Button>
        </div>
      </form>
    </Panel>
  );
}
