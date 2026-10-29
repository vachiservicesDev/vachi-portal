import { randomInt } from 'node:crypto';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { employees, profiles } from '@/db/schema';
import { confirmUrl, resetEmail, sendPortalMail, smtpConfigured, welcomeEmail } from '@/lib/email/portal-mail';
import { createAdminClient } from '@/lib/supabase/admin';

type Employee = typeof employees.$inferSelect;

export type PasswordResult =
  | { ok: true; outcome: 'password-set'; password: string; userId: string }
  | { ok: false; status: number; message: string };

export type InviteResult =
  | { ok: true; outcome: 'emailed' | 'link' | 'existing-account'; link?: string; userId: string }
  | { ok: false; status: number; message: string };

/**
 * Gives an employee a portal login.
 *
 * - "email" sends a welcome email (or, once they have a login, a password-reset email) from the
 *   portal's own SMTP account, the company Gmail, rather than Supabase's mailer.
 * - "link" returns the same one-time link for HR to share another way; nothing is emailed.
 *
 * Links go straight to this app's /auth/confirm with a token hash, so they work whatever
 * Supabase's Site URL is set to.
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
  if (mode === 'email' && !smtpConfigured()) {
    return { ok: false, status: 503, message: "The portal's email account isn't set up yet. Use \"Create invite link instead\" and send the link yourself." };
  }
  const email = employee.email.toLowerCase();
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
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: loginEmail });
    if (error) return { ok: false, status: 502, message: `Supabase couldn't create a sign-in link: ${error.message}` };
    const link = confirmUrl(appUrl, data.properties.hashed_token, 'recovery');
    if (mode === 'email') {
      const sent = await send(loginEmail, resetEmail(employee.firstName, link));
      if (!sent.ok) return sent;
      return { ok: true, outcome: 'emailed', userId: employee.userId };
    }
    return { ok: true, outcome: 'link', link, userId: employee.userId };
  }

  const invited = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: meta } });
  if (invited.error && !/already been registered|already registered|exists/i.test(invited.error.message)) {
    return { ok: false, status: 502, message: `Supabase couldn't create the invite: ${invited.error.message}` };
  }

  if (!invited.error && invited.data.user) {
    const link = confirmUrl(appUrl, invited.data.properties.hashed_token, 'invite');
    if (mode === 'email') {
      const sent = await send(email, welcomeEmail(employee.firstName, link));
      if (!sent.ok) return sent;
    }
    await linkEmployeeToUser(employee.id, invited.data.user.id, email);
    return { ok: true, outcome: mode === 'email' ? 'emailed' : 'link', link: mode === 'link' ? link : undefined, userId: invited.data.user.id };
  }

  // The address already has a login. Look it up (generating a link sends nothing), then link it.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data.user) return { ok: false, status: 502, message: `Supabase couldn't find the existing login: ${error?.message ?? 'no user'}` };
  await linkEmployeeToUser(employee.id, data.user.id, email);
  if (mode === 'link') return { ok: true, outcome: 'link', link: confirmUrl(appUrl, data.properties.hashed_token, 'recovery'), userId: data.user.id };
  return { ok: true, outcome: 'existing-account', userId: data.user.id };
}

async function send(to: string, mail: Parameters<typeof sendPortalMail>[1]): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    await sendPortalMail(to, mail);
    return { ok: true };
  } catch (err) {
    console.error('[invite] email failed', err);
    return { ok: false, status: 502, message: "The email couldn't be sent. Try again, or use \"Create invite link instead\"." };
  }
}

// No 0/O or 1/l/I, so a password read off a screen or over the phone is typed right the first time.
const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random starting password like "Kq7m-x2Pa-9vRt". */
export function generatePassword(): string {
  const group = () => Array.from({ length: 4 }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

/**
 * Gives an employee a login with a starting password that HR shares with them, instead of an
 * emailed link. The login is marked must_change_password, so their first sign-in sends them to
 * choose their own; they can also use "Forgot your password?" any time after.
 *
 * Only for employee logins: an admin's password is never set from here, so one admin can't take
 * over another's account.
 */
export async function setStartingPassword(employee: Employee, password: string | undefined): Promise<PasswordResult> {
  if (employee.status === 'inactive') {
    return { ok: false, status: 409, message: 'This employee is inactive. Set them to active before giving them a login.' };
  }
  const email = employee.email.toLowerCase();
  const chosen = password ?? generatePassword();
  const admin = createAdminClient();
  const meta = { first_name: employee.firstName, last_name: employee.lastName, must_change_password: true };

  if (employee.userId) {
    const [profile] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, employee.userId)).limit(1);
    if (profile?.role === 'admin') {
      return { ok: false, status: 403, message: "Admins set their own password. Send them a password reset instead." };
    }
    const { error } = await admin.auth.admin.updateUserById(employee.userId, { password: chosen, user_metadata: meta });
    if (error) return { ok: false, status: 502, message: `Supabase couldn't set the password: ${error.message}` };
    return { ok: true, outcome: 'password-set', password: chosen, userId: employee.userId };
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password: chosen, email_confirm: true, user_metadata: meta });
  if (error || !data.user) {
    if (error && /already been registered|already registered|exists/i.test(error.message)) {
      return { ok: false, status: 409, message: 'This email already has a login. Use "Email an invite" to link it, then they sign in with their existing password.' };
    }
    return { ok: false, status: 502, message: `Supabase couldn't create the login: ${error?.message ?? 'no user'}` };
  }
  await linkEmployeeToUser(employee.id, data.user.id, email);
  return { ok: true, outcome: 'password-set', password: chosen, userId: data.user.id };
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
