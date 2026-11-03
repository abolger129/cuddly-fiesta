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
import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
  usePathname,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Brand, Colors, Fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { feedbackBody, installGlobalErrorLogging, logError, sendFeedback, setErrorContext } from '@/lib/error-log';
import { usePendingWebInvite } from '@/lib/invite';
import { registerForPushNotifications } from '@/lib/notifications';
import { useBackgroundUpdates } from '@/lib/updates';

SplashScreen.preventAutoHideAsync();
installGlobalErrorLogging();

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
  const pathname = usePathname();
  useBackgroundUpdates();
  setErrorContext({ screen: pathname, userId });
  usePendingWebInvite(!!session);

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
          {/* Full screen with swipe-to-close off, so drawing never drags the screen away. */}
          <Stack.Screen
            name="avatar"
            options={{ title: 'Your avatar', presentation: 'fullScreenModal', gestureEnabled: false }}
          />
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

/**
 * If a screen hits a bug while drawing, show what went wrong with a way back
 * instead of closing the app. Plain Text and fixed colors on purpose: this has to
 * work even when the fonts, theme or sign-in are what broke.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [feedbackFailed, setFeedbackFailed] = useState(false);
  useEffect(() => {
    logError(error, 'screen crashed');
    // The splash screen may still be up if the error happened while starting.
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  async function feedback() {
    if (await sendFeedback('The Gauntlet: something went wrong')) return;
    // No email app: hand the details to the share sheet instead (Messages, Notes, anything).
    setFeedbackFailed(true);
    Share.share({ message: feedbackBody() }).catch(() => {});
  }

  function goHome() {
    retry();
    try {
      router.replace('/');
    } catch {
      // No navigator yet: retrying is all we can do.
    }
  }

  return (
    <ScrollView style={styles.errorScreen} contentContainerStyle={styles.errorContent}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorBody}>
        The Gauntlet hit a snag showing this screen. Try again, and if it keeps happening, tap Send feedback: it
        writes an email with the details for you.
      </Text>
      <Text selectable style={styles.errorDetail}>
        {error?.message || String(error)}
      </Text>
      <View style={styles.errorActions}>
        <Text accessibilityRole="button" onPress={retry} style={[styles.errorButton, styles.errorPrimary]}>
          Try again
        </Text>
        <Text accessibilityRole="button" onPress={feedback} style={styles.errorButton}>
          Send feedback
        </Text>
        <Text accessibilityRole="button" onPress={goHome} style={styles.errorButton}>
          Back to my leagues
        </Text>
      </View>
      {feedbackFailed && (
        <Text style={styles.errorBody}>No email app found, so the details went to the share sheet instead.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContent: {
    padding: 24,
    paddingTop: 96,
    gap: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#15151B',
  },
  errorBody: {
    fontSize: 16,
    lineHeight: 22,
    color: '#15151B',
  },
  errorDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5B5B66',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  errorActions: {
    gap: 12,
    paddingTop: 8,
  },
  errorButton: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    overflow: 'hidden',
    color: Brand,
    backgroundColor: '#EEF1FE',
  },
  errorPrimary: {
    color: '#FFFFFF',
    backgroundColor: Brand,
  },
});
