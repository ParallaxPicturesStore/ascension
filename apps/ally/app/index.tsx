import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  theme,
  ScreenLayout,
  Card,
  Badge,
  BlurredImage,
  Avatar,
  SectionHeader,
} from '@ascension/ui';
import { formatRelativeTime } from '@ascension/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { useApi } from '@/hooks/useApi';
import type { Screenshot } from '@ascension/api';

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

  // Fetch screenshots on mount and refresh
  const loadScreenshots = useCallback(async () => {
    if (!partner) return;
    setScreenshotsLoading(true);
    try {
      const recent = await api.screenshots.getRecent(partner.id, 50);
      setScreenshots(recent);
    } catch {
      // Silently handle - partner data may still be available
    } finally {
      setScreenshotsLoading(false);
    }
  }, [api, partner]);

  React.useEffect(() => {
    loadScreenshots();
  }, [loadScreenshots]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), loadScreenshots()]);
  }, [refresh, loadScreenshots]);

  const filteredScreenshots =
    filter === 'flagged'
      ? screenshots.filter((s) => s.flagged)
      : screenshots;

  const unreadAlertCount = alerts.filter((a) => !a.read).length;
  const partnerName = partner?.name ?? 'Your partner';

  function renderScreenshotItem({ item }: { item: Screenshot }) {
    return (
      <Card style={styles.feedItem}>
        {item.file_path ? (
          <BlurredImage
            source={{ uri: item.file_path }}
            blurRadius={30}
            style={styles.thumbnail}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No preview</Text>
          </View>
        )}
        <View style={styles.feedMeta}>
          <Text style={styles.feedTime}>
            {formatRelativeTime(item.timestamp)}
          </Text>
          {item.flagged && <Badge text="Flagged" variant="warning" />}
        </View>
      </Card>
    );
  }

  function renderHeader() {
    return (
      <View>
        {/* Partner header */}
        <View style={styles.partnerHeader}>
          <Avatar name={partnerName} size={48} />
          <View style={styles.partnerInfo}>
            <Text style={styles.greeting}>
              How {partnerName} is doing
            </Text>
            {streak && (
              <Text style={styles.streakPreview}>
                {streak.current_streak} day streak
              </Text>
            )}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/streak')}
          >
            <Text style={styles.actionIcon}>{'\u{1F525}'}</Text>
            <Text style={styles.actionLabel}>Streak</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/encourage')}
          >
            <Text style={styles.actionIcon}>{'\u{1F4AC}'}</Text>
            <Text style={styles.actionLabel}>Encourage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/alerts')}
          >
            <Text style={styles.actionIcon}>{'\u{1F514}'}</Text>
            <Text style={styles.actionLabel}>
              Alerts{unreadAlertCount > 0 ? ` (${unreadAlertCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.actionIcon}>{'\u{2699}\u{FE0F}'}</Text>
            <Text style={styles.actionLabel}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          <SectionHeader title="Activity Feed" />
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
      </View>
    );
  }

  function renderEmpty() {
    if (screenshotsLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{'\u{2728}'}</Text>
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
    <View style={styles.container}>
      <FlatList
        data={filteredScreenshots}
        keyExtractor={(item) => item.id}
        renderItem={renderScreenshotItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  partnerInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  greeting: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
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
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  actionIcon: {
    fontSize: theme.fontSize.iconLg,
    marginBottom: theme.spacing.xs,
  },
  actionLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  filters: {
    flexDirection: 'row',
  },
  filterTab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.pill,
    marginLeft: theme.spacing.xs,
  },
  filterTabActive: {
    backgroundColor: theme.colors.accent,
  },
  filterText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
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
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  emptyMessage: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.lg,
  },
});
