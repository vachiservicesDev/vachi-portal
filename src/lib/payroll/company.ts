import { db } from '@/db';
import { companySettings } from '@/db/schema';
import { DEFAULT_COMPANY, type Company } from './stub';

/** The employer details for pay stubs, as saved under Admin → Company details. */
export async function getCompany(): Promise<Company> {
  const [row] = await db.select().from(companySettings).limit(1);
  if (!row) return DEFAULT_COMPANY;
  return { name: row.legalName, address: row.address ?? '', ein: row.ein ?? '', phone: row.phone ?? '' };
}
