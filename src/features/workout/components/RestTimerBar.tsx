import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useActiveWorkout } from '@/store/activeWorkout';
import { colors, radius, space } from '@/theme';
import { formatDuration } from '@/utils/units';

/** Countdown docked at the bottom of the live workout screen. */
export function RestTimerBar() {
  const rest = useActiveWorkout((s) => s.rest);
  const adjust = useActiveWorkout((s) => s.adjustRest);
  const skip = useActiveWorkout((s) => s.skipRest);
  const insets = useSafeAreaInsets();
  const now = useNow(250, !!rest);
  const buzzed = useRef<number | null>(null);

  useEffect(() => {
    if (rest && now >= rest.endsAt && buzzed.current !== rest.endsAt) {
      buzzed.current = rest.endsAt;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      skip();
    }
  }, [now, rest, skip]);

  if (!rest) return null;
  const remaining = Math.max(0, (rest.endsAt - now) / 1000);
  const progress = rest.total ? remaining / rest.total : 0;

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + space.sm }]}>
      <View style={s.track}>
        <View style={[s.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={s.row}>
        <Button title="-15" small variant="secondary" onPress={() => adjust(-15)} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <T v="tiny" muted>REST</T>
          <T v="h1" accessibilityLiveRegion="polite">{formatDuration(remaining)}</T>
        </View>
        <Button title="+15" small variant="secondary" onPress={() => adjust(15)} />
        <Button title="Skip" small onPress={skip} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
  track: { height: 4, backgroundColor: colors.surfaceAlt, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
