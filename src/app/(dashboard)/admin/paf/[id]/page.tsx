'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PafFile {
  lcaCaseNumber: string;
  lcaFilingDate: string;
  worksite: string;
  wageLevel: string | null;
  prevailingWage: string | null;
  actualWage: string | null;
  postingStartDate: string | null;
  postingEndDate: string | null;
}

export default function AdminPafDetailPage() {
  const params = useParams<{ id: string }>();
  const [file, setFile] = useState<PafFile | null>(null);

  useEffect(() => {
    fetch(`/api/paf/${params.id}`)
      .then((res) => res.json())
      .then((data) => setFile(data.file));
  }, [params.id]);

  if (!file) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">LCA {file.lcaCaseNumber}</h1>
      <dl className="mt-6 space-y-2 text-sm">
        <div><dt className="inline font-medium">Filed: </dt><dd className="inline">{file.lcaFilingDate}</dd></div>
        <div><dt className="inline font-medium">Worksite: </dt><dd className="inline">{file.worksite}</dd></div>
        <div><dt className="inline font-medium">Wage level: </dt><dd className="inline">{file.wageLevel ?? '—'}</dd></div>
        <div><dt className="inline font-medium">Prevailing wage: </dt><dd className="inline">{file.prevailingWage ?? '—'}</dd></div>
        <div><dt className="inline font-medium">Actual wage: </dt><dd className="inline">{file.actualWage ?? '—'}</dd></div>
        <div><dt className="inline font-medium">Posting period: </dt><dd className="inline">{file.postingStartDate ?? '—'} – {file.postingEndDate ?? '—'}</dd></div>
      </dl>
    </div>
  );
}
