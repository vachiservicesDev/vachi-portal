'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface I9Record {
  id: string;
  status: string;
  section1Data: Record<string, unknown> | null;
  section2Data: Record<string, unknown> | null;
  everifyCaseNumber: string | null;
  everifyStatus: string;
}

export default function AdminI9DetailPage() {
  const params = useParams<{ id: string }>();
  const [record, setRecord] = useState<I9Record | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [caseNumber, setCaseNumber] = useState('');

  async function load() {
    const res = await fetch(`/api/i9/records/${params.id}`);
    if (res.ok) setRecord((await res.json()).record);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is re-created only to close over params.id
  }, [params.id]);

  async function handleSection2(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch(`/api/i9/records/${params.id}/section2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to save Section 2');
      return;
    }
    load();
  }

  async function handleEverify() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/i9/records/${params.id}/everify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseNumber }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to record E-Verify case');
      return;
    }
    setCaseNumber('');
    load();
  }

  if (!record) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">I-9 record</h1>
      <p className="mt-1 text-sm text-gray-500">status: {record.status}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <section className="mt-6 rounded-lg border border-gray-200 p-4">
        <h2 className="font-medium">Section 1</h2>
        {record.section1Data ? (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600">
            {JSON.stringify(record.section1Data, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Not completed by employee yet.</p>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="font-medium">Section 2</h2>
        {record.section2Data ? (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600">
            {JSON.stringify(record.section2Data, null, 2)}
          </pre>
        ) : record.section1Data ? (
          <form onSubmit={handleSection2} className="mt-3 space-y-3">
            <input name="documentTitle" required placeholder="Document title (e.g. U.S. Passport)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="issuingAuthority" required placeholder="Issuing authority" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="documentNumber" required placeholder="Document number" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="expirationDate" type="date" placeholder="Expiration date (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input name="firstDayOfEmployment" type="date" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {busy ? 'Saving…' : 'Complete Section 2'}
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Waiting on Section 1.</p>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="font-medium">E-Verify</h2>
        <p className="mt-1 text-sm text-gray-500">
          Status: {record.everifyStatus}
          {record.everifyCaseNumber && ` · case ${record.everifyCaseNumber}`}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Create the case in the real E-Verify portal, then record its case number here — this
          app does not call the live DHS API yet (see docs/PLAN.md).
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            placeholder="E-Verify case number"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleEverify}
            disabled={!caseNumber || busy}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Record case
          </button>
        </div>
      </section>
    </div>
  );
}
