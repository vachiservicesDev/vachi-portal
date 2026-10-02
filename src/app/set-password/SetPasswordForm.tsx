'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { Alert } from '@/components/ui/ui';

const MIN = 10;

export function SetPasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const next: Record<string, string> = {};
    if (password.length < MIN) next.password = `Use at least ${MIN} characters.`;
    else if (confirm !== password) next.confirm = "The two passwords don't match.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(
        /different from the old/i.test(updateError.message)
          ? 'Choose a password you haven’t used here before.'
          : /weak|pwned|leaked/i.test(updateError.message)
            ? 'That password is too easy to guess or has appeared in a data breach. Choose a different one.'
            : updateError.message,
      );
      return;
    }
    window.location.assign('/');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5" noValidate>
      {error && <Alert>{error}</Alert>}
      <TextField
        name="password"
        label="New password"
        type="password"
        required
        hideOptional
        autoComplete="new-password"
        hint={`At least ${MIN} characters. A short phrase is easier to remember than random symbols.`}
        errors={errors}
      />
      <TextField name="confirm" label="Confirm new password" type="password" required hideOptional autoComplete="new-password" errors={errors} />
      <Button type="submit" size="lg" busy={busy} busyLabel="Saving" className="w-full">
        Save password and continue
      </Button>
    </form>
  );
}
