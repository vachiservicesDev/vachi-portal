import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" lead="Enter your work email and we'll send you a link to choose a new password.">
      <ForgotForm />
      <p className="mt-5 text-sm">
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
