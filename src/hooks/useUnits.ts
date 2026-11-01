import { useMemo } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import {
  formatVolume,
  toDisplayDistance,
  toDisplayWeight,
  type DistanceUnit,
  type WeightUnit,
} from '@/utils/units';

export function useUnits() {
  const { profile } = useAuth();
  const weight: WeightUnit = profile?.unit_weight ?? 'kg';
  const distance: DistanceUnit = profile?.unit_distance ?? 'km';
  return useMemo(
    () => ({
      weight,
      distance,
      restDefault: profile?.default_rest_seconds ?? 90,
      w: (kg: number | null | undefined) => (kg == null ? '' : `${toDisplayWeight(kg, weight)}`),
      wu: (kg: number | null | undefined) => (kg == null ? '-' : `${toDisplayWeight(kg, weight)} ${weight}`),
      d: (m: number | null | undefined) => (m == null ? '' : `${toDisplayDistance(m, distance)}`),
      du: (m: number | null | undefined) => (m == null ? '-' : `${toDisplayDistance(m, distance)} ${distance}`),
      volume: (kg: number) => formatVolume(kg, weight),
    }),
    [weight, distance, profile?.default_rest_seconds],
  );
}
