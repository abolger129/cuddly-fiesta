import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { Doodle } from '@/components/avatar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_DOODLE_LENGTH, strokesToPath, type Point } from '@/lib/doodle';

type DoodlePadProps = {
  /** The doodle drawn so far, as saved. */
  initial: string | null;
  /** Called with the new path data, or null when the pad is cleared. */
  onChange: (path: string | null) => void;
  size?: number;
};

/** A square to draw your avatar on with a finger. Undo takes back the last stroke. */
export function DoodlePad({ initial, onChange, size = 240 }: DoodlePadProps) {
  const theme = useTheme();
  // A saved doodle can't be split back into strokes, so it stays underneath as a starting point.
  const [base, setBase] = useState(initial);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  // Touch events arrive faster than renders, so the handlers work from refs that mirror the state.
  const strokesRef = useRef<Point[][]>([]);
  const baseRef = useRef(initial);

  function update(next: Point[][], nextBase: string | null) {
    strokesRef.current = next;
    baseRef.current = nextBase;
    setStrokes(next);
    setBase(nextBase);
  }

  function emit() {
    const drawn = (baseRef.current ?? '') + strokesToPath(strokesRef.current, size);
    onChange(drawn ? drawn.slice(0, MAX_DOODLE_LENGTH) : null);
  }

  function addPoint(e: GestureResponderEvent, newStroke: boolean) {
    const point = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    const all = strokesRef.current;
    const last = all[all.length - 1];
    const next = newStroke || !last ? [...all, [point]] : [...all.slice(0, -1), [...last, point]];
    update(next, baseRef.current);
  }

  const live = strokesToPath(strokes, size);

  return (
    <View style={styles.wrap}>
      <View
        // Claim every touch on the pad so the screen doesn't scroll while drawing.
        onStartShouldSetResponder={() => true}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => addPoint(e, true)}
        onResponderMove={(e) => addPoint(e, false)}
        onResponderRelease={emit}
        accessibilityLabel="Drawing pad for your avatar"
        style={[
          styles.pad,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: theme.text,
            backgroundColor: theme.backgroundElement,
          },
        ]}>
        {base && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Doodle path={base} size={size} color={theme.text} />
          </View>
        )}
        <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none" style={StyleSheet.absoluteFill}>
          {live ? (
            <Path d={live} fill="none" stroke={theme.text} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
      </View>
      <View style={styles.actions}>
        <Button
          title="Undo"
          variant="secondary"
          disabled={strokes.length === 0}
          onPress={() => {
            update(strokes.slice(0, -1), base);
            emit();
          }}
          style={styles.action}
        />
        <Button
          title="Clear"
          variant="secondary"
          disabled={strokes.length === 0 && !base}
          onPress={() => {
            update([], null);
            emit();
          }}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  pad: {
    borderWidth: 2,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  action: {
    flex: 1,
  },
});
