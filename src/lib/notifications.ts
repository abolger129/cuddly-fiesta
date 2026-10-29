import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Show notifications that arrive while the app is open, too.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let currentToken: string | null = null;

/**
 * Ask for permission and save this device's push token, so the server can tell
 * this player when a round opens or a deadline is close. Push notifications
 * need a real device and a development or store build, not Expo Go or web.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Rounds',
      importance: AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('save_push_token', { t: token });
  if (!error) currentToken = token;
}

/** Stop sending this device notifications for the player who is signing out. */
export async function unregisterPushNotifications(): Promise<void> {
  if (!currentToken) return;
  await supabase.rpc('remove_push_token', { t: currentToken });
  currentToken = null;
}
