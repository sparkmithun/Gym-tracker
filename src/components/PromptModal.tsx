import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { Button, Input, Row, T } from './ui';

export type PromptRequest = { title: string; initial?: string; confirm?: string; onSubmit: (value: string) => void } | null;

/** Cross-platform text prompt (Alert.prompt only exists on iOS). */
export function PromptModal({ request, onClose }: { request: PromptRequest; onClose: () => void }) {
  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={onClose}>
      {/* keyed so every new request starts from its own initial value */}
      {request && <PromptBody key={`${request.title}:${request.initial ?? ''}`} request={request} onClose={onClose} />}
    </Modal>
  );
}

function PromptBody({ request, onClose }: { request: NonNullable<PromptRequest>; onClose: () => void }) {
  const [value, setValue] = useState(request.initial ?? '');

  const submit = () => {
    if (!value.trim()) return;
    request.onSubmit(value.trim());
    onClose();
  };

  return (
    <KeyboardAvoidingView style={s.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.box}>
        <T v="h3">{request.title}</T>
        <Input value={value} onChangeText={setValue} autoFocus onSubmitEditing={submit} returnKeyType="done" maxLength={60} />
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title="Cancel" variant="ghost" small onPress={onClose} />
          <Button title={request.confirm ?? 'Save'} small onPress={submit} disabled={!value.trim()} />
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: 'rgba(0,0,0,0.6)' },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
});
