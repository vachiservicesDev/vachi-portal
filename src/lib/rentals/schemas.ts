import { z } from 'zod';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a full date, like 2026-01-31.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a real date.');
const money = z.coerce.number({ invalid_type_error: 'Enter an amount.' }).min(0, 'Enter zero or more.').max(1_000_000, 'That amount looks too large.');
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const optional = (max: number) => text(max).optional();

export const propertySchema = z.object({
  name: text(150).min(1, 'Give the home a name, like "Unit 12".'),
  address: text(500).min(1, 'Enter the street address.'),
  city: optional(100),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use the two-letter state, like CT.').default('CT'),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code.').optional(),
  hoaName: optional(150),
  hoaContact: optional(500),
  notes: optional(5000),
});

export const leaseSchema = z
  .object({
    tenantName: text(200).min(1, "Enter the tenant's name."),
    tenantEmail: z.string().trim().toLowerCase().email('Enter a valid email.').max(255),
    tenantPhone: optional(30),
    startDate: day,
    endDate: day.optional(),
    monthlyRent: money.refine((v) => v > 0, 'Enter the monthly rent.'),
    dueDay: z.coerce.number().int().min(1, 'Pick a day from 1 to 28.').max(28, 'Pick a day from 1 to 28.').default(1),
    graceDays: z.coerce.number().int().min(0).max(31).default(9),
    lateFee: money.optional(),
    securityDeposit: money.optional(),
  })
  .refine((v) => !v.endDate || v.endDate > v.startDate, { message: 'The end date must be after the start date.', path: ['endDate'] });

export const leaseUpdateSchema = z.object({
  status: z.enum(['active', 'ended']).optional(),
  endDate: z.union([z.literal(''), day]).optional(),
  tenantPhone: optional(30),
  monthlyRent: money.refine((v) => v > 0, 'Enter the monthly rent.').optional(),
});

export const paymentSchema = z.object({
  paidAmount: money,
  paidOn: day.optional(),
  paymentMethod: z.enum(['zelle', 'check', 'cash', 'bank_transfer', 'card', 'other']).optional(),
  note: optional(1000),
});

export const repairCreateSchema = z.object({
  title: text(200).min(1, "Say what needs fixing, like 'Kitchen sink leaking'."),
  description: optional(5000),
  urgency: z.enum(['low', 'normal', 'urgent']).default('normal'),
});

export const repairUpdateSchema = z.object({
  status: z.enum(['open', 'scheduled', 'done', 'cancelled']).optional(),
  // An empty string clears the appointment.
  appointmentAt: z.union([z.literal(''), z.string().datetime({ offset: true, message: 'Enter a date and time.' })]).optional(),
  vendorName: optional(150),
  vendorPhone: optional(30),
  cost: z.union([z.literal(''), money]).optional(),
  notes: optional(5000),
});

export const REMINDER_KINDS = ['insurance', 'hoa', 'tax', 'other'] as const;

export const reminderSchema = z.object({
  kind: z.enum(REMINDER_KINDS, { errorMap: () => ({ message: 'Choose a type.' }) }),
  title: text(200).min(1, 'Enter a title, like "Landlord insurance renewal".'),
  provider: optional(150),
  reference: optional(100),
  amount: money.optional(),
  dueDate: day,
  repeat: z.enum(['none', 'monthly', 'quarterly', 'yearly']).default('none'),
  notes: optional(5000),
});

/** Turns a parsed number back into the string Drizzle's decimal columns expect. */
export function dec(value: number | undefined | null): string | null {
  return value === undefined || value === null ? null : value.toFixed(2);
}
