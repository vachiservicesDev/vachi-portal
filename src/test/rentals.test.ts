import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { notifications, profiles, rentalLeases } from '@/db/schema';
import { GET as listHomes, POST as createHome } from '@/app/api/rentals/properties/route';
import { DELETE as deleteHome, GET as getHome, PATCH as updateHome } from '@/app/api/rentals/properties/[id]/route';
import { POST as createLease } from '@/app/api/rentals/properties/[id]/leases/route';
import { PATCH as updateLease } from '@/app/api/rentals/leases/[id]/route';
import { POST as inviteTenantRoute } from '@/app/api/rentals/leases/[id]/invite/route';
import { POST as generateRent } from '@/app/api/rentals/charges/generate/route';
import { PATCH as recordPayment } from '@/app/api/rentals/charges/[id]/route';
import { PATCH as updateRepair } from '@/app/api/rentals/repairs/[id]/route';
import { POST as createReminder } from '@/app/api/rentals/properties/[id]/reminders/route';
import { POST as reminderDone } from '@/app/api/rentals/reminders/[id]/done/route';
import { GET as overview } from '@/app/api/rentals/overview/route';
import { GET as myRental } from '@/app/api/rentals/me/route';
import { POST as reportRepair } from '@/app/api/rentals/me/repairs/route';
import { GET as threads } from '@/app/api/messages/threads/route';
import { chargeStatus, dueDateFor, leaseCoversPeriod, nextReminderDate } from '@/lib/rentals/rent';
import { tenantMayOpen } from '@/lib/auth/tenant-pages';
import { eq } from 'drizzle-orm';
import { resetDb, seedProfile } from './db';
import { getRequest, jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

const authAdmin = { generateLink: vi.fn() };
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: authAdmin } }) }));

