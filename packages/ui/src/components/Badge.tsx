import React from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const DOT_COLORS: Record<BadgeVariant, string> = {
  success: theme.colors.success,
  warning: theme.colors.warning,
  danger: theme.colors.danger,
  neutral: theme.colors.muted,
};

const BG_COLORS: Record<BadgeVariant, string> = {
  success: '#f0fdf4',
  warning: '#fffbeb',
  danger: '#fef2f2',
  neutral: theme.colors.warmBg,
};

export function Badge({ text, variant = 'neutral', style }: BadgeProps) {
  return (
    <View style={[styles.container, { backgroundColor: BG_COLORS[variant] }, style]}>
      <View style={[styles.dot, { backgroundColor: DOT_COLORS[variant] }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: theme.spacing.xs,
  },
  text: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
});
