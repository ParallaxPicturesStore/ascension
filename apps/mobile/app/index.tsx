import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ScreenLayout,
  StreakCounter,
  AlertItem,
  Card,
  Badge,
  SectionHeader,
  Button,
  theme,
} from '@ascension/ui';
import type { Alert, Streak, ScreenshotStats, WeeklyStats } from '@ascension/api';
import { useApi } from '../src/hooks/useApi';
import { useAuth } from '../src/hooks/useAuth';

export default function DashboardScreen() {
  const api = useApi();
  const { user } = useAuth();
  const router = useRouter();

  const [streak, setStreak] = useState<Streak | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<ScreenshotStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [streakData, alertsData, statsData, weeklyData] = await Promise.all([
        api.streaks.get(user.id),
        api.alerts.getForUser(user.id),
        api.screenshots.getStats(user.id),
        api.streaks.getWeeklyStats(user.id),
      ]);

      setStreak(streakData);
      setAlerts(alertsData.slice(0, 5));
      setStats(statsData);
      setWeeklyStats(weeklyData);
    } catch {
      // Silently handle - data will show empty states
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const monitoringActive = true; // Desktop is responsible for monitoring

  return (
    <ScreenLayout
      title="Dashboard"
      scrollable
      style={styles.screen}
    >
      {/* Monitoring status */}
      <View style={styles.statusRow}>
        <Badge
          text={monitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}
          variant={monitoringActive ? 'success' : 'warning'}
        />
      </View>

      {/* Streak */}
      <Card style={styles.streakCard}>
        <StreakCounter
          currentStreak={streak?.current_streak ?? 0}
          longestStreak={streak?.longest_streak ?? 0}
        />
      </Card>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{stats?.totalCaptures ?? 0}</Text>
          <Text style={styles.statLabel}>Screenshots</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>
            {weeklyStats?.blockedCount ?? 0}
          </Text>
          <Text style={styles.statLabel}>Blocked This Week</Text>
        </Card>
      </View>

      {/* Weekly summary */}
      {weeklyStats && (
        <Card style={styles.weeklyCard}>
          <View style={styles.weeklyRow}>
            <View style={styles.weeklyItem}>
              <Text style={styles.weeklyNumber}>{weeklyStats.screenshotCount}</Text>
              <Text style={styles.weeklyLabel}>Captures</Text>
            </View>
            <View style={styles.weeklyDivider} />
            <View style={styles.weeklyItem}>
              <Text style={styles.weeklyNumber}>{weeklyStats.blockedCount}</Text>
              <Text style={styles.weeklyLabel}>Blocked</Text>
            </View>
            <View style={styles.weeklyDivider} />
            <View style={styles.weeklyItem}>
              <Text style={[styles.weeklyNumber, weeklyStats.flaggedCount > 0 && styles.flaggedNumber]}>
                {weeklyStats.flaggedCount}
              </Text>
              <Text style={styles.weeklyLabel}>Flagged</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Recent alerts */}
      <SectionHeader
        title="Recent Alerts"
        subtitle={alerts.length === 0 ? 'No alerts - keep it up!' : undefined}
        style={styles.sectionHeader}
      />

      {alerts.map((alert) => (
        <AlertItem
          key={alert.id}
          type={alert.type}
          message={alert.message}
          timestamp={alert.timestamp}
          read={alert.read}
        />
      ))}

      {/* Settings shortcut */}
      <View style={styles.bottomActions}>
        <Button
          title="Settings"
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: theme.spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  streakCard: {
    marginBottom: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  statLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  weeklyCard: {
    marginBottom: theme.spacing.lg,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weeklyItem: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyDivider: {
    width: 1,
    height: theme.spacing.xl,
    backgroundColor: theme.colors.cardBorder,
  },
  weeklyNumber: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  flaggedNumber: {
    color: theme.colors.danger,
  },
  weeklyLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  sectionHeader: {
    marginTop: theme.spacing.sm,
  },
  bottomActions: {
    marginTop: theme.spacing.xl,
  },
});
