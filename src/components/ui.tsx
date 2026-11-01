import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, space } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

type Variant = keyof typeof font;

export function T({ v = 'body', dim, muted, color, style, ...rest }: TextProps & { v?: Variant; dim?: boolean; muted?: boolean; color?: string }) {
  return (
    <Text
      style={[font[v], { color: color ?? (muted ? colors.textMuted : dim ? colors.textDim : colors.text) }, style]}
      {...rest}
    />
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, small, style }: ButtonProps) {
  const bg = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
    danger: colors.danger,
    success: colors.success,
  }[variant];
  const fg = variant === 'ghost' ? colors.primary : variant === 'secondary' ? colors.text : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />}
          <Text style={[small ? font.small : font.h3, { color: fg, fontWeight: '700' }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = colors.textDim, size = 22, label }: { name: IconName; onPress?: () => void; color?: string; size?: number; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[font.small, { color: active ? '#fff' : colors.textDim, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label && <T v="small" dim>{label}</T>}
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm }}>
      <T v="h3">{title}</T>
      {action}
    </Row>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.sm }}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <T v="h3">{title}</T>
      {body && <T dim style={{ textAlign: 'center' }}>{body}</T>}
      {action}
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="tiny" muted>{label.toUpperCase()}</T>
      <T v="h3">{value}</T>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 120, gap: space.md },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
});
