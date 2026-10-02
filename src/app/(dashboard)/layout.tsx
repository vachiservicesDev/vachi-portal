import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { buttonClass } from '@/components/ui/Button';
import { AppNav, type NavGroup } from '@/components/shell/AppNav';
import { NoAccess } from '@/components/shell/NoAccess';
import { homeFor, requireSession } from '@/lib/auth/session';
import { signOutAction } from '../actions';

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://vachiservices.com';

function adminNav(unread: number): NavGroup[] {
  return [
    { items: [{ href: '/admin', label: 'Dashboard', exact: true }] },
    {
      label: 'People',
      items: [
        { href: '/admin/employees', label: 'Employees' },
        { href: '/admin/onboarding', label: 'Onboarding' },
      ],
    },
    {
      label: 'Compliance',
      items: [
        { href: '/admin/i9', label: 'Form I-9 and E-Verify' },
        { href: '/admin/immigration', label: 'Visa expirations' },
        { href: '/admin/stem-opt', label: 'STEM OPT plans' },
        { href: '/admin/paf', label: 'H-1B public access files' },
        { href: '/admin/green-card', label: 'Green card cases' },
      ],
    },
    {
      label: 'Work and pay',
      items: [
        { href: '/admin/timesheets', label: 'Timesheets' },
        { href: '/admin/payroll', label: 'Payroll' },
        { href: '/admin/training', label: 'Training' },
        { href: '/admin/training/summaries', label: 'Weekly summaries' },
        { href: '/admin/reviews', label: 'Performance reviews' },
      ],
    },
    {
      label: 'Communication',
      items: [
        { href: '/messages', label: 'Messages' },
        { href: '/notifications', label: 'Notifications', badge: unread ? `${unread} new` : undefined },
        { href: '/admin/audit-log', label: 'Audit log' },
      ],
    },
  ];
}

function employeeNav(unread: number): NavGroup[] {
  return [
    { items: [{ href: '/dashboard', label: 'Home', exact: true }] },
    {
      label: 'Getting started',
      items: [
        { href: '/onboarding', label: 'Onboarding' },
        { href: '/i9', label: 'Form I-9' },
      ],
    },
    {
      label: 'Work and pay',
      items: [
        { href: '/timesheets', label: 'Timesheets' },
        { href: '/payroll', label: 'Pay stubs' },
        { href: '/training', label: 'Training' },
        { href: '/training/summaries', label: 'Weekly summaries' },
        { href: '/reviews', label: 'Performance reviews' },
      ],
    },
    {
      label: 'Immigration',
      items: [
        { href: '/stem-opt', label: 'STEM OPT plan' },
        { href: '/green-card', label: 'Green card' },
      ],
    },
    {
      label: 'Communication',
      items: [
        { href: '/messages', label: 'Messages' },
        { href: '/notifications', label: 'Notifications', badge: unread ? `${unread} new` : undefined },
      ],
    },
  ];
}

/** The signed-in portal: top bar, navigation and content. API routes still check access themselves. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (!session.profile) return <NoAccess email={session.email} />;
  // Sessions survive deactivation, so this is checked on every page load, not just at sign-in.
  if (!session.profile.isActive) redirect('/auth/signout?reason=deactivated');

  const isAdmin = session.profile.role === 'admin';
  const groups = isAdmin ? adminNav(session.unread) : employeeNav(session.unread);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow-[var(--shadow-float)]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container-page flex min-h-16 items-center justify-between gap-4 py-2 lg:min-h-[4.75rem]">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={homeFor(session.profile.role)} aria-label="Vachi Portal home" className="inline-flex shrink-0 rounded-sm">
              <Logo href={null} priority className="h-8 w-auto sm:h-9" />
            </Link>
            <span className="t-label hidden rounded-sm bg-navy-50 px-2 py-1 text-navy-700 sm:inline">{isAdmin ? 'Portal admin' : 'Portal'}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <a href={WEBSITE_URL} target="_blank" rel="noopener" className="link hidden min-h-11 items-center text-sm md:inline-flex">
              Website<span aria-hidden="true">&nbsp;↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Link
              href="/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-navy-50 hover:text-navy-700"
              aria-label={session.unread ? `Notifications, ${session.unread} unread` : 'Notifications'}
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2.75a4.75 4.75 0 0 0-4.75 4.75v2.4c0 .5-.15 1-.43 1.42L3.75 13h12.5l-1.07-1.68a2.6 2.6 0 0 1-.43-1.42V7.5A4.75 4.75 0 0 0 10 2.75ZM8 15.5a2 2 0 0 0 4 0"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {session.unread > 0 && (
                <span aria-hidden="true" className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-navy-700 px-1 text-center text-[0.6875rem] font-semibold leading-5 text-white">
                  {session.unread > 9 ? '9+' : session.unread}
                </span>
              )}
            </Link>
            <div className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
              <span className="max-w-48 truncate text-sm font-medium text-ink">{session.displayName}</span>
              <span className="max-w-48 truncate text-xs text-muted">{session.email}</span>
            </div>
            <form action={signOutAction}>
              <button type="submit" className={buttonClass('ghost', 'md', 'px-3')}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="container-page grid flex-1 gap-6 py-6 md:py-8 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <AppNav groups={groups} label={isAdmin ? 'Portal admin' : 'Portal'} />
        <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none">
          {children}
        </main>
      </div>
      <footer className="border-t border-line bg-white">
        <div className="container-page flex flex-col gap-2 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vachi Services LLC. For employees and authorized staff only.</p>
          <p>
            Need help? <a className="link" href="mailto:info@vachiservices.com">info@vachiservices.com</a>
          </p>
        </div>
      </footer>
    </>
  );
}
