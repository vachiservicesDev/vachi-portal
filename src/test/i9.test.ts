import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { i9Records } from '@/db/schema';
import { POST as createRecord } from '@/app/api/i9/records/route';
import { POST as submitSection1 } from '@/app/api/i9/records/[id]/section1/route';
import { POST as submitSection2 } from '@/app/api/i9/records/[id]/section2/route';
import { POST as recordEverifyCase } from '@/app/api/i9/records/[id]/everify/route';
import { GET as meRoute } from '@/app/api/i9/me/route';
import { eq } from 'drizzle-orm';
import { resetDb, seedEmployee, seedProfile } from './db';
import { jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

describe('I-9 / E-Verify (Phase 3)', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await seedProfile({ role: 'admin' });
    adminId = admin.id;
    setCurrentUser(adminId);
  });

  it('computes section2DueAt as 3 business days after start date, skipping weekends', async () => {
    // Thursday 2026-01-08 start -> Fri, [Sat, Sun skipped], Mon, Tue = 2026-01-13
    const { employee } = await seedEmployee({ startDate: '2026-01-08' });
    setCurrentUser(adminId);

    const res = await createRecord(jsonRequest({ employeeId: employee.id }));
    expect(res.status).toBe(201);
    const { record } = await res.json();
    expect(record.section2DueAt).toBe('2026-01-13');
  });

  it('carries visaExpiryDate through as section3DueAt', async () => {
    const { employee } = await seedEmployee({ visaExpiryDate: '2027-06-01' });
    const res = await createRecord(jsonRequest({ employeeId: employee.id }));
    const { record } = await res.json();
    expect(record.section3DueAt).toBe('2027-06-01');
  });

  it('refuses to create a second I-9 record for the same employee', async () => {
    const { employee } = await seedEmployee();
    await createRecord(jsonRequest({ employeeId: employee.id }));
    const dup = await createRecord(jsonRequest({ employeeId: employee.id }));
    expect(dup.status).toBe(409);
  });

  it("employee can submit their own Section 1, not someone else's", async () => {
    const { employee, profile } = await seedEmployee();
    setCurrentUser(adminId);
    const createRes = await createRecord(jsonRequest({ employeeId: employee.id }));
    const { record } = await createRes.json();

    const section1Payload = {
      legalFirstName: 'Test',
      legalLastName: 'Employee',
      address: '123 Main St',
      dateOfBirth: '1990-01-01',
      citizenshipStatus: 'us_citizen',
      signedByName: 'Test Employee',
    };

    // A different employee cannot submit onto this record.
    const { profile: otherProfile } = await seedEmployee();
    setCurrentUser(otherProfile!.id);
    const blocked = await submitSection1(jsonRequest(section1Payload), { params: { id: record.id } });
    expect(blocked.status).toBe(403);

    // The actual employee can.
    setCurrentUser(profile!.id);
    const ok = await submitSection1(jsonRequest(section1Payload), { params: { id: record.id } });
    expect(ok.status).toBe(200);

    const [updated] = await db.select().from(i9Records).where(eq(i9Records.id, record.id));
    expect(updated.status).toBe('section2_pending');
    expect(updated.section1SignedByName).toBe('Test Employee');
  });

  it('section 2 cannot be completed before section 1, and generates a snapshot once it can', async () => {
    const { employee, profile } = await seedEmployee();
    setCurrentUser(adminId);
    const createRes = await createRecord(jsonRequest({ employeeId: employee.id }));
    const { record } = await createRes.json();

    const tooEarly = await submitSection2(
      jsonRequest({
        documentTitle: 'US Passport',
        issuingAuthority: 'US Dept of State',
        documentNumber: '123456789',
        firstDayOfEmployment: '2025-01-01',
      }),
      { params: { id: record.id } },
    );
    expect(tooEarly.status).toBe(400);

    setCurrentUser(profile!.id);
    await submitSection1(
      jsonRequest({
        legalFirstName: 'Test',
        legalLastName: 'Employee',
        address: '123 Main St',
        dateOfBirth: '1990-01-01',
        citizenshipStatus: 'us_citizen',
        signedByName: 'Test Employee',
      }),
      { params: { id: record.id } },
    );

    setCurrentUser(adminId);
    const res = await submitSection2(
      jsonRequest({
        documentTitle: 'US Passport',
        issuingAuthority: 'US Dept of State',
        documentNumber: '123456789',
        firstDayOfEmployment: '2025-01-01',
      }),
      { params: { id: record.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshotPath).toBe(`${record.id}/i9-record.pdf`);
    expect(body.record.status).toBe('complete');
  });

  it('E-Verify case recording is admin-only and manual (no live DHS call)', async () => {
    const { employee, profile } = await seedEmployee();
    setCurrentUser(adminId);
    const createRes = await createRecord(jsonRequest({ employeeId: employee.id }));
    const { record } = await createRes.json();

    setCurrentUser(profile!.id);
    const blocked = await recordEverifyCase(jsonRequest({ caseNumber: 'EV123' }), {
      params: { id: record.id },
    });
    expect(blocked.status).toBe(403);

    setCurrentUser(adminId);
    const res = await recordEverifyCase(jsonRequest({ caseNumber: 'EV123' }), {
      params: { id: record.id },
    });
    expect(res.status).toBe(200);
    const { record: updated } = await res.json();
    expect(updated.everifyCaseNumber).toBe('EV123');
    expect(updated.everifyStatus).toBe('submitted');
  });

  it('/api/i9/me matches by email before the account is linked', async () => {
    setCurrentUser(adminId);
    const { employee } = await seedEmployee({ linkToProfile: false, email: 'presignup@test.local' });
    await createRecord(jsonRequest({ employeeId: employee.id }));

    const laterProfile = await seedProfile({ role: 'employee', email: 'presignup@test.local' });
    setCurrentUser(laterProfile.id);

    const res = await meRoute();
    const { record } = await res.json();
    expect(record).not.toBeNull();
  });
});
