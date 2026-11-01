import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { colors, radius } from '@/theme';

type Props = {
  value: number | null;
  /** storage value -> text shown */
  toText: (v: number) => string;
  /** typed text -> storage value (undefined = invalid/blank) */
  fromText: (t: string) => number | undefined;
  placeholder?: string;
  keyboard?: 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
  onChange: (v: number | null) => void;
  completed?: boolean;
  label: string;
};

/**
 * Keeps its own text while typing (so "22." or lbs conversions don't fight the cursor)
 * and only re-syncs from props when the stored value changes from outside.
 */
export function NumberField({ value, toText, fromText, placeholder, keyboard = 'decimal-pad', onChange, completed, label }: Props) {
  const [text, setText] = useState(value == null ? '' : toText(value));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setText(value == null ? '' : toText(value));
  }, [value, toText]);

  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboard}
      selectTextOnFocus
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? '' : toText(value));
      }}
      onChangeText={(t) => {
        setText(t);
        const v = fromText(t);
        onChange(v === undefined ? null : v);
      }}
      style={[s.input, completed && s.completed]}
    />
  );
}

const s = StyleSheet.create({
  input: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  completed: { backgroundColor: 'transparent' },
});
