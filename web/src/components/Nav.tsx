'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/workouts', label: 'Workouts' },
  { href: '/activity', label: 'Activity & food' },
  { href: '/compete', label: 'Compete' },
] as const;

/** Active tab follows the URL. */
export function Nav() {
  return <NavLinks path={usePathname()} />;
}

/** Also rendered with no path as the static fallback while the URL is read. */
export function NavLinks({ path }: { path: string | null }) {
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {LINKS.map((l) => {
        const active = path !== null && (l.href === '/' ? path === '/' : path.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              active ? 'bg-primary text-white' : 'text-dim hover:bg-surface-alt hover:text-text'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
