'use client';

import { useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { Alert, Chip, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface OnboardingDocument {
  id: string;
  documentType: string;
  status: string;
  signedAt: string | null;
}

function docName(type: string) {
  return type === 'onboarding_acknowledgment' ? 'Onboarding acknowledgment' : type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default function EmployeeOnboardingPage() {
  const { data, error, loading } = useResource<{ session: { status: string } | null; documents: OnboardingDocument[] }>('/api/onboarding/me');

  if (loading && !data) return <Loading />;

  const session = data?.session;
  const documents = data?.documents ?? [];
  const st = session ? statusOf('onboarding', session.status) : null;

  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Onboarding"
        lead="Your welcome paperwork. Each document arrives by email from Dropbox Sign; sign it there and it shows as signed here."
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
                <li key={doc.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{docName(doc.documentType)}</p>
                    <p className="text-sm text-muted">
                      {doc.status === 'sent_for_signature' ? (
                        'Check your email for a signing request from Dropbox Sign.'
                      ) : doc.status === 'signed' ? (
                        <>
                          Signed <When iso={doc.signedAt} />
                        </>
                      ) : (
                        'HR will send this for your signature.'
                      )}
                    </p>
                  </div>
                  <Chip tone={ds.tone}>{doc.status === 'generated' ? 'Being prepared' : ds.label}</Chip>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
