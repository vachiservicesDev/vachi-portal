'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export type NavItem = { href: string; label: string; badge?: string; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Groups({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  // The deepest matching item wins, so /admin/training/summaries doesn't also light up "Training".
  const all = groups.flatMap((g) => g.items);
  const active = all
    .filter((item) => isActive(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="grid gap-5">
      {groups.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && <p className="t-label mb-1.5 px-4 text-muted">{group.label}</p>}
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const current = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={`flex min-h-11 items-center justify-between gap-3 rounded-r-md border-l-2 px-4 text-[0.9375rem] transition-colors ${
                      current
                        ? 'border-navy-700 bg-navy-50 font-semibold text-navy-700'
                        : 'border-transparent text-ink-2 hover:border-line-strong hover:bg-white hover:text-ink'
                    }`}
                  >
                    {item.label}
                    {item.badge && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-700/20">
                        <span className="sr-only">, </span>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Left navigation on large screens; a "Menu" disclosure on phones and tablets (works without JavaScript). */
export function AppNav({ groups, label }: { groups: NavGroup[]; label: string }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const current = groups.flatMap((g) => g.items).find((i) => isActive(pathname, i));

  return (
    <>
      <nav aria-label={label} className="hidden lg:block">
        <div className="sticky top-24">
          <Groups groups={groups} pathname={pathname} />
        </div>
      </nav>
      <details ref={menu} className="group rounded-lg border border-line bg-white lg:hidden">
        <summary className="flex min-h-12 list-none items-center justify-between gap-3 px-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            Menu
            {current && <span className="truncate font-normal text-muted">· {current.label}</span>}
          </span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 transition-transform group-open:rotate-180">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <nav aria-label={label} className="border-t border-line py-3 pr-3">
          <Groups groups={groups} pathname={pathname} />
        </nav>
      </details>
    </>
  );
}
