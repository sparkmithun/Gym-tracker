'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Thin rounded bars, recessive grid, a hover tooltip on every bar. Series colours come from
// --series-1/--series-2 in globals.css (validated against the dark surface).

const axis = { stroke: 'var(--text-muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' },
  labelStyle: { color: 'var(--text-dim)' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

type Point = { label: string; [key: string]: string | number };

export function Bars({ data, dataKey, name, unit = '', goal, height = 200 }: { data: Point[]; dataKey: string; name: string; unit?: string; goal?: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" strokeOpacity={0.5} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...axis} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()}${unit}`, name]} />
        {goal ? <ReferenceLine y={goal} stroke="var(--success)" strokeDasharray="4 4" label={{ value: 'goal', fill: 'var(--success)', fontSize: 11, position: 'insideTopRight' }} /> : null}
        <Bar dataKey={dataKey} name={name} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Calories eaten vs burned per day: two series, one unit, so one axis. */
export function CaloriesBars({ data, height = 220 }: { data: Point[]; height?: number }) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-dim" aria-label="Legend">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} />Eaten</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} />Burned</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} />
          <Tooltip {...tooltipStyle} formatter={(v, n) => [`${Number(v).toLocaleString()} kcal`, n]} />
          <Bar dataKey="eaten" name="Eaten" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={12} />
          <Bar dataKey="burned" name="Burned" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
