'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const STAGES = [
  'perm_prep',
  'perm_filed',
  'perm_certified',
  'i140_filed',
  'i140_approved',
  'i485_filed',
  'i485_approved',
  'denied',
] as const;

interface GcCase {
  id: string;
  stage: string;
  priorityDate: string | null;
  notes: string | null;
}

export default function AdminGreenCardDetailPage() {
  const params = useParams<{ id: string }>();
  const [gcCase, setGcCase] = useState<GcCase | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/green-card/${params.id}`);
    if (res.ok) setGcCase((await res.json()).case);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over params.id only
  }, [params.id]);

  async function updateStage(stage: string) {
    setBusy(true);
    await fetch(`/api/green-card/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    setBusy(false);
    load();
  }

  if (!gcCase) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Green Card Case</h1>
      <p className="mt-1 text-sm text-gray-500">Current stage: {gcCase.stage}</p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">Update stage</label>
        <select
          value={gcCase.stage}
          onChange={(e) => updateStage(e.target.value)}
          disabled={busy}
          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
