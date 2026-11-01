import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Ionicons, T, type IconName } from './ui';

export type SheetOption = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void };

/** Bottom action sheet — Android's Alert only supports 3 buttons, so menus use this instead. */
export function OptionsSheet({ visible, title, options, onClose }: { visible: boolean; title?: string; options: SheetOption[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}>
        {title && <T v="small" dim style={{ textAlign: 'center', marginBottom: space.sm }}>{title}</T>}
        {options.map((o) => (
          <Pressable
            key={o.label}
            accessibilityRole="button"
            style={({ pressed }) => [s.option, pressed && { backgroundColor: colors.surfaceAlt }]}
            onPress={() => {
              onClose();
              // let the sheet close before running (e.g. navigating or opening another modal)
              setTimeout(o.onPress, 150);
            }}
          >
            {o.icon && <Ionicons name={o.icon} size={20} color={o.destructive ? colors.danger : colors.textDim} />}
            <T color={o.destructive ? colors.danger : undefined}>{o.label}</T>
          </Pressable>
        ))}
        <Pressable style={[s.option, { justifyContent: 'center' }]} onPress={onClose} accessibilityRole="button">
          <T v="h3" dim>Cancel</T>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.md,
    paddingHorizontal: space.sm,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.md, borderRadius: radius.md },
});
