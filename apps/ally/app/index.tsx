import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  theme,
  Card,
  Badge,
  Avatar,
  SectionHeader,
  BlurredImage,
  ScreenLayout,
} from '@ascension/ui';
import { formatRelativeTime } from '@ascension/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { useApi } from '../src/hooks/useApi';
import type { Screenshot } from '@ascension/api';
import { AlertIcon, CalenderIcon, NoActivity, SettingsIcon } from '@/assets/icons';

// Fetches a short-lived signed URL for a private-bucket screenshot and
// renders it. Falls back to a placeholder if the path is missing or the
// request fails.
function ScreenshotImage({ filePath }: { filePath: string | null }) {
  const api = useApi();
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!filePath);

  useEffect(() => {
    if (!filePath) { setLoading(false); return; }
    let cancelled = false;
    api.screenshots.getSignedUrl(filePath).then((url) => {
      if (!cancelled) { setUri(url); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filePath, api]);

  if (!filePath) {
    return (
      <View style={styles.placeholderImage}>
        <Text style={styles.placeholderText}>No preview</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.placeholderImage}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={styles.placeholderImage}>
        <Text style={styles.placeholderText}>Failed to load</Text>
      </View>
    );
  }
  return (
    <BlurredImage
      source={{ uri }}
      blurRadius={30}
      style={styles.thumbnail}
    />
  );
}

type FilterMode = 'all' | 'flagged';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const api = useApi();
  const { partner, streak, alerts, refresh, loading } = usePartner(
    session?.user?.id,
  );
  const [filter, setFilter] = useState<FilterMode>('all');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(true);
  const [rulesCount, setRulesCount] = useState(0);

  // Fetch screenshots on mount and refresh.
  // Uses getRecentByPartner so we query by the ally's own user ID — no need
  // to wait for partner data to resolve first, and works even if partner_id
  // is set without the monitored user knowing the ally's ID in advance.
  const loadScreenshots = useCallback(async () => {
    if (!session?.user?.id) return;
    setScreenshotsLoading(true);
    try {
      const recent = await api.screenshots.getRecentByPartner(session.user.id, 500);
      console.log(recent);

      setScreenshots(recent);
    } catch {
      // Silently handle - partner data may still be available
    } finally {
      setScreenshotsLoading(false);
    }
  }, [api, session?.user?.id]);

  React.useEffect(() => {
    loadScreenshots();
  }, [loadScreenshots]);

  React.useEffect(() => {
    if (!session?.user?.id) return;
    api.users.getProfile(session.user.id).then((profile) => {
      const settings = profile.notification_settings ?? {};
      setRulesCount(Object.values(settings).filter(Boolean).length);
    }).catch(() => {});
  }, [api, session?.user?.id]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), loadScreenshots()]);
  }, [refresh, loadScreenshots]);

  const filteredScreenshots = useMemo(
    () =>
      filter === 'flagged'
        ? screenshots.filter((s) => s.flagged)
        : screenshots,
    [filter, screenshots],
  );

  const unreadAlertCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );
  const partnerName = partner?.name ?? 'Your partner';

  const renderScreenshotItem = useCallback(({ item }: { item: Screenshot }) => {
    return (
      <Card style={styles.feedItem}>
        <ScreenshotImage filePath={item.file_path} />
        <View style={styles.feedMeta}>
          <Text style={styles.feedTime}>
            {formatRelativeTime(item.timestamp)}
          </Text>
          {item.flagged && <Badge text="Flagged" variant="warning" />}
        </View>
      </Card>
    );
  }, []);

  function renderHeader() {
    return (
      <View>
        {/* Partner header */}
        <View style={styles.partnerHeader}>
          <Avatar name={partnerName} size={48} style={{ backgroundColor: theme.colors.primary }} textColor={theme.colors.white} />
          <View style={styles.partnerInfo}>
            <Text style={styles.greeting}>
              {partnerName}’s activity and progress will appear here
            </Text>
            <Text style={styles.partnerDescription}>
              Track activity and progress as
              monitoring begins and over time.
            </Text>
            {/* {streak && (
              <Text style={styles.streakPreview}>
                {streak.current_streak} day streak
              </Text>
            )} */}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/streak')}
          >
            {/* <Text style={styles.actionIcon}>{'\u{1F525}'}</Text> */}
            <CalenderIcon />
            <Text style={styles.actionLabel}>Streak</Text>
            <View style={styles.actionMeta}>
              <Text style={styles.actionCount}>{streak?.current_streak ?? 0}</Text>
              <Text style={styles.actionType}>Days</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/alerts')}
          >
            <AlertIcon />
            {/* <Text style={styles.actionIcon}>{'\u{1F514}'}</Text> */}
            <Text style={styles.actionLabel}>
              Alerts
            </Text>
            <View style={styles.actionMeta}>
              <Text style={styles.actionCount}>{unreadAlertCount > 0 ? `${unreadAlertCount}` : ''}</Text>
              <Text style={styles.actionType}>active</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/settings')}
          >
            <SettingsIcon />
            {/* <Text style={styles.actionIcon}>{'\u{2699}\u{FE0F}'}</Text> */}
            <Text style={styles.actionLabel}>Settings</Text>
            <View style={styles.actionMeta}>
              <Text style={styles.actionCount}>{rulesCount}</Text>
              <Text style={styles.actionType}>rules</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}

      </View>
    );
  }


  function renderEmpty() {
    if (screenshotsLoading) return null;
    return (
      <View style={styles.emptyState}>
        <NoActivity />
        <Text style={styles.emptyTitle}>
          {filter === 'flagged'
            ? 'No flagged activity'
            : 'No activity yet'}
        </Text>
        <Text style={styles.emptyMessage}>
          {filter === 'flagged'
            ? `Great news - ${partnerName} has no flagged activity. That is something to celebrate.`
            : `${partnerName} has not started monitoring yet. Once they do, you will see their activity here.`}
        </Text>
      </View>
    );
  }

  return (
    <ScreenLayout style={styles.container} refreshControl={
      <RefreshControl
        refreshing={loading}
        onRefresh={handleRefresh}
        tintColor={theme.colors.accent}
      />
    }>
      {renderHeader()}
      <View style={styles.activityContainer}>

        <View style={styles.filterRow}>
          <Text style={styles.cardHeader} >
            Activity Feed
          </Text>
          <View style={styles.filters}>
            <TouchableOpacity
              onPress={() => setFilter('all')}
              style={[
                styles.filterTab,
                filter === 'all' && styles.filterTabActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === 'all' && styles.filterTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter('flagged')}
              style={[
                styles.filterTab,
                filter === 'flagged' && styles.filterTabActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === 'flagged' && styles.filterTextActive,
                ]}
              >
                Flagged
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={filteredScreenshots??[]}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={renderScreenshotItem}
          // ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}

          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    // paddingHorizontal: theme.spacing.base,
    // paddingTop: theme.spacing.lg,
    // paddingBottom: theme.spacing['3xl'],
  },
  partnerHeader: {
    flexDirection: 'column',
    // alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  partnerInfo: {
    // marginLeft: theme.spacing.md,
    flex: 1,
  },
  greeting: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    lineHeight: theme.lineHeight.h2,
    marginTop: theme.spacing.xs

  },
  partnerDescription: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.intro,
    width:'70%'
  },
  streakPreview: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.success,
    marginTop: theme.spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.settings,
    borderRadius: theme.borderRadius.card,
    // borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  actionIcon: {
    fontSize: theme.fontSize.iconLg,
    marginBottom: theme.spacing.xs,
  },
  actionLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.foreground,
  },
  actionMeta: {
    alignItems: 'center'
  },
  actionCount: {
    fontFamily: theme.typography.phosphateSolid,
    fontSize: theme.fontSize.cardText,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  actionType: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.foreground,
  },
  activityContainer: {
    backgroundColor: theme.colors.settings,
    padding: theme.spacing.base,
    gap: theme.spacing.base,
    borderRadius: theme.borderRadius.card


  },
  cardHeader: {
    fontSize: theme.fontSize.header,
    fontWeight: theme.fontWeight.medium,
    fontFamily: theme.fontFamily
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    // marginBottom: theme.spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.pill,
      borderWidth:1,
    borderColor:theme.colors.borderColor,
  
  },
  filterTab: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.pill,
    marginLeft: theme.spacing.xs,

  },
  filterTabActive: {
    backgroundColor: theme.colors.accent,
  },
  filterText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.baseColor,
  },
  filterTextActive: {
    color: theme.colors.onAccent,
  },
  feedItem: {
    marginBottom: theme.spacing.md,
  },
  thumbnail: {
    marginBottom: theme.spacing.sm,
  },
  placeholderImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.warmBg,
    borderRadius: theme.borderRadius.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  placeholderText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
  },
  feedMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedTime: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyIcon: {
    fontSize: theme.fontSize.iconXl,
    marginBottom: theme.spacing.base,
  },
  emptyTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  emptyMessage: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.message,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.lg,

  },
});
