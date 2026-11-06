import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

/**
 * A scrolling screen with standard padding and optional pull-to-refresh.
 * Android draws edge to edge, so the window no longer shrinks for the keyboard; the
 * padding below lifts the scroll area above it so fields stay reachable. iOS does the
 * same through automaticallyAdjustKeyboardInsets, which copes with a header above the
 * screen where KeyboardAvoidingView would be off by the header's height.
 */
export function Screen({ children, refreshing = false, onRefresh }: ScreenProps) {
  const android = Platform.OS === 'android';
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView behavior={android ? 'padding' : undefined} enabled={android} style={styles.container}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
          }>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
