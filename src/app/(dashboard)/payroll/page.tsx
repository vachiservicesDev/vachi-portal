'use client';

import { useEffect, useState } from 'react';

interface Stub {
  id: string;
  grossPay: string;
  netPay: string;
  payDate: string;
  payPeriodStart: string;
  payPeriodEnd: string;
}

export default function PayrollPage() {
  const [stubs, setStubs] = useState<Stub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payroll/stubs/me')
      .then((res) => res.json())
      .then((data) => {
        setStubs(data.stubs);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">My Pay Stubs</h1>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {stubs.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {s.payPeriodStart} – {s.payPeriodEnd} (paid {s.payDate})
            </span>
            <span className="text-gray-500">
              gross ${s.grossPay} · net ${s.netPay}
            </span>
          </li>
        ))}
        {stubs.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No pay stubs yet.</li>}
      </ul>
    </div>
  );
}
