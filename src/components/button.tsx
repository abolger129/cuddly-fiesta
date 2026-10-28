import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, OnBrand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  /** onBrand and onBrandOutline are for buttons that sit on a cobalt background. */
  variant?: 'primary' | 'secondary' | 'onBrand' | 'onBrandOutline';
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const { background, text, border } = {
    primary: { background: theme.accent, text: theme.onAccent, border: undefined },
    secondary: { background: theme.backgroundElement, text: theme.text, border: undefined },
    onBrand: { background: OnBrand, text: Colors.light.text, border: undefined },
    onBrandOutline: { background: 'transparent', text: OnBrand, border: OnBrand },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        { backgroundColor: background },
        border && { borderColor: border, borderWidth: 2 },
        (state.pressed || isDisabled) && styles.dimmed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <ThemedText type="smallBold" style={{ color: text }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 6,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
});
