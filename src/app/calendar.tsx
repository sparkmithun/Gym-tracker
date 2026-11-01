import { addMonths, eachDayOfInterval, endOfMonth, format, getISODay, isToday, startOfMonth } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, IconButton, Row, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { workoutDays } from '@/features/stats/data';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Calendar() {
  const userId = useUserId();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const end = endOfMonth(month);
  const { data: days } = useLiveQuery(() => workoutDays(userId, month, addMonths(month, 1)), [userId, month.getTime()]);

  const cells: (Date | null)[] = [
    ...Array.from({ length: getISODay(month) - 1 }, () => null),
    ...eachDayOfInterval({ start: month, end }),
  ];
  const count = days ? [...days.values()].reduce((n, ids) => n + ids.length, 0) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton name="chevron-back" label="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
          <View style={{ alignItems: 'center' }}>
            <T v="h3">{format(month, 'MMMM yyyy')}</T>
            <T v="small" dim>{count} workout{count === 1 ? '' : 's'}</T>
          </View>
          <IconButton name="chevron-forward" label="Next month" onPress={() => setMonth(addMonths(month, 1))} />
        </Row>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((d, i) => <T key={i} v="tiny" muted style={{ width: `${100 / 7}%`, textAlign: 'center' }}>{d}</T>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const ids = days?.get(format(d, 'yyyy-MM-dd'));
            return (
              <Pressable
                key={i}
                disabled={!ids}
                onPress={() => ids && router.push(`/workout/${ids[0]}`)}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
                accessibilityLabel={`${format(d, 'd MMMM')}${ids ? `, ${ids.length} workout` : ''}`}
              >
                <View style={{
                  flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: ids ? colors.primary : 'transparent',
                  borderWidth: isToday(d) ? 1 : 0, borderColor: colors.textDim,
                }}>
                  <T v="small" color={ids ? '#fff' : colors.textDim} style={{ fontWeight: ids ? '700' : '400' }}>{format(d, 'd')}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}
