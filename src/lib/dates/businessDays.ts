/**
 * Adds N US business days (Mon-Fri) to a date. Does NOT account for federal
 * holidays — a known simplification. USCIS's Form I-9 Section 2 deadline is
 * "3 business days after the employee's first day of employment"; for
 * compliance-grade accuracy, wire in a federal holiday calendar before
 * relying on this for real filings.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * I-9 retention rule: records must be kept until the LATER of (hire date +
 * 3 years) or (termination date + 1 year). Returns null while the employee
 * is still active, since without a termination date the "later of" can't
 * be computed yet — re-run once termination_date is set.
 */
export function computeRetentionPurgeEligibleAt(
  hireDate: string,
  terminationDate: string | null,
): string | null {
  if (!terminationDate) return null;

  const threeYearsAfterHire = new Date(hireDate);
  threeYearsAfterHire.setFullYear(threeYearsAfterHire.getFullYear() + 3);

  const oneYearAfterTermination = new Date(terminationDate);
  oneYearAfterTermination.setFullYear(oneYearAfterTermination.getFullYear() + 1);

  const later = threeYearsAfterHire > oneYearAfterTermination ? threeYearsAfterHire : oneYearAfterTermination;
  return toDateOnly(later);
}
