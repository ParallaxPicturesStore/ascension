import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Button, Header, theme } from '@ascension/ui';
import type { UserProfile } from '@ascension/api';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/hooks/useAuth';
import { useOnboarding } from '../_layout';

export default function OnboardingConfirmScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

  const { completeOnboarding } = useOnboarding();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    api.users
      .getProfile(user.id)
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [api, user]);

  const handleStart = () => {
    completeOnboarding();
    router.replace('/');
  };

  if (loading) {
    return (
      <ScreenLayout scrollable={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </ScreenLayout>
    );
  }

  const goals = profile?.goals?.split(',') ?? [];
  const goalsValue =
    goals.length > 0
      ? goals.map((goal) => goal.replace(/_/g, ' ')).join(', ')
      : 'None selected';

  return (
    <ScreenLayout>
      <Header title="Create account" showBack onBack={() => router.back()} />

      <Text style={styles.stepIndicator}>STEP 3 OF 3</Text>

      <Text style={styles.heading}>You're all set</Text>

      <Text style={styles.subtitle}>
        Here's a summary of your setup. You can change any of these in Settings later:
      </Text>

      {/* Profile summary */}
      <View style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Your name</Text>
          <Text style={styles.value}>{profile?.name ?? 'Not set'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Your goals</Text>
          <Text style={styles.value}>{goalsValue}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Partner's email</Text>
          <Text style={styles.value}>{profile?.partner_email ?? 'Not invited yet'}</Text>
        </View>
      </View>

      <Button
        title="Confirm"
        onPress={handleStart}
        style={styles.confirmButton}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.inputSecondaryText,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.lg,
  },
  heading: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.cardText,
    letterSpacing: 0.5,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.inputSecondaryText,
    lineHeight: theme.lineHeight.body,
    marginBottom: theme.spacing.lg,
  },
  summaryCard: {
    marginBottom: theme.spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.base,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.cardBorder,
    marginVertical: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.inputSecondaryText,
  },
  value: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.black,
    textAlign: 'right',
  },
  confirmButton: {
    marginTop: theme.spacing.md,
  },
});
