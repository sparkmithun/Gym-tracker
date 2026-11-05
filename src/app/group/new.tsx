import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch } from 'react-native';
import { Button, Card, Input, Row, T, styles } from '@/components/ui';
import { createGroup } from '@/features/social/api';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

export default function NewGroup() {
  const userId = useUserId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const valid = name.trim().length >= 3;

  const save = async () => {
    setSaving(true);
    try {
      const id = await createGroup(userId, { name, description, isPublic });
      router.replace(`/group/${id}`);
    } catch (e) {
      Alert.alert('Could not create group', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input label="Group name" value={name} onChangeText={setName} maxLength={40} placeholder="e.g. Iron Paradise Gym" autoFocus />
      <Input
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        maxLength={280}
        multiline
        placeholder="Who is it for?"
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <Card style={{ gap: space.xs }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">Public</T>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary }} />
        </Row>
        <T v="small" dim>
          {isPublic ? 'Anyone can find and join it from Discover.' : 'Hidden — people join only with the invite code.'}
        </T>
      </Card>
      <Button title="Create group" onPress={save} loading={saving} disabled={!valid} />
    </ScrollView>
  );
}
