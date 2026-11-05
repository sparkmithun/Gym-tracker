import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-2">
      <h2 className="text-base font-bold">{children}</h2>
      {aside && <div className="text-sm text-dim">{aside}</div>}
    </div>
  );
}

/** A headline number with a label and an optional sub-line. */
export function Tile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="mt-1 text-sm text-dim">{sub}</p>}
    </Card>
  );
}

export function Progress({ value, max, color = 'var(--primary)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-alt" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-dim">{children}</p>;
}
