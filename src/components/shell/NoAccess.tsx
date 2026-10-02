import { Logo } from '@/components/ui/Logo';
import { buttonClass } from '@/components/ui/Button';
import { signOutAction } from '@/app/actions';

/** Shown to someone who can sign in (for example a website admin) but has no portal profile. */
export function NoAccess({ email }: { email: string }) {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo href={null} className="h-10 w-auto" />
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-[var(--shadow-panel)] md:p-8">
          <p className="t-eyebrow">Vachi Portal</p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-ink">Your portal access isn&apos;t set up yet</h1>
          <p className="mt-3 text-ink-2">
            You&apos;re signed in as <span className="font-medium text-ink">{email}</span>, but this account hasn&apos;t been added to the portal. Ask HR to
            invite you from the Employees page, then sign in again.
          </p>
          <form action={signOutAction} className="mt-6">
            <button type="submit" className={buttonClass('secondary', 'md', 'w-full')}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
