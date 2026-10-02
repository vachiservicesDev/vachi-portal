'use client';

import { useParams } from 'next/navigation';
import { useAction, useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface OnboardingSession {
  id: string;
  employmentType: string;
  status: string;
  createdAt: string;
  formData: { employeeName?: string; startDate?: string; position?: string; department?: string };
}

interface OnboardingDocument {
  id: string;
  documentType: string;
  status: string;
  signedAt: string | null;
  createdAt: string;
}

function docName(type: string) {
  return type === 'onboarding_acknowledgment' ? 'Onboarding acknowledgment' : type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default function AdminOnboardingDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<{ session: OnboardingSession; documents: OnboardingDocument[] }>(`/api/onboarding/sessions/${params.id}`);
  const action = useAction();

  async function generate() {
    const result = await action.run('generate', `/api/onboarding/sessions/${params.id}/generate`, { method: 'POST' }, 'Document generated. Review it, then send it for signature.');
    if (result.ok) await reload();
  }

  async function send(documentId: string) {
    const result = await action.run(documentId, `/api/onboarding/sessions/${params.id}/send`, { body: { documentId } }, 'Sent. Dropbox Sign emails the employee a signing link.');
    if (result.ok) await reload();
  }

  if (loading && !data) return <Loading />;
  if (!data) return <Alert title="Couldn't load this onboarding">{error}</Alert>;

  const { session, documents } = data;
  const st = statusOf('onboarding', session.status);

  return (
    <>
      <PageHeader
        back={{ href: '/admin/onboarding', label: 'Onboarding' }}
        title={session.formData?.employeeName ?? 'Onboarding'}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            {session.employmentType === 'w2' ? 'W-2 employee' : '1099 contractor'}
            {session.formData?.startDate && (
              <>
                <span aria-hidden="true">·</span> starts <When iso={session.formData.startDate} />
              </>
            )}
            <Chip tone={st.tone}>{st.label}</Chip>
          </span>
        }
      />
      <div className="grid gap-6">
        <FormStatus error={action.error} success={action.success} />
        <Panel
          title="Documents"
          description="Generated as PDFs, stored privately and signed through Dropbox Sign. This page updates when the signature comes back."
          actions={
            documents.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => reload()}>
                Refresh
              </Button>
            )
          }
        >
          {documents.length === 0 ? (
            <EmptyState
              title="No documents yet"
              action={
                <Button onClick={generate} busy={action.busy === 'generate'} busyLabel="Generating">
                  Generate onboarding document
                </Button>
              }
            >
              Creates the onboarding acknowledgment PDF with this hire&apos;s details.
            </EmptyState>
          ) : (
            <ul className="grid gap-3">
              {documents.map((doc) => {
                const ds = statusOf('onboardingDocument', doc.status);
                return (
                  <li key={doc.id} className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{docName(doc.documentType)}</p>
                      <p className="text-sm text-muted">
                        {doc.status === 'signed' && doc.signedAt ? (
                          <>
                            Signed <When iso={doc.signedAt} withTime />
                          </>
                        ) : doc.status === 'sent_for_signature' ? (
                          'Waiting for the employee to sign.'
                        ) : (
                          <>
                            Generated <When iso={doc.createdAt} withTime />
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Chip tone={ds.tone}>{ds.label}</Chip>
                      {(doc.status === 'generated' || doc.status === 'failed') && (
                        <Button size="sm" onClick={() => send(doc.id)} busy={action.busy === doc.id} busyLabel="Sending" disabled={!!action.busy}>
                          {doc.status === 'failed' ? 'Try sending again' : 'Send for signature'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
