import { describe, expect, it } from 'vitest';
import { addBusinessDays, computeRetentionPurgeEligibleAt, toDateOnly } from '@/lib/dates/businessDays';

describe('addBusinessDays', () => {
  it('skips a weekend in between', () => {
    // Thursday 2026-01-08 + 3 business days -> Fri(1), Sat/Sun skipped, Mon(2), Tue(3) = 2026-01-13
    const result = addBusinessDays(new Date('2026-01-08T00:00:00Z'), 3);
    expect(toDateOnly(result)).toBe('2026-01-13');
  });

  it('a Friday start pushes entirely past the weekend', () => {
    const result = addBusinessDays(new Date('2026-01-09T00:00:00Z'), 1); // Friday
    expect(toDateOnly(result)).toBe('2026-01-12'); // Monday
  });

  it('zero days returns the start date unchanged', () => {
    const result = addBusinessDays(new Date('2026-01-08T00:00:00Z'), 0);
    expect(toDateOnly(result)).toBe('2026-01-08');
  });
});

describe('computeRetentionPurgeEligibleAt', () => {
  it('returns null while still employed (no termination date)', () => {
    expect(computeRetentionPurgeEligibleAt('2023-01-01', null)).toBeNull();
  });

  it('picks hire+3y when that is later than termination+1y', () => {
    // hired 2024-01-01 (+3y = 2027-01-01), terminated 2025-06-01 (+1y = 2026-06-01)
    expect(computeRetentionPurgeEligibleAt('2024-01-01', '2025-06-01')).toBe('2027-01-01');
  });

  it('picks termination+1y when that is later than hire+3y', () => {
    // hired 2020-01-01 (+3y = 2023-01-01), terminated 2025-06-01 (+1y = 2026-06-01)
    expect(computeRetentionPurgeEligibleAt('2020-01-01', '2025-06-01')).toBe('2026-06-01');
  });
});
