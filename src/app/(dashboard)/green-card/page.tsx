'use client';

import { useEffect, useState } from 'react';

interface GcCase {
  stage: string;
  priorityDate: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  perm_prep: 'PERM preparation',
  perm_filed: 'PERM filed',
  perm_certified: 'PERM certified',
  i140_filed: 'I-140 filed',
  i140_approved: 'I-140 approved',
  i485_filed: 'I-485 filed',
  i485_approved: 'I-485 approved',
  denied: 'Denied',
};

export default function GreenCardPage() {
  const [gcCase, setGcCase] = useState<GcCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/green-card/me')
      .then((res) => res.json())
      .then((data) => {
        setGcCase(data.case);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">My Green Card Sponsorship</h1>
      {!gcCase ? (
        <p className="mt-4 text-sm text-gray-500">No sponsorship case on file.</p>
      ) : (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="font-medium">{STAGE_LABELS[gcCase.stage] ?? gcCase.stage}</p>
          {gcCase.priorityDate && (
            <p className="mt-1 text-sm text-gray-500">Priority date: {gcCase.priorityDate}</p>
          )}
        </div>
      )}
    </div>
  );
}
