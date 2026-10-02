import { fullName } from '@/lib/status';

/** A person's name from their employee record, or their email when they have none (e.g. HR-only accounts). */
export function partnerName(p: { firstName: string | null; lastName: string | null; email: string }) {
  return p.firstName ? fullName(p.firstName, p.lastName) : p.email;
}
