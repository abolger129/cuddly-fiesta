import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registerForPushNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) registerForPushNotifications().catch(() => {});
  }, [userId]);


  // Keep the splash screen up until we know whether someone is signed in.
  if (isLoading) return null;

  return (
    <>
      <Stack>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" options={{ title: 'The Gauntlet' }} />
          <Stack.Screen name="profile" options={{ title: 'Settings', presentation: 'modal' }} />
          <Stack.Screen name="group/new" options={{ title: 'New group', presentation: 'modal' }} />
          <Stack.Screen name="group/join" options={{ title: 'Join a group', presentation: 'modal' }} />
          <Stack.Screen name="group/[id]" options={{ title: '' }} />
          <Stack.Screen name="round/[id]" options={{ title: '' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {Platform.OS !== 'web' && !!session && <OpenTappedNotification />}
      <AnimatedSplashOverlay />
    </>
  );
}

/** Tapping a notification opens the round it is about. */
function OpenTappedNotification() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push(url as never);
      Notifications.clearLastNotificationResponseAsync();
    }
  }, [response]);
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
