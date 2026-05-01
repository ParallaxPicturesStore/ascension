import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme, ScreenLayout, BackButton } from '@ascension/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { FlagIcon, MilestoneIcon, MonitorIcon, SiteBlock, TimeIcon } from '@/assets/icons';

function getEncouragingMessage(days: number): string {
  if (days === 0) return 'Every journey begins with the first step. Today is a fresh start.';
  if (days === 1) return 'One day down. That took real courage. Keep going.';
  if (days < 7) return 'Building momentum. Each day matters and you are showing up.';
  if (days < 14) return 'A full week of strength. That is truly inspiring.';
  if (days < 30) return 'Incredible consistency.\nNew habits are taking root.';
  if (days < 90) return 'Over a month of progress. This level of commitment is remarkable.';
  if (days < 365) return 'The transformation is real. What an achievement.';
  return 'Over a year of dedication. Truly extraordinary.';
}

const MILESTONES = [7, 14, 30, 60];

export default function StreakScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { partner, streak, weeklyStats } = usePartner(session?.user?.id);

  const currentStreak = streak?.current_streak ?? 0;
  const longestStreak = Math.max(streak?.longest_streak ?? 0, currentStreak);
  const partnerName = partner?.name ?? 'Your partner';

  return (
    <ScreenLayout>
      {/* Back button + title */}
      <BackButton onPress={() => router.back()} />

      <Text style={styles.title}>{partnerName}'s streak</Text>
      <Text style={styles.titleSub}>{currentStreak} day streak</Text>

      {/* Main streak card */}
      <View style={styles.streakCard}>
        <View style={styles.streakCardTop}>
          <View>
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <Text style={styles.streakDaysLabel}>Days</Text>
          </View>
          <View style={styles.longestBadge}>
            <Text style={styles.longestText}>Longest: {longestStreak} days</Text>
          </View>
        </View>
        <Text style={styles.encouragement}>
          {getEncouragingMessage(currentStreak)}
        </Text>
      </View>

      {/* This week */}
      <Text style={styles.sectionTitle}>This week</Text>
      <Text style={styles.sectionSubtitle}>Activity overview for the past 7 days.</Text>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{weeklyStats?.screenshotCount ?? 0}</Text>
          <Text style={styles.statLabel}>Screens{'\n'}monitored</Text>
          {/* Monitor icon — replace with SVG from Figma */}
          <View style={styles.statIcon}>
            <MonitorIcon width={70} />
          </View>

        </View>

        <View style={[styles.statItem]}>
          <Text style={styles.statNumber}>{weeklyStats?.blockedCount ?? 0}</Text>
          <Text style={styles.statLabel}>Sites{'\n'}blocked</Text>
          {/* Globe icon — replace with SVG from Figma */}
          <View style={styles.statIcon}>
            <SiteBlock width={70} />
          </View>
        </View>

        <View style={[styles.statItem]}>
          <Text style={styles.statNumber}>{weeklyStats?.flaggedCount ?? 0}</Text>
          <Text style={styles.statLabel}>Flagged</Text>
          {/* Flag icon — replace with SVG from Figma */}
          <View style={styles.statIcon}>
            <FlagIcon width={70} />
          </View>
        </View>
      </View>

      {/* Milestones */}
      <Text style={styles.sectionTitle}>Milestones</Text>

      <View style={styles.milestonesCard}>
        <View style={styles.milestonesRow}>
          {MILESTONES.map((days, index) => {
            const testStreak = currentStreak;
            const reached = testStreak >= days;
            const isLast = index === MILESTONES.length - 1;
            const nextReached = !isLast && testStreak >= MILESTONES[index + 1]!;

            return (
              <React.Fragment key={days}>
                <View style={styles.milestoneItem}>
                  <View style={[styles.milestoneDot, reached && styles.milestoneDotReached]}>
                    {reached ? (
                      <MilestoneIcon width={36} height={36} />
                    ) : (
                      <TimeIcon width={36} height={36} />
                    )}
                  </View>
                  <Text style={[styles.milestoneLabel, reached && styles.milestoneLabelReached]}>
                    {days} days
                  </Text>
                </View>
                {!isLast && (
                  <View style={[styles.milestoneConnector, nextReached && styles.milestoneConnectorReached]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    lineHeight: theme.lineHeight.h2,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md
  },
  titleSub: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
  },
  statIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0
  },
  // Streak card
  streakCard: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.tl,
    marginBottom: theme.spacing.lg,
  },
  streakCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  streakNumber: {
    fontFamily: theme.typography.phosphateSolid,
    fontSize: theme.fontSize.largeText,
    color: theme.colors.foreground,
    // lineHeight: theme.lineHeight.h1,
  },
  streakDaysLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.header,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  longestBadge: {
    backgroundColor: theme.colors.badgeColor,
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  longestText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.black,
  },
  encouragement: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.header,
    color: theme.colors.intro,
    fontWeight: theme.fontWeight.regular,
    // lineHeight: theme.lineHeight.bodyLg,
  },

  // Section headers
  sectionTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.header,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    // marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.intro,
    marginBottom: theme.spacing.md,
  },

  // Stats card
  statsCard: {


    borderRadius: theme.borderRadius.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    // overflow: 'hidden',
    gap: theme.spacing.sm,
  },
  statItem: {
    flex: 1,
    backgroundColor: theme.colors.settings,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    paddingBottom: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.card
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.borderColor,
  },
  statNumber: {
    fontFamily: theme.typography.phosphateSolid,
    fontSize: theme.fontSize.cardText,
    color: theme.colors.foreground,
  },
  statLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.black,
    marginTop: theme.spacing.xs,
    lineHeight: 20,
  },
  statIconSlot: {
    width: 52,
    height: 52,
    marginTop: theme.spacing.md,
    // Replace this View with the SVG icon from Figma
  },

  // Milestones
  milestonesCard: {
    backgroundColor: theme.colors.settings,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  milestonesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  milestoneItem: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  milestoneDot: {

    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneDotReached: {
    // backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  milestoneCheck: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: theme.fontWeight.regular,
  },
  milestoneClock: {
    fontSize: 14,
    color: theme.colors.muted,
  },
  milestoneConnector: {
    flex: 1,
    height: 2,
    marginTop: 17,
    marginHorizontal: -3,
    backgroundColor: theme.colors.border,
  },
  milestoneConnectorReached: {
    backgroundColor: theme.colors.gapBorder,
  },
  milestoneLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.intro,
    fontWeight: theme.fontWeight.regular,
    textAlign: 'center',
  },
  milestoneLabelReached: {
    color: theme.colors.foreground,
    fontWeight: theme.fontWeight.regular,
  },
});
