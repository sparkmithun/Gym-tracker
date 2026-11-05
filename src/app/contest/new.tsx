import { addDays, format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { Button, Card, Chip, Input, Row, T, styles } from '@/components/ui';
import { createContest, type Metric } from '@/features/social/api';
import { METRIC_LABEL } from '@/features/social/components';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

const LENGTHS = [
  { days: 1, label: '1 day' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function NewContest() {
  const userId = useUserId();
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState<Metric>('points');
  const [days, setDays] = useState(7);
  const [startsIn, setStartsIn] = useState(0);
  const [isPublic, setIsPublic] = useState(!groupId);
  const [saving, setSaving] = useState(false);
  const valid = title.trim().length >= 3;

  const start = addDays(new Date(), startsIn);
  const end = addDays(start, days - 1);

  const save = async () => {
    setSaving(true);
    try {
      const id = await createContest(userId, { title, description, metric, days, startsIn, isPublic, groupId });
      router.replace(`/contest/${id}`);
    } catch (e) {
      Alert.alert('Could not create contest', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {groupName && <T dim>For group: {groupName}</T>}
      <Input label="Title" value={title} onChangeText={setTitle} maxLength={60} placeholder="e.g. November Leg Day Showdown" autoFocus />
      <Input
        label="Rules / description (optional)"
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <View style={{ gap: space.sm }}>
        <T v="small" dim>Winner is whoever has the most…</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <Chip key={m} label={METRIC_LABEL[m]} active={metric === m} onPress={() => setMetric(m)} />
          ))}
        </Row>
      </View>

      <View style={{ gap: space.sm }}>
        <T v="small" dim>Length</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {LENGTHS.map((l) => <Chip key={l.days} label={l.label} active={days === l.days} onPress={() => setDays(l.days)} />)}
        </Row>
        <T v="small" dim>Starts</T>
        <Row>
          <Chip label="Today" active={startsIn === 0} onPress={() => setStartsIn(0)} />
          <Chip label="Tomorrow" active={startsIn === 1} onPress={() => setStartsIn(1)} />
          <Chip label="Next week" active={startsIn === 7} onPress={() => setStartsIn(7)} />
        </Row>
        <T v="small" color={colors.primary}>{format(start, 'EEE d MMM')} – {format(end, 'EEE d MMM yyyy')}</T>
      </View>

      {!groupId && (
        <Card style={{ gap: space.xs }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3">Public</T>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary }} />
          </Row>
          <T v="small" dim>{isPublic ? 'Anyone can find and join it.' : 'Only people with the invite code can join.'}</T>
        </Card>
      )}

      <Button title="Create contest" onPress={save} loading={saving} disabled={!valid} />
      <T v="tiny" muted style={{ textAlign: 'center' }}>You&apos;re entered automatically. Share the invite code from the contest page.</T>
    </ScrollView>
  );
}
