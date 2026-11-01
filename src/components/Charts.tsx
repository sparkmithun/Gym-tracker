import { format } from 'date-fns';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@/theme';
import { T } from './ui';

type Point = { x: number; y: number };

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
};

/** Line chart over time. x = epoch ms. */
export function LineChart({ points, height = 180, formatY = (v) => String(Math.round(v)) }: { points: Point[]; height?: number; formatY?: (v: number) => string }) {
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  if (points.length === 0) {
    return <T dim style={{ textAlign: 'center', paddingVertical: 40 }}>No data yet</T>;
  }
  const padL = 44, padR = 12, padT = 12, padB = 24;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const ys = points.map((p) => p.y);
  const maxY = niceMax(Math.max(...ys) * 1.05);
  const minY = Math.max(0, Math.floor(Math.min(...ys) * 0.9));
  const sx = (x: number) => padL + (maxX === minX ? (width - padL - padR) / 2 : ((x - minX) / (maxX - minX)) * (width - padL - padR));
  const sy = (y: number) => padT + (1 - (y - minY) / (maxY - minY || 1)) * (height - padT - padB);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ');
  const ticks = [minY, (minY + maxY) / 2, maxY];
  const sel = selected != null ? points[selected] : points[points.length - 1];

  return (
    <View onLayout={onLayout}>
      <T v="h2">{formatY(sel.y)}</T>
      <T v="small" dim>{format(new Date(sel.x), 'd MMM yyyy')}</T>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line key={t} x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke={colors.border} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`l${t}`} x={padL - 6} y={sy(t) + 4} fill={colors.textMuted} fontSize={10} textAnchor="end">
              {formatY(t)}
            </SvgText>
          ))}
          <SvgText x={padL} y={height - 6} fill={colors.textMuted} fontSize={10}>{format(new Date(minX), 'd MMM')}</SvgText>
          <SvgText x={width - padR} y={height - 6} fill={colors.textMuted} fontSize={10} textAnchor="end">{format(new Date(maxX), 'd MMM')}</SvgText>
          <Path d={d} stroke={colors.primary} strokeWidth={2.5} fill="none" />
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={selected === i ? 6 : 3.5}
              fill={selected === i ? colors.text : colors.primary}
              onPress={() => setSelected(i)}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

export function BarChart({ bars, height = 140, formatValue = (v) => String(Math.round(v)) }: { bars: { label: string; value: number }[]; height?: number; formatValue?: (v: number) => string }) {
  const [width, onLayout] = useWidth();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const padB = 20, padT = 16;
  const slot = bars.length ? width / bars.length : 0;
  const bw = Math.min(28, slot * 0.6);
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {bars.map((b, i) => {
            const h = (b.value / max) * (height - padB - padT);
            const x = i * slot + (slot - bw) / 2;
            return (
              <Rect key={i} x={x} y={height - padB - h} width={bw} height={Math.max(h, 2)} rx={4}
                fill={i === bars.length - 1 ? colors.primary : colors.primaryDim} />
            );
          })}
          {bars.map((b, i) => (
            <SvgText key={`v${i}`} x={i * slot + slot / 2} y={height - padB - (b.value / max) * (height - padB - padT) - 4}
              fill={colors.textDim} fontSize={10} textAnchor="middle">
              {b.value ? formatValue(b.value) : ''}
            </SvgText>
          ))}
          {bars.map((b, i) => (
            <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 5} fill={colors.textMuted} fontSize={9} textAnchor="middle">
              {b.label}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

/** Horizontal bars for muscle distribution. */
export function HBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="small">{label}</T>
        <T v="small" dim>{Math.round(value * 10) / 10} sets</T>
      </View>
      <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4 }}>
        <View style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, height: 8, backgroundColor: colors.primary, borderRadius: 4 }} />
      </View>
    </View>
  );
}
