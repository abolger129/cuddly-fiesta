import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORY_IDEAS, pickCategory } from '@/lib/categories';

const TICKS = 14;
const TICK_MS = 70;

/** Spins through category ideas for a moment, then adds the one it lands on. */
export function CategoryRoulette({ taken, onPick }: { taken: string[]; onPick: (category: string) => void }) {
  const [showing, setShowing] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function spin() {
    let tick = 0;
    timer.current = setInterval(() => {
      tick += 1;
      if (tick < TICKS) {
        setShowing(CATEGORY_IDEAS[Math.floor(Math.random() * CATEGORY_IDEAS.length)]);
        return;
      }
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setShowing(null);
      onPick(pickCategory(taken));
    }, TICK_MS);
  }

  return (
    <View style={styles.wrap}>
      {showing && (
        <ThemedText type="hand" themeColor="accent" numberOfLines={1} style={styles.showing}>
          {showing}
        </ThemedText>
      )}
      <Button title={showing ? 'Spinning…' : 'Spin for a category'} variant="secondary" onPress={spin} disabled={!!showing} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  showing: {
    textAlign: 'center',
  },
});
