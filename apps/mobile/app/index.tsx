import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, RefreshControl, ActivityIndicator, Platform, Modal, Linking, Alert as RNAlert } from 'react-native';
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
import { vpnManager } from '../src/native/VPNManager';
import { stopMonitoring } from '../src/services/MonitoringService';
import { isSubscriptionExpired } from '../src/utils/subscription';

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
  const [error, setError] = useState<string | null>(null);
  const [vpnStatus, setVpnStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [subscriptionBlockReason, setSubscriptionBlockReason] = useState<'expired' | 'cancelled' | 'trial_expired' | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const [streakData, alertsData, statsData, weeklyData, profile] = await Promise.all([
        api.streaks.get(user.id),
        api.alerts.getForUser(user.id),
        api.screenshots.getStats(user.id),
        api.streaks.getWeeklyStats(user.id),
        api.users.getProfile(user.id),
      ]);

      const lapseExpired = isSubscriptionExpired(profile.subscription_lapse_date);
      const status = profile.subscription_status;
      let blockReason: 'expired' | 'cancelled' | 'trial_expired' | null = null;
      if (status === 'cancelled') {
        blockReason = 'cancelled';
      } else if (status === 'trial' && lapseExpired) {
        blockReason = 'trial_expired';
      } else if (status === 'expired' || lapseExpired) {
        blockReason = 'expired';
      }
      setSubscriptionExpired(blockReason !== null);
      setSubscriptionBlockReason(blockReason);

      setStreak(streakData);
      setAlerts(alertsData.slice(0, 5));
      setStats(statsData);
      setWeeklyStats(weeklyData);
    } catch {
      setError('Unable to load your data. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    if (!subscriptionExpired) return;
    stopMonitoring().catch((err) =>
      console.warn('[Dashboard] stopMonitoring error:', err),
    );
  }, [subscriptionExpired]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll VPN status on iOS every 5 seconds while screen is mounted
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    vpnManager.getVPNStatus().then(setVpnStatus);
    const t = setInterval(() => vpnManager.getVPNStatus().then(setVpnStatus), 5000);
    return () => clearInterval(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleManageSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const customerId = await api.billing.getCustomerId(user.id);
      if (!customerId) {
        RNAlert.alert('No Subscription', 'No active subscription found to manage.');
        return;
      }
      const session = await api.billing.createPortalSession(customerId);
      if (!session?.url) {
        RNAlert.alert('Error', 'Could not open subscription portal. Please try again.');
        return;
      }
      await Linking.openURL(session.url);
    } catch {
      RNAlert.alert('Error', 'Failed to open subscription portal.');
    }
  }, [api, user]);

  const monitoringActive = Platform.OS === 'ios'
    ? vpnStatus === 'connected'
    : true; // Android monitoring managed by MonitoringService

  if (loading) {
    return (
      <ScreenLayout title="Dashboard" scrollable={false}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </ScreenLayout>
    );
  }

  if (error && !streak && !stats) {
    return (
      <ScreenLayout title="Dashboard" scrollable={false}>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            variant="secondary"
            onPress={loadData}
            style={styles.retryButton}
          />
        </View>
      </ScreenLayout>
    );
  }

  if (subscriptionExpired) {
    const modalTitle =
      subscriptionBlockReason === 'trial_expired'
        ? 'Trial Expired'
        : subscriptionBlockReason === 'cancelled'
        ? 'Subscription Cancelled'
        : 'Subscription Ended';

    const modalBody =
      subscriptionBlockReason === 'trial_expired'
        ? 'Your 7-day free trial has expired. Subscribe to keep monitoring active and your partner informed.'
        : subscriptionBlockReason === 'cancelled'
        ? 'You have cancelled your subscription. Monitoring has been paused. Renew to keep your partner informed.'
        : 'Your subscription has ended, so screen sharing and monitoring are turned off.';

    const modalButtonTitle =
      subscriptionBlockReason === 'trial_expired' ? 'View Plans' : 'Manage Subscription';

    const handleModalAction =
      subscriptionBlockReason === 'trial_expired'
        ? () => router.push('/pricing')
        : handleManageSubscription;

    return (
      <ScreenLayout title="Dashboard" scrollable={false}>
        <Modal visible transparent animationType="fade">
          <View style={styles.subscriptionModalOverlay}>
            <Card style={styles.subscriptionModalCard}>
              <Text style={styles.subscriptionModalTitle}>{modalTitle}</Text>
              <Text style={styles.subscriptionModalBody}>{modalBody}</Text>
              <Button
                title={modalButtonTitle}
                onPress={handleModalAction}
                style={styles.subscriptionModalButton}
              />
            </Card>
          </View>
        </Modal>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      title="Dashboard"
      scrollable
      style={styles.screen}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.accent}
        />
      }
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
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.base,
  },
  retryButton: {
    marginTop: theme.spacing.sm,
  },
  subscriptionModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: theme.spacing.lg,
  },
  subscriptionModalCard: {
    width: '100%',
    maxWidth: 420,
  },
  subscriptionModalTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  subscriptionModalBody: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
    marginBottom: theme.spacing.base,
  },
  subscriptionModalButton: {
    marginTop: theme.spacing.sm,
  },
});
