import { beforeEach, describe, expect, it } from 'vitest';
import { requireActiveUser, requireAdmin } from '@/lib/auth/requireAdmin';
import { resetDb, seedProfile } from './db';
import { setCurrentUser } from './mockAuth';

describe('requireAdmin / requireActiveUser', () => {
  beforeEach(async () => {
    await resetDb();
    setCurrentUser(null);
  });

  it('rejects an unauthenticated caller', async () => {
    const gate = await requireAdmin();
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.status).toBe(401);
  });

  it('rejects a signed-in employee from an admin-only route', async () => {
    const employee = await seedProfile({ role: 'employee' });
    setCurrentUser(employee.id);

    const gate = await requireAdmin();
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.status).toBe(403);
  });

  it('rejects a deactivated admin', async () => {
    const admin = await seedProfile({ role: 'admin', isActive: false });
    setCurrentUser(admin.id);

    const gate = await requireAdmin();
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.status).toBe(403);
  });

  it('allows an active admin', async () => {
    const admin = await seedProfile({ role: 'admin' });
    setCurrentUser(admin.id);

    const gate = await requireAdmin();
    expect(gate.ok).toBe(true);
  });

  it('requireActiveUser allows any active role, blocks deactivated', async () => {
    const employee = await seedProfile({ role: 'employee' });
    setCurrentUser(employee.id);
    expect((await requireActiveUser()).ok).toBe(true);

    const deactivated = await seedProfile({ role: 'employee', isActive: false });
    setCurrentUser(deactivated.id);
    expect((await requireActiveUser()).ok).toBe(false);
  });
});
