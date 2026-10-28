import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Linework, ScribbleUnderline } from '@/components/doodles';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Brand, MaxContentWidth, OnBrand, Spacing } from '@/constants/theme';
import { openPrivacyPolicy, openTerms } from '@/lib/legal';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '@/lib/social-sign-in';
import { supabase } from '@/lib/supabase';

// Apple and Google sign-in come first; the emailed code stays as a fallback.
// Passwordless sign-in: we email a one-time code and the user types it in.
// Supabase lets the code length be set from 6 to 10 digits (8 by default).
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;
// A password sign-in sits behind a small link. It is there for the App Review demo account,
// which reviewers can't use with an emailed code. Accounts only get a password if one is set
// for them in the Supabase dashboard.

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

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

  async function passwordSignIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Could not sign in', error.message);
    // On success the auth listener switches to the signed-in screens.
  }

  // Sign-in sits on the app icon's cobalt, with Anna's drawing, so it follows on from the splash screen.
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Linework size={280} style={styles.linework} />
            <View>
              <ThemedText type="title" style={styles.onBrand}>
                The Gauntlet
              </ThemedText>
              <ScribbleUnderline width={220} color={OnBrand} />
            </View>
            <ThemedText style={styles.tagline}>
              Pick songs with your friends, rank them, and find out who has the best taste.
            </ThemedText>

            {codeSent ? (
              <>
                <ThemedText type="small" style={styles.onBrand}>
                  We sent a sign-in code to {email.trim()}.
                </ThemedText>
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
                  variant="onBrand"
                  onPress={verifyCode}
                  loading={loading}
                  disabled={code.trim().length < MIN_CODE_LENGTH}
                />
                <Button
                  title="Use a different email"
                  variant="onBrandOutline"
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
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={APPLE_BUTTON_RADIUS}
                    style={styles.appleButton}
                    onPress={() => !socialLoading && socialSignIn('Apple')}
                  />
                )}
                <Button
                  title="Continue with Google"
                  variant="onBrandOutline"
                  onPress={() => socialSignIn('Google')}
                  loading={socialLoading}
                />
                <ThemedText type="small" style={[styles.onBrand, styles.or]}>
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
                {usePassword ? (
                  <>
                    <TextField
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="current-password"
                      textContentType="password"
                    />
                    <Button
                      title="Sign in"
                      variant="onBrand"
                      onPress={passwordSignIn}
                      loading={loading}
                      disabled={!email.includes('@') || password.length === 0}
                    />
                  </>
                ) : (
                  <Button
                    title="Email me a code"
                    variant="onBrand"
                    onPress={sendCode}
                    loading={loading}
                    disabled={!email.includes('@')}
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setUsePassword(!usePassword);
                    setPassword('');
                  }}>
                  <ThemedText type="small" style={[styles.onBrand, styles.or, styles.link]}>
                    {usePassword ? 'Email me a code instead' : 'Sign in with a password'}
                  </ThemedText>
                </Pressable>
              </>
            )}
            {/* Apple asks that players agree to the terms, including no abusive content, before joining. */}
            <ThemedText type="small" style={[styles.onBrand, styles.or, styles.legal]}>
              By continuing you agree to the{' '}
              <ThemedText type="small" style={[styles.onBrand, styles.link]} onPress={openTerms}>
                Terms of use
              </ThemedText>{' '}
              and{' '}
              <ThemedText type="small" style={[styles.onBrand, styles.link]} onPress={openPrivacyPolicy}>
                Privacy policy
              </ThemedText>
              .
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Matches the rounded corners of our own Button.
const APPLE_BUTTON_RADIUS = 6;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Brand,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  fill: {
    flex: 1,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  linework: {
    alignSelf: 'center',
  },
  onBrand: {
    color: OnBrand,
  },
  tagline: {
    color: OnBrand,
    opacity: 0.9,
  },
  appleButton: {
    height: 48,
  },
  or: {
    textAlign: 'center',
  },
  legal: {
    opacity: 0.8,
    marginTop: Spacing.two,
  },
  link: {
    opacity: 0.8,
    textDecorationLine: 'underline',
  },
});
