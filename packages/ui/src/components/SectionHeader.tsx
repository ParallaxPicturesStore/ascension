import React from 'react';
import { StyleSheet, View, Text, type ViewStyle, TextStyle } from 'react-native';
import { theme } from '../theme';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function SectionHeader({ title, subtitle, style, textStyle }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, textStyle]}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.base,
  },
  title: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.intro,
    marginTop: theme.spacing.xs,
  },
});
