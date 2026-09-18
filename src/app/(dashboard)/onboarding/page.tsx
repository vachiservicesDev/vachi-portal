'use client';

import { useEffect, useState } from 'react';

interface OnboardingDocument {
  id: string;
  documentType: string;
  status: string;
}

export default function EmployeeOnboardingPage() {
  const [session, setSession] = useState<{ status: string } | null>(null);
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding/me')
      .then((res) => res.json())
      .then((data) => {
        setSession(data.session);
        setDocuments(data.documents ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Onboarding</h1>

      {!session ? (
        <p className="mt-4 text-sm text-gray-500">No onboarding has been started for you yet.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-500">Status: {session.status}</p>
          <ul className="mt-6 space-y-3">
            {documents.map((doc) => (
              <li key={doc.id} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium">{doc.documentType}</p>
                <p className="text-sm text-gray-500">
                  {doc.status === 'sent_for_signature'
                    ? 'Check your email for a signing request.'
                    : doc.status === 'signed'
                      ? 'Signed ✓'
                      : doc.status}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
