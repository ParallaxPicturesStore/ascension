import React from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { type AlertType, ALERT_TYPE_ICONS, ALERT_TYPE_LABELS, formatRelativeTime, getAlertSeverity } from '@ascension/shared';
import { WarningIcon } from '@/assets/icons';

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

export const AlertItem = React.memo(function AlertItem({ type, message, timestamp, read = false, style }: AlertItemProps) {
  const severity = getAlertSeverity(type as AlertType);
  const icon = ALERT_TYPE_ICONS[type as AlertType] || '\u{1F514}';
  const label = ALERT_TYPE_LABELS[type as AlertType] || type;

  return (
    <View style={[styles.container, !read && styles.unread, style]}>
      {/* <Text style={styles.icon}>{icon}</Text> */}
      <WarningIcon/>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.type]}>{label}</Text>
          <Text style={styles.time}>{formatRelativeTime(timestamp)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: theme.borderRadius.card,
    // borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: theme.spacing.md,
    gap:theme.spacing.md,
    opacity:0.8
  },
  unread: {
    opacity:1,
    backgroundColor: theme.colors.accentLight,
  },
  icon: {
    fontSize: theme.fontSize.iconMd,
    marginRight: theme.spacing.md,
    marginTop: theme.spacing.xs / 2,
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
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
  },
  time: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.intro,
  },
  message: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.intro,
    fontWeight:theme.fontWeight.regular,
    lineHeight: 20,
  },
});
