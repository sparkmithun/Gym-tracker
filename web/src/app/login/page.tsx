import { Suspense } from 'react';
import { GoogleButton } from './GoogleButton';

async function SignInError({ searchParams }: { searchParams: PageProps<'/login'>['searchParams'] }) {
  const { error } = await searchParams;
  return error ? <p className="mt-4 text-sm text-danger">Sign-in didn&apos;t complete. Please try again.</p> : null;
}

export default function Login({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl">🏋️</div>
        <h1 className="text-2xl font-extrabold">Spark Lift</h1>
        <p className="mb-8 mt-2 text-dim">
          Your workouts, steps, sports and calories — synced from the app. Sign in with the same Google account you use on your phone.
        </p>
        <GoogleButton />
        <Suspense>
          <SignInError searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
