import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, BackHandler, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Input, Button, BackButton, theme } from '@ascension/ui';
import { useAuth } from '../src/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }
    router.replace('/');
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    console.log("LOgin");
    

    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.error) {
        console.log(error);
        
        setError(result.error);
      }
      // Auth state change will handle navigation
    } catch (err) {
      console.log(err);
      
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
              <BackButton onPress={handleBackPress} style={styles.backButton} />

              <View style={styles.header}>
                <Text style={styles.logo}>Ascension</Text>
                <Text style={styles.subtitle}>Welcome back. Stay the course.</Text>
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
                autoComplete="password"
                textContentType="password"
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                title={loading ? 'Signing in...' : 'Sign in'}
                onPress={handleSignIn}
                disabled={loading}
                style={styles.button}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.link}>Sign up</Text>
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
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    lineHeight: theme.lineHeight.body,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.primary,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    lineHeight: theme.lineHeight.body,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.md,
  },
  socialButton: {
    marginTop: theme.spacing.xs,
  },
  googleMark: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  appleMark: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.surface,
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
