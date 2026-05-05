import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, RefreshControl, ActivityIndicator, Platform, Linking, Alert as RNAlert, useWindowDimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScreenLayout,
  Card,
  Button,
  theme,
} from '@ascension/ui';
import type { Alert, Streak, ScreenshotStats, WeeklyStats } from '@ascension/api';
import { ALERT_TYPE_LABELS, formatRelativeTime, getAlertSeverity, type AlertType } from '@ascension/shared';
import { useApi } from '../src/hooks/useApi';
import { useAuth } from '../src/hooks/useAuth';
import { vpnManager } from '../src/native/VPNManager';
import { stopMonitoring } from '../src/services/MonitoringService';
import { isSubscriptionExpired } from '../src/utils/subscription';
import { SubscriptionSuspendedView } from '../src/components/SubscriptionSuspendedView';
import SubscriptionAlertIcon from '../assets/icons/subscription_alert.svg';
import BlockedSiteThisWeekIcon from '../assets/icons/blocked_site_this_week.svg';
import BlockedSiteIcon from '../assets/icons/blocked_site.svg';
import FlaggedIcon from '../assets/icons/flagged.svg';

export default function DashboardScreen() {
  const api = useApi();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
    if (!user) { setLoading(false); return; }

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

  const isCompact = width < 380;
  const navWidth = Math.min(360, Math.max(304, width - 32));
  const navBottomOffset = Math.max(insets.bottom + 12, 28);
  const currentStreak = streak?.current_streak ?? 0;
  const longestStreak = Math.max(streak?.longest_streak ?? 0, currentStreak);
  const blockedThisWeek = weeklyStats?.blockedCount ?? 0;
  const flaggedThisWeek = weeklyStats?.flaggedCount ?? 0;
  const screenContentStyle = {
    paddingTop: theme.spacing.sm,
    paddingBottom: 168 + insets.bottom,
  };

  const showUnavailableTab = useCallback((label: string) => {
    RNAlert.alert('Coming Soon', `${label} is not available in the mobile app yet.`);
  }, []);

  if (loading) {
    return (
      <View style={styles.screenRoot}>
        <ScreenLayout title="Dashboard" scrollable={false}>
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        </ScreenLayout>
      </View>
    );
  }

  if (error && !streak && !stats) {
    return (
      <View style={styles.screenRoot}>
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
      </View>
    );
  }

  if (subscriptionExpired) {
    const suspendedReason = subscriptionBlockReason ?? 'expired';

    const handleSuspendedAction =
      suspendedReason === 'trial_expired'
        ? () => router.push('/pricing')
        : handleManageSubscription;

    return (
      <View style={styles.screenRoot}>
        <ScreenLayout title="Dashboard" scrollable={false}>
          <SubscriptionSuspendedView
            reason={suspendedReason}
            onPrimaryAction={handleSuspendedAction}
          />
        </ScreenLayout>
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <ScreenLayout
        title={undefined}
        scrollable
        style={screenContentStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <View style={styles.statusRightWrap}>
            <View
              style={[
                styles.statusDot,
                monitoringActive ? styles.statusDotActive : styles.statusDotPaused,
              ]}
            />
            <Text style={styles.statusText}>
              {monitoringActive ? 'Monitoring active' : 'Monitoring paused'}
            </Text>
          </View>
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakRow}>
            <View>
              <Text style={styles.streakNumber}>{currentStreak}</Text>
              <Text style={styles.streakLabel}>Days</Text>
            </View>
            <View style={styles.longestPill}>
              <Text style={styles.longestPillText}>Longest: {longestStreak} days</Text>
            </View>
          </View>
        </View>

        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>This week</Text>
          <Text style={styles.weeklySubtitle}>Activity overview for the past 7 days.</Text>
        </View>

        <Card style={styles.primaryMetricCard}>
          <View style={styles.bigMetricRow}>
            <View style={styles.metricCopy}>
              <Text style={styles.bigMetricNumber}>{blockedThisWeek}</Text>
              <Text style={styles.bigMetricLabel}>Blocked this week</Text>
            </View>
            <BlockedSiteThisWeekIcon
              width={isCompact ? 108 : 134}
              height={isCompact ? 84 : 104}
            />
          </View>
        </Card>

        <View style={[styles.secondaryMetricsRow, isCompact && styles.secondaryMetricsColumn]}>
          <View style={styles.secondaryMetricCard}>
            <View style={styles.metricCopy}>
              <Text style={styles.secondaryMetricNumber}>{blockedThisWeek}</Text>
              <Text style={styles.secondaryMetricLabel}>Blocked</Text>
            </View>
            <BlockedSiteIcon
              width={isCompact ? 92 : 100}
              height={isCompact ? 66 : 80}
              style={styles.secondaryMetricIcon}
            />
          </View>

          <View style={styles.secondaryMetricCard}>
            <View style={styles.metricCopy}>
              <Text style={styles.secondaryMetricNumber}>{flaggedThisWeek}</Text>
              <Text style={styles.secondaryMetricLabel}>Flagged</Text>
            </View>
            <FlaggedIcon
              width={isCompact ? 76 : 88}
              height={isCompact ? 74 : 86}
              style={styles.secondaryMetricIcon}
            />
          </View>
        </View>

        <View style={styles.alertsSectionHeader}>
          <Text style={styles.alertsSectionTitle}>Recent alerts</Text>
        </View>

        {alerts.length === 0 && (
          <View style={styles.emptyAlertsWrap}>
            <SubscriptionAlertIcon width={118} height={86} />
            <Text style={styles.emptyAlertsTitle}>No alerts yet</Text>
            <Text style={styles.emptyAlertsSubtitle}>No alerts - keep it up!</Text>
          </View>
        )}

        {alerts.map((alert) => {
          const severity = getAlertSeverity(alert.type as AlertType);
          const typeLabel = ALERT_TYPE_LABELS[alert.type as AlertType] || alert.type;

          return (
            <Card
              key={alert.id}
              style={
                !alert.read
                  ? { ...styles.alertCard, ...styles.alertCardUnread }
                  : styles.alertCard
              }
            >
              <View style={styles.alertRow}>
                <SubscriptionAlertIcon width={44} height={44} style={styles.alertIconWrap} />
                <View style={styles.alertContent}>
                  <View style={styles.alertMetaRow}>
                    <Text
                      style={[
                        styles.alertType,
                        severity === 'critical'
                          ? styles.alertTypeCritical
                          : severity === 'warning'
                          ? styles.alertTypeWarning
                          : styles.alertTypeInfo,
                      ]}
                    >
                      {typeLabel}
                    </Text>
                    <Text style={styles.alertTime}>{formatRelativeTime(alert.timestamp)}</Text>
                  </View>

                  <Text numberOfLines={2} style={styles.alertMessage}>
                    {alert.message}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </ScreenLayout>

      <View
        style={[
          styles.bottomNav,
          {
            width: navWidth,
            marginLeft: -navWidth / 2,
            bottom: navBottomOffset,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push('/')}
          style={[styles.navItem, styles.navItemActive]}
          accessibilityRole="button"
          accessibilityLabel="Go to dashboard"
        >
          <Ionicons name="home-outline" size={23} color="#FFFFFF" />
        </Pressable>

        <Pressable
          onPress={() => showUnavailableTab('Connect')}
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Connect tab coming soon"
        >
          <Ionicons name="search-outline" size={27} color="#11131A" />
        </Pressable>

        <Pressable
          onPress={() => showUnavailableTab('Alerts')}
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Alerts tab coming soon"
        >
          <Ionicons name="notifications-outline" size={25} color="#11131A" />
        </Pressable>

        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Go to settings"
        >
          <Ionicons name="settings-outline" size={25} color="#11131A" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  statusRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: theme.borderRadius.circle,
  },
  statusDotActive: {
    backgroundColor: '#74B66A',
  },
  statusDotPaused: {
    backgroundColor: theme.colors.warning,
  },
  statusText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textPrimary,
  },
  streakCard: {
    marginBottom: theme.spacing.xl,
    width: '100%',
    minHeight: 148,
    borderRadius: 32,
    paddingHorizontal: 26,
    paddingVertical: 24,
    backgroundColor: '#EEF3FF',
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 98,
  },
  streakNumber: {
    fontFamily: theme.typography.phosphateSolid,
    fontSize: 50,
    lineHeight: 54,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  streakLabel: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.bodyFamily,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
  },
  longestPill: {
    flexDirection: 'column',
    width: 154,
    height: 38,
    backgroundColor: '#AEC3FF',
    borderRadius: 132,
    // paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  longestPillText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  weeklyHeader: {
    marginBottom: 18,
  },
  weeklyTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h3,
    lineHeight: 28,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  weeklySubtitle: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.bodyFamily,
    fontWeight: theme.fontWeight.regular,
    fontSize: theme.fontSize.body,
    color: '#5C616C',
  },
  primaryMetricCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: '#F7F9FF',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  bigMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 112,
  },
  metricCopy: {
    flexShrink: 1,
  },
  bigMetricNumber: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  bigMetricLabel: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    lineHeight: 22,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textPrimary,
  },
  secondaryMetricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,

  },
  secondaryMetricsColumn: {
    flexDirection: 'column',
  },
  secondaryMetricCard: {
    flex: 1,
    backgroundColor: '#F7F9FF',
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden',
    padding: theme.spacing.base,
  },
  secondaryMetricInner: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  secondaryMetricIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  secondaryMetricLabel: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textPrimary,
  },
  secondaryMetricNumber: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  alertsSectionHeader: {
    marginTop: 8,
    marginBottom: theme.spacing.base,
  },
  alertsSectionTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  emptyAlertsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    paddingBottom: 72,
  },
  emptyAlertsTitle: {
    marginTop: theme.spacing.base,
    fontFamily: theme.typography.headingFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
  },
  emptyAlertsSubtitle: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.bodyFamily,
    fontSize: 16,
    lineHeight: 22,
    color: '#555861',
  },
  alertCard: {
    marginBottom: theme.spacing.sm,
    backgroundColor: '#F7F9FF',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  alertCardUnread: {
    backgroundColor: theme.colors.accentLight,
    borderColor: theme.colors.infoBorderSoft,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertIconWrap: {
    marginRight: theme.spacing.md,
    marginTop: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  alertType: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  alertTypeCritical: {
    color: theme.colors.textPrimary,
  },
  alertTypeWarning: {
    color: theme.colors.warning,
  },
  alertTypeInfo: {
    color: theme.colors.textSecondary,
  },
  alertTime: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.textSecondary,
  },
  alertMessage: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.base,
  },
  retryButton: {
    marginTop: theme.spacing.sm,
  },
  bottomNav: {
    position: 'absolute',
    left: '50%',
    height: 72,
    backgroundColor: '#DCDDFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: '#2A479E',
  },
});
