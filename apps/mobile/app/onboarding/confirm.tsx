import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Button, Card, Badge, theme } from '@ascension/ui';
import type { UserProfile } from '@ascension/api';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/hooks/useAuth';

export default function OnboardingConfirmScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

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

  return (
    <ScreenLayout title="You're All Set">
      <Text style={styles.stepIndicator}>Step 3 of 3</Text>

      <Text style={styles.subtitle}>
        Here's a summary of your setup. You can change any of these in Settings later.
      </Text>

      {/* Profile summary */}
      <Card style={styles.summaryCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{profile?.name ?? 'Not set'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email ?? ''}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Partner</Text>
          <Text style={styles.value}>
            {profile?.partner_email ?? 'Not invited yet'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.goalsRow}>
          <Text style={styles.label}>Goals</Text>
          <View style={styles.goalBadges}>
            {goals.length > 0 ? (
              goals.map((goal) => (
                <Badge
                  key={goal}
                  text={goal.replace(/_/g, ' ')}
                  variant="success"
                  style={styles.goalBadge}
                />
              ))
            ) : (
              <Text style={styles.value}>None selected</Text>
            )}
          </View>
        </View>
      </Card>

      {/* Next steps */}
      <Card style={styles.nextStepsCard}>
        <Text style={styles.nextStepsTitle}>Next steps</Text>
        <Text style={styles.nextStep}>
          1. Install Ascension on your computer for screen monitoring
        </Text>
        <Text style={styles.nextStep}>
          2. Your partner will receive an email to set up their app
        </Text>
        <Text style={styles.nextStep}>
          3. Your streak starts now - every day counts
        </Text>
      </Card>

      <Button
        title="Start Ascension"
        onPress={handleStart}
        style={styles.startButton}
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
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    marginBottom: theme.spacing.base,
  },
  subtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  summaryCard: {
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  goalsRow: {
    paddingVertical: theme.spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.cardBorder,
    marginVertical: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
  },
  value: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  goalBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  goalBadge: {
    marginBottom: theme.spacing.xs,
  },
  nextStepsCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.warmBg,
  },
  nextStepsTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.md,
  },
  nextStep: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 24,
    marginBottom: theme.spacing.xs,
  },
  startButton: {
    marginTop: theme.spacing.sm,
  },
});
