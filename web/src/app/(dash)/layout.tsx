import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Nav, NavLinks } from '@/components/Nav';
import { getProfile } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';

// The shell (logo, nav) is static; who's signed in streams in. Pages stream via loading.tsx.
async function UserBadge() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');
  return (
    <p className="text-sm text-dim">
      {profile.display_name ?? profile.username ?? 'Athlete'}
      {profile.username ? ` · @${profile.username}` : ''}
    </p>
  );
}

export default function DashLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl">🏋️</span>
          <div>
            <p className="font-extrabold leading-tight">Spark Lift</p>
            <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
              <UserBadge />
            </Suspense>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-full px-4 py-2 text-sm text-dim hover:bg-surface-alt hover:text-text">Sign out</button>
        </form>
      </header>
      <Suspense fallback={<NavLinks path={null} />}>
        <Nav />
      </Suspense>
      <main className="mt-6">{children}</main>
    </div>
  );
}
