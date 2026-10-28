import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { IBMPlexMono_400Regular, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Brand, Colors, Fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registerForPushNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

const navigationThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Brand,
      background: Colors.light.background,
      card: Colors.light.background,
      text: Colors.light.text,
      border: Colors.light.rule,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Brand,
      background: Colors.dark.background,
      card: Colors.dark.background,
      text: Colors.dark.text,
      border: Colors.dark.rule,
    },
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
    Caveat_600SemiBold,
  });

  // Keep the splash screen up until the fonts are ready. If they fail, fall back to system fonts.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navigationThemes[colorScheme === 'dark' ? 'dark' : 'light']}>
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
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: Fonts.bold },
          headerLargeTitleStyle: { fontFamily: Fonts.display },
        }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" options={{ title: 'The Gauntlet' }} />
          <Stack.Screen name="stats" options={{ title: 'Stats' }} />
          <Stack.Screen name="profile" options={{ title: 'Settings', presentation: 'modal' }} />
          <Stack.Screen name="group/new" options={{ title: 'New league', presentation: 'modal' }} />
          <Stack.Screen name="group/join" options={{ title: 'Join a league', presentation: 'modal' }} />
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
