'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  pendingOnboarding: number;
  overdueI9Section2: number;
  pendingTimesheets: number;
  pendingTrainingSummaries: number;
  visasExpiringSoon: number;
}

const CARDS: { key: keyof Stats; label: string; href: string }[] = [
  { key: 'pendingOnboarding', label: 'Onboarding in progress', href: '/admin/onboarding' },
  { key: 'overdueI9Section2', label: 'Overdue I-9 Section 2', href: '/admin/i9' },
  { key: 'pendingTimesheets', label: 'Timesheets awaiting approval', href: '/admin/timesheets' },
  { key: 'pendingTrainingSummaries', label: 'Weekly summaries to review', href: '/admin/training/summaries' },
  { key: 'visasExpiringSoon', label: 'Visas expiring within 30 days', href: '/admin/immigration' },
];

export default function AdminHomePage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((res) => res.json())
      .then(setStats);
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:bg-indigo-50"
          >
            <p className="text-3xl font-semibold">{stats ? stats[c.key] : '–'}</p>
            <p className="mt-1 text-sm text-gray-500">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/admin/audit-log" className="text-sm text-indigo-600 hover:underline">
          View audit log →
        </Link>
      </div>
    </div>
  );
}
