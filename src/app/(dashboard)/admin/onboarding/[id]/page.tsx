'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface OnboardingSession {
  id: string;
  employmentType: string;
  status: string;
  formData: { employeeName?: string };
}

interface OnboardingDocument {
  id: string;
  documentType: string;
  status: string;
  generatedFilePath: string | null;
  signedFilePath: string | null;
}

export default function AdminOnboardingDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/onboarding/sessions/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data.session);
      setDocuments(data.documents);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable across renders and re-created only to close over params.id
  }, [params.id]);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/onboarding/sessions/${params.id}/generate`, { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'Failed to generate document');
      return;
    }
    load();
  }

  async function handleSend(documentId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/onboarding/sessions/${params.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'Failed to send for signature');
      return;
    }
    load();
  }

  if (!session) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{session.formData?.employeeName ?? 'Onboarding'}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {session.employmentType.toUpperCase()} · session status: {session.status}
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        {documents.length === 0 ? (
          <button
            onClick={handleGenerate}
            disabled={busy}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Generating…' : 'Generate onboarding document'}
          </button>
        ) : (
          <ul className="space-y-3">
            {documents.map((doc) => (
              <li key={doc.id} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium">{doc.documentType}</p>
                <p className="text-sm text-gray-500">status: {doc.status}</p>
                {doc.status === 'generated' && (
                  <button
                    onClick={() => handleSend(doc.id)}
                    disabled={busy}
                    className="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Send for signature'}
                  </button>
                )}
                {doc.status === 'sent_for_signature' && (
                  <p className="mt-2 text-sm text-amber-600">
                    Sent — Dropbox Sign emails the signer directly. This page updates automatically
                    once the webhook reports it signed.
                  </p>
                )}
                {doc.status === 'signed' && (
                  <p className="mt-2 text-sm text-green-600">Signed ✓</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
