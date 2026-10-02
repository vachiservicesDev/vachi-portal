'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/AuthCard';
import { Loading } from '@/components/ui/ui';

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/**
 * Landing page for invite and password-reset links. Supabase sends people here with either a
 * ?code (reset started in this browser), a ?token_hash (custom email templates) or #access_token
 * (invites created by an admin). Each is turned into a session, then we move on to `next`.
 */
function Confirm() {
  const params = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const supabase = createClient();
    const next = safeNext(params.get('next'));
    const fail = () => window.location.replace('/login?reason=link-invalid');

    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.get('error')) return fail();
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      let ok = false;
      if (hash.get('access_token') && hash.get('refresh_token')) {
        const { error } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
        ok = !error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        ok = !error;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'invite' | 'recovery' | 'email' | 'magiclink' });
        ok = !error;
      } else {
        // The client may already have picked the session up from the URL.
        ok = !!(await supabase.auth.getSession()).data.session;
      }
      if (!ok) return fail();
      window.location.replace(next);
    })();
  }, [params]);

  return <Loading label="Signing you in" />;
}

export default function ConfirmPage() {
  return (
    <AuthCard title="Signing you in" lead="One moment while we check your link.">
      <div className="mt-6">
        <Suspense>
          <Confirm />
        </Suspense>
      </div>
    </AuthCard>
  );
}
