import React, { useState } from 'react';
import { StyleSheet, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { theme, ScreenLayout, Input, Button } from '@ascension/ui';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) return;
    await signIn(email.trim(), password);
  }

  return (
    <ScreenLayout>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ascension Ally</Text>
          <Text style={styles.subtitle}>
            I was invited as an accountability partner
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title={loading ? 'Signing in...' : 'Sign In'}
            onPress={handleSignIn}
            disabled={loading || !email.trim() || !password.trim()}
          />
        </View>

        <Text style={styles.footer}>
          Your partner invited you to help them stay accountable. Sign in with
          the account you created when you accepted the invitation.
        </Text>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  error: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing.base,
  },
  footer: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.lg,
  },
});
