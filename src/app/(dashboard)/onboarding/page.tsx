'use client';

import { useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { CheckboxField, TextField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';
import { W4Panel } from '@/components/payroll/W4Panel';

interface OnboardingDocument {
  id: string;
  documentType: string;
  status: string;
  signedAt: string | null;
}

function docName(type: string) {
  return type === 'onboarding_acknowledgment' ? 'Onboarding acknowledgment' : type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function SignForm({ doc, onSigned }: { doc: OnboardingDocument; onSigned: () => Promise<void> }) {
  const [fullName, setFullName] = useState('');
  const [consent, setConsent] = useState(false);
  const action = useAction();

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    const result = await action.run('sign', `/api/onboarding/documents/${doc.id}/sign`, { body: { fullName, consent } });
    if (result.ok) await onSigned();
  }

  return (
    <form onSubmit={sign} className="mt-4 grid gap-4 rounded-lg border border-line p-4" noValidate>
      <p className="text-sm text-ink">
        1.{' '}
        <a href={`/api/onboarding/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="font-medium text-navy-700 underline">
          Open and read the document
        </a>{' '}
        (opens in a new tab). 2. Type your full name and agree below.
      </p>
      <FormStatus error={action.error} fieldErrors={action.fieldErrors} labels={{ fullName: 'Full name', consent: 'Agreement' }} />
      <TextField
        name="fullName"
        label="Your full name"
        required
        hint="Type your first and last name exactly as HR has them. This is your signature."
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        errors={action.fieldErrors}
      />
      <CheckboxField
        name="consent"
        label="I have read this document and agree to sign it electronically. My typed name is my signature."
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        errors={action.fieldErrors}
      />
      <div>
        <Button type="submit" busy={action.busy === 'sign'} busyLabel="Signing" disabled={!consent || !fullName.trim()}>
          Sign document
        </Button>
      </div>
    </form>
  );
}

export default function EmployeeOnboardingPage() {
  const { data, error, loading, reload } = useResource<{ session: { status: string } | null; documents: OnboardingDocument[] }>('/api/onboarding/me');

  if (loading && !data) return <Loading />;

  const session = data?.session;
  const documents = data?.documents ?? [];
  const st = session ? statusOf('onboarding', session.status) : null;

  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Onboarding"
        lead="Your welcome paperwork. Sign each document HR sends by typing your name, and fill in your tax forms before your first paycheck."
        actions={st && <Chip tone={st.tone}>{st.label}</Chip>}
      />
      {error && <Alert title="Couldn't load your onboarding">{error}</Alert>}
      {!session ? (
        <EmptyState title="Nothing to sign yet">HR hasn&apos;t started your onboarding. You&apos;ll get an email when there&apos;s something to sign.</EmptyState>
      ) : documents.length === 0 ? (
        <EmptyState title="Documents on the way">HR is preparing your documents. Check back soon.</EmptyState>
      ) : (
        <Panel title="Your documents">
          <ul className="divide-y divide-line">
            {documents.map((doc) => {
              const ds = statusOf('onboardingDocument', doc.status);
              return (
                <li key={doc.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-ink">{docName(doc.documentType)}</p>
                      <p className="text-sm text-muted">
                        {doc.status === 'sent_for_signature' ? (
                          'Ready for your signature.'
                        ) : doc.status === 'signed' ? (
                          <>
                            Signed <When iso={doc.signedAt} />.{' '}
                            <a href={`/api/onboarding/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="font-medium text-navy-700 underline">
                              Download your signed copy
                            </a>
                          </>
                        ) : (
                          'HR will send this for your signature.'
                        )}
                      </p>
                    </div>
                    <Chip tone={ds.tone}>{doc.status === 'generated' ? 'Being prepared' : ds.label}</Chip>
                  </div>
                  {doc.status === 'sent_for_signature' && <SignForm doc={doc} onSigned={reload} />}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      <div className="mt-6">
        <W4Panel id="tax-forms" />
      </div>
    </>
  );
}
