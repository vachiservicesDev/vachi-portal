import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { loadSession } from '@/lib/auth/session';
import { SetPasswordForm } from './SetPasswordForm';

export const metadata: Metadata = { title: 'Choose your password' };

export default async function SetPasswordPage() {
  const session = await loadSession();
  if (!session) redirect('/login?reason=link-invalid');
  return (
    <AuthCard title="Choose your password" lead={<>You&apos;re setting the password for <span className="font-medium text-ink">{session.email}</span>.</>}>
      <SetPasswordForm />
    </AuthCard>
  );
}
