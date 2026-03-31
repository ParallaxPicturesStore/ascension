import React from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { type AlertType, ALERT_TYPE_ICONS, ALERT_TYPE_LABELS, formatRelativeTime, getAlertSeverity } from '@ascension/shared';

export interface AlertItemProps {
  type: AlertType | string;
  message: string;
  timestamp: string;
  read?: boolean;
  style?: ViewStyle;
}

const SEVERITY_COLORS = {
  critical: theme.colors.danger,
  warning: theme.colors.warning,
  info: theme.colors.muted,
};

export function AlertItem({ type, message, timestamp, read = false, style }: AlertItemProps) {
  const severity = getAlertSeverity(type as AlertType);
  const icon = ALERT_TYPE_ICONS[type as AlertType] || '\u{1F514}';
  const label = ALERT_TYPE_LABELS[type as AlertType] || type;

  return (
    <View style={[styles.container, !read && styles.unread, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.type, { color: SEVERITY_COLORS[severity] }]}>{label}</Text>
          <Text style={styles.time}>{formatRelativeTime(timestamp)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: theme.spacing.sm,
  },
  unread: {
    backgroundColor: theme.colors.accentLight,
  },
  icon: {
    fontSize: 20,
    marginRight: theme.spacing.md,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  type: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.bold,
  },
  time: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
  },
  message: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
    lineHeight: 20,
  },
});
