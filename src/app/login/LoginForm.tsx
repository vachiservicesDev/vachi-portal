'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again, or reset your password.";
  if (/email not confirmed/i.test(message)) return 'This account hasn’t been confirmed yet. Open the invite link HR emailed you first.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute, then try again.';
  if (/fetch|network/i.test(message)) return "Couldn't reach the portal. Check your connection and try again.";
  return message;
}

export function LoginForm({ next }: { next: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // If Supabase's redirect allow-list doesn't include /auth/confirm, invite and reset links fall
  // back to the site root and end up here with the session in the URL. Finish the job instead
  // of leaving the person on a sign-in form they have no password for.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);
    const type = hash.get('type') ?? search.get('type');
    const setPassword = type === 'invite' || type === 'recovery';
    const target = encodeURIComponent(setPassword ? '/set-password' : next ?? '/');
    if (hash.get('access_token') || hash.get('error')) {
      window.location.replace(`/auth/confirm?next=${target}${window.location.hash}`);
    } else if (search.get('code') || search.get('token_hash')) {
      search.set('next', setPassword ? '/set-password' : next ?? '/');
      window.location.replace(`/auth/confirm?${search.toString()}`);
    }
  }, [next]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });
    if (signInError) {
      setBusy(false);
      setError(friendly(signInError.message));
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    // A full navigation, so the server sees the new session cookie and routes by role.
    window.location.assign(next ?? '/');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5" noValidate={false}>
      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-danger-700/30 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700 focus:outline-none">
          {error}
        </p>
      )}
      <TextField name="email" label="Work email" type="email" required hideOptional autoComplete="email" inputMode="email" />
      <TextField name="password" label="Password" type="password" required hideOptional autoComplete="current-password" />
      <Button type="submit" size="lg" busy={busy} busyLabel="Signing in" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
