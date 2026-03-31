import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Input, Button, theme } from '@ascension/ui';
import { useAuth } from '../src/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.error) {
        setError(result.error);
      }
      // Auth state change will handle navigation
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout scrollable={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Ascension</Text>
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="your@email.com"
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
            autoComplete="password"
            textContentType="password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title={loading ? 'Signing in...' : 'Sign In'}
            onPress={handleSignIn}
            disabled={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  logo: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.muted,
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  error: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing.base,
  },
  button: {
    marginTop: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  footerText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
  },
  link: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.accent,
  },
});
