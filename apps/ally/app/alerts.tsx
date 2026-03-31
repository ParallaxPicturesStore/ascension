import React, { useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { theme, ScreenLayout, AlertItem, Badge } from '@ascension/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { useApi } from '@/hooks/useApi';
import type { Alert as AlertData } from '@ascension/api';

export default function AlertsScreen() {
  const api = useApi();
  const { session } = useAuth();
  const { alerts, loading, refresh } = usePartner(session?.user?.id);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const handleMarkRead = useCallback(
    async (alertId: string) => {
      try {
        await api.alerts.markRead(alertId);
        // Refresh to get updated read status
        await refresh();
      } catch {
        // Non-critical
      }
    },
    [api, refresh],
  );

  function renderAlert({ item }: { item: AlertData }) {
    return (
      <TouchableOpacity
        onPress={() => {
          if (!item.read) handleMarkRead(item.id);
        }}
        activeOpacity={0.7}
      >
        <AlertItem
          type={item.type}
          message={item.message}
          timestamp={item.timestamp}
          read={item.read}
        />
      </TouchableOpacity>
    );
  }

  function renderEmpty() {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{'\u{1F389}'}</Text>
        <Text style={styles.emptyTitle}>No alerts</Text>
        <Text style={styles.emptyMessage}>
          Your partner is doing great - no alerts to report. This is a good
          sign.
        </Text>
      </View>
    );
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        {unreadCount > 0 && (
          <Badge
            text={`${unreadCount} unread`}
            variant="warning"
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 48,
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
