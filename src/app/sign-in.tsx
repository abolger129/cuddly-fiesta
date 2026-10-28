import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, SleeveColors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '@/lib/social-sign-in';
import { supabase } from '@/lib/supabase';

// Apple and Google sign-in come first; the emailed code stays as a fallback.
// Passwordless sign-in: we email a one-time code and the user types it in.
// Supabase lets the code length be set from 6 to 10 digits (8 by default).
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function socialSignIn(provider: 'Apple' | 'Google') {
    setSocialLoading(true);
    try {
      await (provider === 'Apple' ? signInWithApple() : signInWithGoogle());
      // On success the auth listener switches to the signed-in screens.
    } catch (e) {
      Alert.alert(`${provider} sign-in did not work`, e instanceof Error ? e.message : String(e));
    } finally {
      setSocialLoading(false);
    }
  }

  async function sendCode() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }
    setCodeSent(true);
  }

  async function verifyCode() {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) Alert.alert('That code did not work', error.message);
    // On success the auth listener switches to the signed-in screens.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}>
          <View style={styles.sleeves} accessible={false}>
            {SleeveColors.slice(0, 3).map((color, i) => (
              <View
                key={color}
                style={[styles.sleeve, { backgroundColor: color, transform: [{ rotate: `${(i - 1) * 6}deg` }] }]}
              />
            ))}
          </View>
          <ThemedText type="title">The Gauntlet</ThemedText>
          <ThemedText themeColor="textSecondary">
            Pick songs with your friends, rank them, and find out who has the best taste.
          </ThemedText>

          {codeSent ? (
            <>
              <ThemedText type="small">We sent a sign-in code to {email.trim()}.</ThemedText>
              <TextField
                value={code}
                onChangeText={setCode}
                placeholder="Code from the email"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={MAX_CODE_LENGTH}
              />
              <Button
                title="Sign in"
                onPress={verifyCode}
                loading={loading}
                disabled={code.trim().length < MIN_CODE_LENGTH}
              />
              <Button
                title="Use a different email"
                variant="secondary"
                onPress={() => {
                  setCodeSent(false);
                  setCode('');
                }}
              />
            </>
          ) : (
            <>
              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={
                    colorScheme === 'dark'
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={APPLE_BUTTON_RADIUS}
                  style={styles.appleButton}
                  onPress={() => !socialLoading && socialSignIn('Apple')}
                />
              )}
              <Button
                title="Continue with Google"
                variant="secondary"
                onPress={() => socialSignIn('Google')}
                loading={socialLoading}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.or}>
                or use your email
              </ThemedText>
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <Button
                title="Email me a code"
                onPress={sendCode}
                loading={loading}
                disabled={!email.includes('@')}
              />
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// Matches the rounded corners of our own Button.
const APPLE_BUTTON_RADIUS = 6;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  sleeves: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  sleeve: {
    width: 64,
    height: 64,
    borderRadius: Spacing.one,
    marginRight: -Spacing.four,
  },
  appleButton: {
    height: 48,
  },
  or: {
    textAlign: 'center',
  },
});
