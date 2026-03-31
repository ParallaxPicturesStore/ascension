import React from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  style?: ViewStyle;
}

export function StreakCounter({ currentStreak, longestStreak, style }: StreakCounterProps) {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="text"
      accessibilityLabel={`Current streak: ${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}. Longest streak: ${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}.`}
    >
      <Text style={styles.number}>{currentStreak}</Text>
      <Text style={styles.label}>{currentStreak === 1 ? 'day' : 'days'}</Text>
      <Text style={styles.longest}>Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  number: {
    fontFamily: theme.fontFamily,
    fontSize: 64,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
    lineHeight: 72,
  },
  label: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
  longest: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
  },
});
