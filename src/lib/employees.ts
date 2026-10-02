import { z } from 'zod';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { employees } from '@/db/schema';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a full date, like 2026-01-31.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a real date.');

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).optional();

export const VISA_VALUES = ['OPT', 'STEM_OPT', 'H1B', 'L1', 'O1', 'TN', 'E3', 'Other'] as const;

/** Fields an admin can set on an employee record. Empty optional fields arrive as "not given". */
export const employeeFields = {
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email, like name@company.com.').max(255),
  phoneNumber: optionalText(20),
  position: optionalText(100),
  department: optionalText(100),
  startDate: date.optional(),
  visaType: z.enum(VISA_VALUES).optional(),
  visaStartDate: date.optional(),
  visaExpiryDate: date.optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
};

export const createEmployeeSchema = z.object(employeeFields).refine(
  (v) => !v.visaStartDate || !v.visaExpiryDate || v.visaStartDate <= v.visaExpiryDate,
  { message: 'The expiry date must be after the start date.', path: ['visaExpiryDate'] },
);

/** On update every field is optional, and `null` clears an optional one. */
export const updateEmployeeSchema = z
  .object({
    firstName: employeeFields.firstName.optional(),
    lastName: employeeFields.lastName.optional(),
    email: employeeFields.email.optional(),
    phoneNumber: optionalText(20).nullable(),
    position: optionalText(100).nullable(),
    department: optionalText(100).nullable(),
    startDate: date.nullable().optional(),
    visaType: z.enum(VISA_VALUES).optional(),
    visaStartDate: date.nullable().optional(),
    visaExpiryDate: date.nullable().optional(),
    status: employeeFields.status,
    role: z.enum(['admin', 'employee']).optional(),
  })
  .refine((v) => !v.visaStartDate || !v.visaExpiryDate || v.visaStartDate <= v.visaExpiryDate, {
    message: 'The expiry date must be after the start date.',
    path: ['visaExpiryDate'],
  });

/** The employee record with this email, compared case-insensitively. */
export async function findEmployeeByEmail(email: string) {
  const [row] = await db
    .select()
    .from(employees)
    .where(sql`lower(${employees.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

export async function findEmployee(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return row ?? null;
}

/**
 * The SQL condition for "the employee record that belongs to this profile": linked by account,
 * or, before an invite has linked them, by email (case-insensitive).
 */
export function ownEmployee(profile: { id: string; email: string }) {
  return or(eq(employees.userId, profile.id), sql`lower(${employees.email}) = ${profile.email.toLowerCase()}`)!;
}

/** True when this employee record belongs to the signed-in profile (same rule as ownEmployee). */
export function ownsEmployee(
  employee: { userId: string | null; email: string } | null | undefined,
  profile: { id: string; email: string },
): boolean {
  if (!employee) return false;
  return employee.userId === profile.id || employee.email.toLowerCase() === profile.email.toLowerCase();
}
