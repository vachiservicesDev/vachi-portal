'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Partner {
  id: string;
  email: string;
  role: string;
}

export default function MessagesPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/messages/threads')
      .then((res) => res.json())
      .then((data) => {
        setPartners(data.partners);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Messages</h1>

      <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {partners.map((p) => (
          <li key={p.id}>
            <Link href={`/messages/${p.id}`} className="block px-4 py-3 text-sm hover:bg-gray-50">
              {p.email} <span className="text-gray-500">({p.role})</span>
            </Link>
          </li>
        ))}
        {partners.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No one to message yet.</li>}
      </ul>
    </div>
  );
}