const params = (id: string) => ({ params: { id } });
const patch = (body: unknown) => new NextRequest('http://localhost/test', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function json<T = any>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe('rent math', () => {
  it('clamps the due day to short months and computes status through the grace period', () => {
    expect(dueDateFor('2026-02-01', 31)).toBe('2026-02-28');
    expect(dueDateFor('2026-11-01', 1)).toBe('2026-11-01');
    const c = { amount: '2400', paidAmount: '0', dueDate: '2026-11-01' };
    expect(chargeStatus(c, 9, '2026-10-30')).toBe('upcoming');
    expect(chargeStatus(c, 9, '2026-11-01')).toBe('due');
    expect(chargeStatus(c, 9, '2026-11-10')).toBe('due'); // 9 grace days: late from the 11th
    expect(chargeStatus(c, 9, '2026-11-11')).toBe('late');
    expect(chargeStatus({ ...c, paidAmount: '1000' }, 9, '2026-11-05')).toBe('partial');
    expect(chargeStatus({ ...c, paidAmount: '1000' }, 9, '2026-11-20')).toBe('late');
    expect(chargeStatus({ ...c, paidAmount: '2400' }, 9, '2026-12-20')).toBe('paid');
  });

  it('knows which months a lease covers and rolls repeating reminders forward', () => {
    expect(leaseCoversPeriod({ startDate: '2026-11-15', endDate: null }, '2026-11-01')).toBe(true);
    expect(leaseCoversPeriod({ startDate: '2026-12-01', endDate: null }, '2026-11-01')).toBe(false);
    expect(leaseCoversPeriod({ startDate: '2025-01-01', endDate: '2026-10-31' }, '2026-11-01')).toBe(false);
    expect(nextReminderDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextReminderDate('2026-03-15', 'yearly')).toBe('2027-03-15');
    expect(nextReminderDate('2026-03-15', 'none')).toBeNull();
  });

  it('keeps tenants to their own pages', () => {
    expect(tenantMayOpen('/rental')).toBe(true);
    expect(tenantMayOpen('/messages/abc')).toBe(true);
    expect(tenantMayOpen('/timesheets')).toBe(false);
    expect(tenantMayOpen('/admin/rentals')).toBe(false);
    expect(tenantMayOpen('/rentals-elsewhere')).toBe(false);
  });
});

describe('Rentals', () => {
  let landlordId: string;

  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
    landlordId = (await seedProfile({ role: 'admin' })).id;
    setCurrentUser(landlordId);
  });

  async function homeWithLease(lease: Record<string, unknown> = {}) {
    const home = (await json(await createHome(jsonRequest({ name: 'Unit 12', address: '12 Wooster Heights Rd', city: 'Danbury', zip: '06810' })))).property;
    const res = await createLease(
      jsonRequest({ tenantName: 'Jamie Lee', tenantEmail: 'Jamie@Example.com', startDate: '2026-01-01', monthlyRent: '2400', dueDay: 1, lateFee: '50', securityDeposit: '4800', ...lease }),
      params(home.id),
    );
    expect(res.status).toBe(201);
    return { home, lease: (await json(res)).lease };
  }

  it('a landlord only ever sees their own homes', async () => {
    const { home } = await homeWithLease();
    const other = await seedProfile({ role: 'admin' });
    setCurrentUser(other.id);

    expect((await json(await listHomes())).properties).toHaveLength(0);
    expect((await getHome(getRequest(), params(home.id))).status).toBe(404);
    expect((await updateHome(patch({ name: 'Mine now' }), params(home.id))).status).toBe(404);
    expect((await deleteHome(getRequest(), params(home.id))).status).toBe(404);
    expect((await createLease(jsonRequest({}), params(home.id))).status).toBe(404);
  });

  it('employees and tenants cannot use the landlord routes', async () => {
    const employee = await seedProfile({ role: 'employee' });
    setCurrentUser(employee.id);
    expect((await listHomes()).status).toBe(403);
    expect((await createHome(jsonRequest({ name: 'x', address: 'y' }))).status).toBe(403);
  });

  it('lists a home with its tenant, and allows only one active lease', async () => {
    const { home } = await homeWithLease();
    const [row] = (await json(await listHomes())).properties;
    expect(row.tenantName).toBe('Jamie Lee');
    expect(row.monthlyRent).toBe('2400.00');

    const second = await createLease(jsonRequest({ tenantName: 'B', tenantEmail: 'b@example.com', startDate: '2026-06-01', monthlyRent: 2000 }), params(home.id));
    expect(second.status).toBe(409);
  });

  it('adds a month of rent once per lease, and records payments', async () => {
    const { home, lease } = await homeWithLease({ dueDay: 5 });
    // A lease that starts after the month isn't charged for it.
    const later = (await json(await createHome(jsonRequest({ name: 'Unit 14', address: '14 Wooster Heights Rd' })))).property;
    await createLease(jsonRequest({ tenantName: 'Sam', tenantEmail: 'sam@example.com', startDate: '2027-01-01', monthlyRent: 2100 }), params(later.id));

    const first = await json(await generateRent(jsonRequest({ month: '2026-11' })));
    expect(first).toEqual({ created: 1, skipped: 0 });
    const again = await json(await generateRent(jsonRequest({ month: '2026-11' })));
    expect(again).toEqual({ created: 0, skipped: 1 });

    const detail = await json(await getHome(getRequest(), params(home.id)));
    expect(detail.charges).toHaveLength(1);
    const charge = detail.charges[0];
    expect(charge.dueDate).toBe('2026-11-05');
    expect(charge.amount).toBe('2400.00');

    const paid = await recordPayment(patch({ paidAmount: 2400, paidOn: '2026-11-03', paymentMethod: 'zelle' }), params(charge.id));
    expect(paid.status).toBe(200);
    const after = await json(await getHome(getRequest(), params(home.id)));
    expect(after.charges[0].status).toBe('paid');
    expect(after.charges[0].paymentMethod).toBe('zelle');
    expect(lease.id).toBeTruthy();
  });

  it('another landlord cannot record a payment on my charge', async () => {
    const { home } = await homeWithLease();
    await generateRent(jsonRequest({ month: '2026-11' }));
    const charge = (await json(await getHome(getRequest(), params(home.id)))).charges[0];
    setCurrentUser((await seedProfile({ role: 'admin' })).id);
    expect((await recordPayment(patch({ paidAmount: 1 }), params(charge.id))).status).toBe(404);
  });

  it('shows past-due rent in the overview as behind', async () => {
    await homeWithLease();
    await generateRent(jsonRequest({ month: '2026-01' }));
    const o = await json(await overview());
    expect(o.homes).toBe(1);
    expect(o.occupied).toBe(1);
    expect(o.behind).toHaveLength(1);
    expect(o.behind[0]).toMatchObject({ tenantName: 'Jamie Lee', owed: '2400.00' });
  });

  it('invites the tenant with a tenant login and links it to the lease', async () => {
    const { lease } = await homeWithLease();
    const tenantId = '0b4f7f5e-1c51-4bb1-9f0e-2a4d8b7f7c22';
    authAdmin.generateLink.mockResolvedValueOnce({ data: { user: { id: tenantId }, properties: { hashed_token: 'tok' } }, error: null });

    const res = await inviteTenantRoute(jsonRequest({ mode: 'link' }), params(lease.id));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.outcome).toBe('link');
    expect(body.link).toContain('token_hash=tok');
    expect(authAdmin.generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'invite', email: 'jamie@example.com' }));

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, tenantId));
    expect(profile.role).toBe('tenant');
    const [linked] = await db.select().from(rentalLeases).where(eq(rentalLeases.id, lease.id));
    expect(linked.tenantUserId).toBe(tenantId);
  });

  describe('as the tenant', () => {
    let tenantId: string;
    let homeId: string;

    beforeEach(async () => {
      const { home, lease } = await homeWithLease();
      homeId = home.id;
      tenantId = (await seedProfile({ role: 'tenant', email: 'jamie@example.com' })).id;
      await db.update(rentalLeases).set({ tenantUserId: tenantId }).where(eq(rentalLeases.id, lease.id));
      await generateRent(jsonRequest({ month: '2026-11' }));
      await createReminder(jsonRequest({ kind: 'insurance', title: 'Landlord policy', dueDate: '2026-11-20', repeat: 'yearly', amount: 1200 }), params(home.id));
      setCurrentUser(tenantId);
    });

    it('sees their rent and lease, but no landlord-only data', async () => {
      const { rental } = await json(await myRental());
      expect(rental.home.name).toBe('Unit 12');
      expect(rental.lease.monthlyRent).toBe('2400.00');
      expect(rental.charges).toHaveLength(1);
      expect(rental.landlordId).toBe(landlordId);
      expect(JSON.stringify(rental)).not.toContain('Landlord policy');
      expect(rental.lease).not.toHaveProperty('tenantEmail');
      // And the landlord routes are closed to them.
      expect((await getHome(getRequest(), params(homeId))).status).toBe(403);
    });

    it('reports a repair, the landlord schedules it, and the tenant is told', async () => {
      const res = await reportRepair(jsonRequest({ title: 'Kitchen sink leaking', urgency: 'urgent' }));
      expect(res.status).toBe(201);
      const { repair } = await json(res);

      const landlordNotes = await db.select().from(notifications).where(eq(notifications.userId, landlordId));
      expect(landlordNotes).toHaveLength(1);
      expect(landlordNotes[0].title).toBe('Urgent repair reported');
      expect(landlordNotes[0].priority).toBe('high');

      setCurrentUser(landlordId);
      const scheduled = await updateRepair(patch({ appointmentAt: '2026-11-04T14:00:00.000Z', vendorName: 'Danbury Plumbing', cost: 180, notes: 'Owner pays' }), params(repair.id));
      expect(scheduled.status).toBe(200);
      expect((await json(scheduled)).repair.status).toBe('scheduled');
      await updateRepair(patch({ status: 'done' }), params(repair.id));

      const tenantNotes = await db.select().from(notifications).where(eq(notifications.userId, tenantId));
      expect(tenantNotes.map((n) => n.title).sort()).toEqual(['Repair marked done', 'Repair visit scheduled']);

      setCurrentUser(tenantId);
      const { rental } = await json(await myRental());
      expect(rental.repairs[0]).toMatchObject({ title: 'Kitchen sink leaking', status: 'done', vendorName: 'Danbury Plumbing' });
      // Cost and private notes stay with the landlord.
      expect(rental.repairs[0]).not.toHaveProperty('cost');
      expect(rental.repairs[0]).not.toHaveProperty('notes');
    });

    it('can message only their landlord', async () => {
      await seedProfile({ role: 'admin' }); // HR, not this tenant's landlord
      const { partners } = await json(await threads());
      expect(partners.map((p: { id: string }) => p.id)).toEqual([landlordId]);
    });

    it('loses access once the lease ends', async () => {
      setCurrentUser(landlordId);
      const leaseId = (await json(await getHome(getRequest(), params(homeId)))).leases[0].id;
      await updateLease(patch({ status: 'ended' }), params(leaseId));
      setCurrentUser(tenantId);
      expect((await json(await myRental())).rental).toBeNull();
      expect((await reportRepair(jsonRequest({ title: 'x' }))).status).toBe(403);
    });
  });

  it('a yearly reminder rolls to next year when marked paid', async () => {
    const { home } = await homeWithLease();
    const { reminder } = await json(await createReminder(jsonRequest({ kind: 'hoa', title: 'HOA dues', dueDate: '2026-11-01', repeat: 'yearly' }), params(home.id)));
    const res = await reminderDone(getRequest(), params(reminder.id));
    expect((await json(res)).reminder.dueDate).toBe('2027-11-01');
  });
});
