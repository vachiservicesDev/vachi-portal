'use client';

import { useParams } from 'next/navigation';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { fullName, statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { FieldRow, SelectField, TextField } from '@/components/ui/fields';
import { Alert, Chip, DetailList, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

type Section1 = Record<string, string | undefined>;
type Section2 = Record<string, string | undefined>;

interface I9Record {
  id: string;
  status: string;
  section1Data: Section1 | null;
  section1SignedByName: string | null;
  section1CompletedAt: string | null;
  section2Data: Section2 | null;
  section2DueAt: string | null;
  section2CompletedAt: string | null;
  everifyCaseNumber: string | null;
  everifyStatus: string;
  everifySubmittedAt: string | null;
}

const CITIZENSHIP: Record<string, string> = {
  us_citizen: 'A citizen of the United States',
  noncitizen_national: 'A noncitizen national of the United States',
  lawful_permanent_resident: 'A lawful permanent resident',
  alien_authorized_to_work: 'A noncitizen authorized to work',
};

/** Show only the last four digits of an SSN on screen. */
function maskSsn(ssn: string | undefined) {
  if (!ssn) return null;
  const digits = ssn.replace(/\D/g, '');
  return digits.length >= 4 ? `•••-••-${digits.slice(-4)}` : '•••';
}

const S2_LABELS = { documentTitle: 'Document title', issuingAuthority: 'Issuing authority', documentNumber: 'Document number', firstDayOfEmployment: 'First day of employment' };

export default function AdminI9DetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<{ record: I9Record; employee: { firstName: string; lastName: string; email: string } | null }>(
    `/api/i9/records/${params.id}`,
  );
  const s2 = useAction();
  const ev = useAction();

  async function handleSection2(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await s2.run('save', `/api/i9/records/${params.id}/section2`, { body: formValues(e.currentTarget) }, 'Section 2 completed and the signed PDF saved.');
    if (result.ok) await reload();
  }

  async function handleEverify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await ev.run('save', `/api/i9/records/${params.id}/everify`, { body: formValues(e.currentTarget) }, 'E-Verify case saved.');
    if (result.ok) await reload();
  }

  if (loading && !data) return <Loading />;
  if (!data) return <Alert title="Couldn't load this Form I-9">{error}</Alert>;

  const { record, employee } = data;
  const st = statusOf('i9', record.status);
  const evs = statusOf('everify', record.everifyStatus);
  const s1 = record.section1Data;

  return (
    <>
      <PageHeader
        back={{ href: '/admin/i9', label: 'Form I-9 and E-Verify' }}
        title={employee ? fullName(employee.firstName, employee.lastName) : 'Form I-9'}
        lead={<span className="flex flex-wrap items-center gap-2">Form I-9 <Chip tone={st.tone}>{st.label}</Chip></span>}
      />
      <div className="grid gap-6">
        <Panel
          title="Section 1: Employee information and attestation"
          actions={s1 ? <Chip tone="live">Signed</Chip> : <Chip tone="new">Waiting on employee</Chip>}
        >
          {s1 ? (
            <div className="grid gap-6">
              <DetailList
                columns={3}
                items={[
                  { label: 'Legal name', value: [s1.legalFirstName, s1.legalLastName].filter(Boolean).join(' ') },
                  { label: 'Other last names', value: s1.otherLastNames },
                  { label: 'Date of birth', value: s1.dateOfBirth && <When iso={s1.dateOfBirth} /> },
                  { label: 'Address', value: s1.address },
                  { label: 'Social Security number', value: maskSsn(s1.ssn) },
                  { label: 'Email', value: s1.email },
                  { label: 'Phone', value: s1.phone },
                  { label: 'Status', value: s1.citizenshipStatus && CITIZENSHIP[s1.citizenshipStatus] },
                  { label: 'A-Number / USCIS number', value: s1.alienRegistrationNumber },
                  { label: 'Work authorization expires', value: s1.workAuthorizationExpiration && <When iso={s1.workAuthorizationExpiration} /> },
                  { label: 'Form I-94 number', value: s1.i94AdmissionNumber },
                  {
                    label: 'Foreign passport',
                    value: s1.foreignPassportNumber ? `${s1.foreignPassportNumber}${s1.foreignPassportCountry ? ` (${s1.foreignPassportCountry})` : ''}` : null,
                  },
                ]}
              />
              <p className="border-t border-line pt-4 text-sm text-muted">
                Signed by <span className="font-medium text-ink">{record.section1SignedByName}</span> on <When iso={record.section1CompletedAt} withTime />
              </p>
            </div>
          ) : (
            <p className="text-ink-2">The employee hasn&apos;t completed Section 1 yet. It appears here as soon as they sign it in the portal.</p>
          )}
        </Panel>

        <Panel
          title="Section 2: Employer review and verification"
          description={
            record.section2DueAt && !record.section2Data ? (
              <>
                Due by <When iso={record.section2DueAt} />, 3 business days after the first day of work.
              </>
            ) : undefined
          }
          actions={record.section2Data ? <Chip tone="live">Complete</Chip> : null}
        >
          {record.section2Data ? (
            <div className="grid gap-6">
              <DetailList
                columns={3}
                items={[
                  { label: 'Document title', value: record.section2Data.documentTitle },
                  { label: 'Issuing authority', value: record.section2Data.issuingAuthority },
                  { label: 'Document number', value: record.section2Data.documentNumber },
                  { label: 'Expiration date', value: record.section2Data.expirationDate && <When iso={record.section2Data.expirationDate} /> },
                  { label: 'First day of employment', value: record.section2Data.firstDayOfEmployment && <When iso={record.section2Data.firstDayOfEmployment} /> },
                ]}
              />
              <p className="border-t border-line pt-4 text-sm text-muted">
                Completed <When iso={record.section2CompletedAt} withTime />. The combined PDF is stored in the private i9-records bucket.
              </p>
            </div>
          ) : s1 ? (
            <form onSubmit={handleSection2} className="grid gap-5">
              <FormStatus error={s2.error} success={s2.success} fieldErrors={s2.fieldErrors} labels={S2_LABELS} />
              <p className="text-ink-2">Examine the employee&apos;s original documents (in person or by approved video), then record them here.</p>
              <FieldRow>
                <TextField name="documentTitle" label="Document title" required placeholder="U.S. Passport" errors={s2.fieldErrors} />
                <TextField name="issuingAuthority" label="Issuing authority" required placeholder="U.S. Department of State" errors={s2.fieldErrors} />
              </FieldRow>
              <FieldRow cols={3}>
                <TextField name="documentNumber" label="Document number" required errors={s2.fieldErrors} />
                <TextField name="expirationDate" label="Expiration date" type="date" errors={s2.fieldErrors} />
                <TextField name="firstDayOfEmployment" label="First day of employment" type="date" required errors={s2.fieldErrors} />
              </FieldRow>
              <div className="flex justify-end border-t border-line pt-5">
                <Button type="submit" busy={s2.busy === 'save'} busyLabel="Saving">
                  Complete Section 2
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-ink-2">Available once the employee completes Section 1.</p>
          )}
        </Panel>

        <Panel
          title="E-Verify"
          description="Create the case in the E-Verify portal, then record its number and result here. The portal doesn't contact DHS directly."
          actions={<Chip tone={evs.tone}>{evs.label}</Chip>}
        >
          <form onSubmit={handleEverify} className="grid gap-5">
            <FormStatus error={ev.error} success={ev.success} fieldErrors={ev.fieldErrors} labels={{ caseNumber: 'Case number' }} />
            <FieldRow>
              <TextField name="caseNumber" label="Case number" required defaultValue={record.everifyCaseNumber} errors={ev.fieldErrors} />
              <SelectField
                name="status"
                label="Case result"
                required
                defaultValue={record.everifyStatus === 'not_created' ? 'submitted' : record.everifyStatus}
                errors={ev.fieldErrors}
                options={[
                  { value: 'submitted', label: 'Submitted, awaiting result' },
                  { value: 'employment_authorized', label: 'Employment authorized' },
                  { value: 'tentative_nonconfirmation', label: 'Tentative nonconfirmation (mismatch)' },
                  { value: 'final_nonconfirmation', label: 'Final nonconfirmation' },
                  { value: 'closed', label: 'Case closed' },
                ]}
              />
            </FieldRow>
            {record.everifySubmittedAt && (
              <p className="text-sm text-muted">
                First recorded <When iso={record.everifySubmittedAt} withTime />
              </p>
            )}
            <div className="flex justify-end border-t border-line pt-5">
              <Button type="submit" busy={ev.busy === 'save'} busyLabel="Saving">
                {record.everifyCaseNumber ? 'Update case' : 'Record case'}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
