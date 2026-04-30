import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { theme, ScreenLayout, Card, StreakCounter, Button, SectionHeader } from '@ascension/ui';
import { formatStreakDisplay, calculateStreak } from '@ascension/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';

function getEncouragingMessage(days: number): string {
  if (days === 0) return 'Every journey begins with the first step. Today is a fresh start.';
  if (days === 1) return 'One day down. That took real courage. Keep going.';
  if (days < 7) return 'Building momentum. Each day matters and you are showing up.';
  if (days < 14) return 'A full week of strength. That is truly inspiring.';
  if (days < 30) return 'Incredible consistency. New habits are taking root.';
  if (days < 90) return 'Over a month of progress. This level of commitment is remarkable.';
  if (days < 365) return 'The transformation is real. What an achievement.';
  return 'Over a year of dedication. Truly extraordinary.';
}

export default function StreakScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { partner, streak, weeklyStats, loading } = usePartner(session?.user?.id);

  const currentStreak = streak ? calculateStreak(streak.streak_started_at) : 0;
  const longestStreak = streak?.longest_streak ?? 0;
  const partnerName = partner?.name ?? 'Your partner';

  return (
    <ScreenLayout title={`${partnerName}'s Streak`}>
      {/* Main streak display */}
      <Card style={styles.streakCard}>
        <StreakCounter
          currentStreak={currentStreak}
          longestStreak={longestStreak}
        />
        <Text style={styles.encouragement}>
          {getEncouragingMessage(currentStreak)}
        </Text>
      </Card>

      {/* Weekly stats */}
      <SectionHeader
        title="This Week"
        subtitle="Activity overview for the past 7 days"
        style={styles.sectionHeader}
      />

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>
            {weeklyStats?.screenshotCount ?? 0}
          </Text>
          <Text style={styles.statLabel}>Screens Monitored</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>
            {weeklyStats?.blockedCount ?? 0}
          </Text>
          <Text style={styles.statLabel}>Sites Blocked</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>
            {weeklyStats?.flaggedCount ?? 0}
          </Text>
          <Text style={styles.statLabel}>Flagged</Text>
        </Card>
      </View>

      {/* Milestones */}
      <SectionHeader
        title="Milestones"
        style={styles.sectionHeader}
      />

      <View style={styles.milestones}>
        {[7, 14, 30, 60, 90, 180, 365].map((days) => {
          const reached = currentStreak >= days;
          return (
            <View key={days} style={styles.milestoneItem}>
              <Text style={styles.milestoneIcon}>
                {reached ? '\u{2705}' : '\u{23F3}'}
              </Text>
              <Text
                style={[
                  styles.milestoneText,
                  reached && styles.milestoneReached,
                ]}
              >
                {formatStreakDisplay(days)}
              </Text>
            </View>
          );
        })}
      </View>

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  encouragement: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeader: {
    marginTop: theme.spacing.base,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.base,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
  },
  statNumber: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  statLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  milestones: {
    marginBottom: theme.spacing.lg,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  milestoneIcon: {
    fontSize: theme.fontSize.iconSm,
    marginRight: theme.spacing.md,
  },
  milestoneText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
  },
  milestoneReached: {
    color: theme.colors.success,
    fontWeight: theme.fontWeight.medium,
  },
  encourageButton: {
    marginTop: theme.spacing.base,
  },
});
