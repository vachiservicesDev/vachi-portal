'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { Alert } from '@/components/ui/ui';

export function ForgotForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    setError(null);
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/set-password`,
    });
    setBusy(false);
    // Unknown addresses get the same answer, so the form can't be used to find out who works here.
    if (resetError && /rate limit|too many/i.test(resetError.message)) {
      setError('Too many requests. Wait a few minutes, then try again.');
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="mt-6">
        <Alert tone="success" title="Check your email">
          If <span className="font-medium">{sentTo}</span> has a portal account, a reset link is on its way. It works once and expires in an hour.
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
      {error && <Alert>{error}</Alert>}
      <TextField name="email" label="Work email" type="email" required hideOptional autoComplete="email" inputMode="email" />
      <Button type="submit" size="lg" busy={busy} busyLabel="Sending" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
