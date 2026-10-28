import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth';

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
      <AnimatedSplashOverlay />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
