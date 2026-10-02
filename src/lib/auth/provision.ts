import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { employees, profiles } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';

type Employee = typeof employees.$inferSelect;

export type InviteResult =
  | { ok: true; outcome: 'emailed' | 'link' | 'existing-account'; link?: string; userId: string }
  | { ok: false; status: number; message: string };

/**
 * Gives an employee a portal login.
 *
 * - "email" asks Supabase to email an invite (needs SMTP set up in Supabase for real addresses).
 * - "link" returns the same one-time link for HR to share another way; nothing is emailed.
 *
 * If the address already has a Supabase login (for example a website admin), that login is
 * linked instead and they keep their existing password. A profile row is always created here
 * too, so linking works even where the database trigger in supabase/auth-profile-link.sql is
 * missing.
 */
export async function inviteEmployee(employee: Employee, mode: 'email' | 'link', appUrl: string): Promise<InviteResult> {
  if (employee.status === 'inactive') {
    return { ok: false, status: 409, message: 'This employee is inactive. Set them to active before inviting them.' };
  }
  const email = employee.email.toLowerCase();
  const redirectTo = `${appUrl.replace(/\/+$/, '')}/auth/confirm?next=/set-password`;
  const admin = createAdminClient();
  const meta = { first_name: employee.firstName, last_name: employee.lastName };

  // Already linked: send (or hand back) a password-reset link instead, to the login's current
  // email. It may have been changed in Supabase since, so bring the local records up to date.
  if (employee.userId) {
    const { data: found, error: lookupError } = await admin.auth.admin.getUserById(employee.userId);
    if (lookupError || !found.user) {
      return { ok: false, status: 502, message: `Supabase couldn't find this employee's login: ${lookupError?.message ?? 'no user'}` };
    }
    const loginEmail = (found.user.email ?? email).toLowerCase();
    if (loginEmail !== email) await syncLoginEmail(employee.id, employee.userId, loginEmail);
    if (mode === 'email') {
      const { error } = await admin.auth.resetPasswordForEmail(loginEmail, { redirectTo });
      if (error) return { ok: false, status: 502, message: `Supabase couldn't send the email: ${error.message}` };
      return { ok: true, outcome: 'emailed', userId: employee.userId };
    }
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: loginEmail, options: { redirectTo } });
    if (error) return { ok: false, status: 502, message: `Supabase couldn't create a sign-in link: ${error.message}` };
    return { ok: true, outcome: 'link', link: data.properties.action_link, userId: employee.userId };
  }

  let userId: string | undefined;
  let link: string | undefined;
  let outcome: 'emailed' | 'link' | 'existing-account' = mode === 'email' ? 'emailed' : 'link';

  if (mode === 'email') {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: meta });
    if (error && !/already been registered|already registered|exists/i.test(error.message)) {
      return { ok: false, status: 502, message: `Supabase couldn't send the invite: ${error.message}` };
    }
    userId = data?.user?.id;
  } else {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo, data: meta } });
    if (error && !/already been registered|already registered|exists/i.test(error.message)) {
      return { ok: false, status: 502, message: `Supabase couldn't create the invite link: ${error.message}` };
    }
    userId = data?.user?.id;
    link = data?.properties?.action_link;
  }

  if (!userId) {
    // The address already has a login. Look it up without sending anything, then link it.
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
    if (error || !data.user) return { ok: false, status: 502, message: `Supabase couldn't find the existing login: ${error?.message ?? 'no user'}` };
    userId = data.user.id;
    outcome = mode === 'link' ? 'link' : 'existing-account';
    link = mode === 'link' ? data.properties.action_link : undefined;
  }

  await linkEmployeeToUser(employee.id, userId, email);
  return { ok: true, outcome, link, userId };
}

/** Creates the portal profile (never downgrading an existing admin) and links the employee record. */
export async function linkEmployeeToUser(employeeId: string, userId: string, email: string) {
  await db.insert(profiles).values({ id: userId, email: email.toLowerCase(), role: 'employee', isActive: true }).onConflictDoNothing();
  await db
    .update(employees)
    .set({ userId, updatedAt: new Date() })
    .where(and(eq(employees.id, employeeId), isNull(employees.userId)));
}

/**
 * Copies a login email changed in Supabase onto the employee record and profile. Skips the
 * employee record if another employee already uses that address, so the unique index holds.
 */
export async function syncLoginEmail(employeeId: string, userId: string, loginEmail: string) {
  const [clash] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(sql`lower(${employees.email}) = ${loginEmail}`, ne(employees.id, employeeId)))
    .limit(1);
  if (!clash) await db.update(employees).set({ email: loginEmail, updatedAt: new Date() }).where(eq(employees.id, employeeId));
  await db.update(profiles).set({ email: loginEmail }).where(eq(profiles.id, userId));
}
