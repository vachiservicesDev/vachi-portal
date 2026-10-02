'use client';

import { useState } from 'react';
import { formValues, useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { FieldRow, Fieldset, SelectField, TextField } from '@/components/ui/fields';
import { Alert, Chip, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface I9Record {
  id: string;
  status: string;
  section1CompletedAt: string | null;
}

const LABELS: Record<string, string> = {
  legalFirstName: 'Legal first name',
  legalLastName: 'Legal last name',
  address: 'Home address',
  dateOfBirth: 'Date of birth',
  ssn: 'Social Security number',
  email: 'Email',
  alienRegistrationNumber: 'A-Number or USCIS number',
  signedByName: 'Signature',
};

const CITIZENSHIP = [
  { value: 'us_citizen', label: '1. A citizen of the United States' },
  { value: 'noncitizen_national', label: '2. A noncitizen national of the United States' },
  { value: 'lawful_permanent_resident', label: '3. A lawful permanent resident' },
  { value: 'alien_authorized_to_work', label: '4. A noncitizen authorized to work' },
];

export default function EmployeeI9Page() {
  const { data, error, loading, reload } = useResource<{ record: I9Record | null }>('/api/i9/me');
  const [citizenship, setCitizenship] = useState('us_citizen');
  const action = useAction();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data?.record) return;
    const result = await action.run('submit', `/api/i9/records/${data.record.id}/section1`, { body: formValues(e.currentTarget) });
    if (result.ok) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await reload();
    }
  }

  if (loading && !data) return <Loading />;
  const record = data?.record;

  if (!record) {
    return (
      <>
        <PageHeader eyebrow="Getting started" title="Form I-9" />
        {error ? <Alert>{error}</Alert> : <EmptyState title="No Form I-9 yet">HR starts your Form I-9 before your first day. You&apos;ll get a notification when it&apos;s ready.</EmptyState>}
      </>
    );
  }

  if (record.status !== 'section1_pending') {
    const st = statusOf('i9', record.status);
    return (
      <>
        <PageHeader eyebrow="Getting started" title="Form I-9" actions={<Chip tone={st.tone}>{st.label}</Chip>} />
        <Alert tone="success" title="Section 1 is complete">
          You submitted it {record.section1CompletedAt ? <When iso={record.section1CompletedAt} withTime /> : ''}. HR completes Section 2 after checking your
          documents in person or by video. Bring original, unexpired documents from the Form I-9 Lists of Acceptable Documents on your first day.
        </Alert>
      </>
    );
  }

  const needsANumber = citizenship === 'lawful_permanent_resident' || citizenship === 'alien_authorized_to_work';
  const authorized = citizenship === 'alien_authorized_to_work';

  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Form I-9, Section 1"
        lead="Employment Eligibility Verification. Federal law requires every new employee to complete Section 1 no later than their first day of work."
      />
      <Panel>
        <form onSubmit={handleSubmit} className="grid gap-8">
          <FormStatus error={action.error} fieldErrors={action.fieldErrors} labels={LABELS} />
          <Fieldset legend="Your information">
            <FieldRow cols={3}>
              <TextField name="legalFirstName" label="Legal first name" required autoComplete="given-name" errors={action.fieldErrors} />
              <TextField name="legalLastName" label="Legal last name" required autoComplete="family-name" errors={action.fieldErrors} />
              <TextField name="otherLastNames" label="Other last names used" errors={action.fieldErrors} />
            </FieldRow>
            <TextField
              name="address"
              label="Home address"
              required
              autoComplete="street-address"
              hint="Street, apartment, city, state and ZIP code."
              errors={action.fieldErrors}
            />
            <FieldRow cols={3}>
              <TextField name="dateOfBirth" label="Date of birth" type="date" required autoComplete="bday" errors={action.fieldErrors} />
              <TextField
                name="ssn"
                label="Social Security number"
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                hint="Required only if your employer uses E-Verify."
                errors={action.fieldErrors}
              />
              <TextField name="phone" label="Phone" type="tel" autoComplete="tel" errors={action.fieldErrors} />
            </FieldRow>
            <TextField name="email" label="Email" type="email" autoComplete="email" className="sm:max-w-md" errors={action.fieldErrors} />
          </Fieldset>

          <Fieldset legend="Citizenship or immigration status">
            <SelectField
              name="citizenshipStatus"
              label="I attest, under penalty of perjury, that I am"
              required
              value={citizenship}
              onChange={(e) => setCitizenship(e.target.value)}
              options={CITIZENSHIP}
              errors={action.fieldErrors}
            />
            {needsANumber && (
              <TextField
                name="alienRegistrationNumber"
                label="A-Number or USCIS number"
                required={citizenship === 'lawful_permanent_resident'}
                hint={authorized ? 'Give this, a Form I-94 number or a foreign passport number.' : undefined}
                errors={action.fieldErrors}
              />
            )}
            {authorized && (
              <>
                <TextField name="workAuthorizationExpiration" label="Work authorization expires on" type="date" className="sm:max-w-xs" hint="Leave blank if it doesn't expire." errors={action.fieldErrors} />
                <FieldRow cols={3}>
                  <TextField name="i94AdmissionNumber" label="Form I-94 admission number" errors={action.fieldErrors} />
                  <TextField name="foreignPassportNumber" label="Foreign passport number" errors={action.fieldErrors} />
                  <TextField name="foreignPassportCountry" label="Country of issuance" errors={action.fieldErrors} />
                </FieldRow>
              </>
            )}
          </Fieldset>

          <Fieldset legend="Signature">
            <p className="text-ink-2">
              I am aware that federal law provides for imprisonment and/or fines for false statements, or the use of false documents, in connection with the
              completion of this form. I attest, under penalty of perjury, that this information is true and correct.
            </p>
            <TextField
              name="signedByName"
              label="Type your full legal name to sign"
              required
              autoComplete="name"
              className="sm:max-w-md"
              hint="Your typed name is your signature. Today's date is recorded with it."
              errors={action.fieldErrors}
            />
          </Fieldset>

          <div className="flex justify-end border-t border-line pt-6">
            <Button type="submit" size="lg" busy={action.busy === 'submit'} busyLabel="Submitting">
              Sign and submit Section 1
            </Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
