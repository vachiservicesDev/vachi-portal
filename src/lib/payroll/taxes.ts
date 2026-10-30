import { MEDICARE_RATE, SOCIAL_SECURITY_RATE, SOCIAL_SECURITY_WAGE_BASE } from './stub';
import { federalWithholding, stateWithholding, type PayFrequency, type TaxSetup } from './w4';

const ADDITIONAL_MEDICARE_THRESHOLD = 200_000;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const round = (n: number) => Math.round(n * 100) / 100;

export interface TaxContext {
  gross: number;
  retirement: number; // 401(k): excluded from income tax, not from FICA
  healthInsurance: number; // section 125: excluded from income tax and FICA
  frequency: PayFrequency;
  setup: TaxSetup;
  workState: string | null;
  /** Social Security / Medicare wages already paid this calendar year, before this stub. */
  ficaWagesYtd: number;
}

export interface TaxResult {
  federalTax: number | null; // null when there is no W-4 on file
  socialSecurity: number;
  medicare: number;
  stateTax: number | null; // null when the state needs HR's figure
}

/** Every tax on one paycheck, from the employee's W-4, state setup and year-to-date wages. */
export function computeTaxes(c: TaxContext): TaxResult {
  const ficaWages = Math.max(0, c.gross - c.healthInsurance);
  const incomeWages = Math.max(0, c.gross - c.healthInsurance - c.retirement);
  const ssRoom = Math.max(0, SOCIAL_SECURITY_WAGE_BASE - c.ficaWagesYtd);
  const overThreshold = Math.max(0, c.ficaWagesYtd + ficaWages - Math.max(ADDITIONAL_MEDICARE_THRESHOLD, c.ficaWagesYtd));
  const federalTax = c.setup.federal ? federalWithholding(incomeWages, c.frequency, c.setup.federal) : null;
  return {
    federalTax,
    socialSecurity: round(Math.min(ficaWages, ssRoom) * SOCIAL_SECURITY_RATE),
    medicare: round(ficaWages * MEDICARE_RATE + overThreshold * ADDITIONAL_MEDICARE_RATE),
    stateTax: stateWithholding(c.workState, c.setup, {
      wages: incomeWages,
      wagesWith401k: ficaWages,
      frequency: c.frequency,
      federalTax: federalTax ?? 0,
      ficaYtd: c.ficaWagesYtd,
    }),
  };
}
