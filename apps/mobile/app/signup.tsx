import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Input, Button, BackButton, theme } from '@ascension/ui';
import { useAuth } from '../src/hooks/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await signUp(trimmedEmail, password, 'ascension://login');
      if (result.error) {
        setError(result.error);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout scrollable={false}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.topSection}>
              <BackButton onPress={() => router.back()} style={styles.backButton} />

              <View style={styles.header}>
                <Text style={styles.logo}>Ascension</Text>
                <Text style={styles.subtitle}>Start your journey. Take back control.</Text>
              </View>
            </View>

            <View style={styles.form}>
              <Input
                label="Email address"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />

              <Input
                label="Confirm password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />

              {error && <Text style={styles.error}>{error}</Text>}

              {emailSent ? (
                <Text style={styles.successText}>
                  A confirmation email has been sent to {email}. Please verify your email then sign in.
                </Text>
              ) : (
                <Button
                  title={loading ? 'Creating account...' : 'Create account'}
                  onPress={handleSignUp}
                  disabled={loading}
                  style={styles.button}
                />
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.link}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  topSection: {
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    marginBottom: theme.spacing.xl,
  },
  header: {
    alignItems: 'flex-start',
  },
  logo: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    lineHeight: theme.lineHeight.h1,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    lineHeight: theme.lineHeight.bodyLg,
    color: theme.colors.textSecondary,
  },
  form: {
    gap: theme.spacing.base,
  },
  error: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    lineHeight: theme.lineHeight.caption,
  },
  button: {
    marginTop: theme.spacing.sm,
  },
  successText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.success,
    lineHeight: theme.lineHeight.body,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 'auto',
    paddingBottom: theme.spacing.sm,
  },
  footerText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    lineHeight: theme.lineHeight.body,
    color: theme.colors.textPrimary,
  },
  link: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    lineHeight: theme.lineHeight.body,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
});
