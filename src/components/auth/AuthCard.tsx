import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://vachiservices.com';

/** The centred card used by sign-in, password reset and set-password, matching the website's admin sign-in. */
export function AuthCard({ title, lead, children, footer }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="grid-bg flex flex-1 items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo href={null} priority className="h-10 w-auto" />
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-[var(--shadow-panel)] md:p-8">
          <p className="t-eyebrow">Vachi Portal</p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-ink">{title}</h1>
          {lead && <p className="mt-2 text-ink-2">{lead}</p>}
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {footer}
          {footer && ' '}
          <Link href={WEBSITE_URL} className="link">
            Back to vachiservices.com
          </Link>
        </p>
      </div>
    </main>
  );
}
