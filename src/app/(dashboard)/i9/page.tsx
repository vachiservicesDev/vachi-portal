'use client';

import { useEffect, useState } from 'react';

interface I9Record {
  id: string;
  status: string;
}

export default function EmployeeI9Page() {
  const [record, setRecord] = useState<I9Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citizenshipStatus, setCitizenshipStatus] = useState('us_citizen');

  useEffect(() => {
    fetch('/api/i9/me')
      .then((res) => res.json())
      .then((data) => {
        setRecord(data.record);
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!record) return;
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch(`/api/i9/records/${record.id}/section1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to submit');
      return;
    }
    setRecord({ ...record, status: 'section2_pending' });
  }

  if (loading) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  if (!record) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Form I-9</h1>
        <p className="mt-4 text-sm text-gray-500">No I-9 has been started for you yet.</p>
      </div>
    );
  }

  if (record.status !== 'section1_pending') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Form I-9</h1>
        <p className="mt-4 text-sm text-gray-500">
          You&apos;ve completed Section 1. Status: {record.status}.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Form I-9 — Section 1</h1>
      <p className="mt-1 text-sm text-gray-500">Employee Information and Attestation</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input name="legalFirstName" required placeholder="Legal first name" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="legalLastName" required placeholder="Legal last name" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <input name="otherLastNames" placeholder="Other last names used (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input name="address" required placeholder="Address" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input name="dateOfBirth" type="date" required className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="ssn" placeholder="SSN (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="email" type="email" placeholder="Email" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="phone" placeholder="Phone" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <select
          name="citizenshipStatus"
          value={citizenshipStatus}
          onChange={(e) => setCitizenshipStatus(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="us_citizen">A citizen of the United States</option>
          <option value="noncitizen_national">A noncitizen national of the United States</option>
          <option value="lawful_permanent_resident">A lawful permanent resident</option>
          <option value="alien_authorized_to_work">An alien authorized to work</option>
        </select>

        {citizenshipStatus !== 'us_citizen' && citizenshipStatus !== 'noncitizen_national' && (
          <input name="alienRegistrationNumber" placeholder="Alien Registration Number / USCIS Number" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        )}
        {citizenshipStatus === 'alien_authorized_to_work' && (
          <>
            <input name="workAuthorizationExpiration" type="date" placeholder="Work authorization expiration" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input name="i94AdmissionNumber" placeholder="Form I-94 Admission Number (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <input name="foreignPassportNumber" placeholder="Foreign passport number (optional)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <input name="foreignPassportCountry" placeholder="Passport country of issuance (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </>
        )}

        <div className="border-t border-gray-200 pt-3">
          <label htmlFor="signedByName" className="block text-sm font-medium text-gray-700">
            Type your full legal name to attest, under penalty of perjury, that the above is true and correct
          </label>
          <input id="signedByName" name="signedByName" required placeholder="Full legal name" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {busy ? 'Submitting…' : 'Submit Section 1'}
        </button>
      </form>
    </div>
  );
}
