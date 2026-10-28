import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Download any new over-the-air update (published with `eas update`) when the
 * app comes back to the foreground. The app already checks once when it starts;
 * this also catches phones that leave the app running for days. A downloaded
 * update is used the next time the app is opened from scratch, so nobody is
 * thrown out of a half-finished ranking.
 */
export function useBackgroundUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => {});
    });
    return () => subscription.remove();
  }, []);
}
