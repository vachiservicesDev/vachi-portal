import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { employees, profiles } from '@/db/schema';
import { sql } from 'drizzle-orm';

const APP_TABLES = [
  'messages',
  'notifications',
  'audit_logs',
  'green_card_cases',
  'h1b_public_access_files',
  'stem_opt_training_plans',
  'pay_stubs',
  'pay_runs',
  'timesheet_entries',
  'timesheets',
  'performance_reviews',
  'weekly_training_summaries',
  'training_comments',
  'training_assignments',
  'training_tasks',
  'i9_records',
  'onboarding_documents',
  'onboarding_sessions',
  'documents',
  'employees',
  'profiles',
];

/** Wipes every app table between tests. Guarded by setup.ts's DATABASE_URL check. */
export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${APP_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`));
}

interface SeedUserOptions {
  role?: 'admin' | 'employee';
  isActive?: boolean;
  email?: string;
}

/** Creates a profiles row standing in for a Supabase Auth user (no real auth.users locally). */
export async function seedProfile(opts: SeedUserOptions = {}) {
  const id = randomUUID();
  const [profile] = await db
    .insert(profiles)
    .values({
      id,
      email: opts.email ?? `${id}@test.local`,
      role: opts.role ?? 'employee',
      isActive: opts.isActive ?? true,
    })
    .returning();
  return profile;
}

interface SeedEmployeeOptions {
  linkToProfile?: boolean;
  visaType?: 'OPT' | 'STEM_OPT' | 'H1B' | 'L1' | 'O1' | 'TN' | 'E3' | 'Other';
  visaExpiryDate?: string;
  startDate?: string;
  email?: string;
}

/**
 * Creates an employee + (by default) a linked, active profile - the common
 * case for "an employee who can log in and act on their own records".
 * Pass linkToProfile: false to model the pre-signup state (employee row
 * exists, no account yet) that onboarding/i9/training's "/me" routes match
 * by email instead.
 */
export async function seedEmployee(opts: SeedEmployeeOptions = {}) {
  const email = opts.email ?? `${randomUUID()}@test.local`;
  const profile = opts.linkToProfile === false ? null : await seedProfile({ role: 'employee', email });

  const [employee] = await db
    .insert(employees)
    .values({
      userId: profile?.id,
      firstName: 'Test',
      lastName: 'Employee',
      email,
      visaType: opts.visaType ?? 'H1B',
      visaExpiryDate: opts.visaExpiryDate,
      startDate: opts.startDate ?? '2025-01-01',
    })
    .returning();

  return { employee, profile };
}
