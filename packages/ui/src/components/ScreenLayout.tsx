import React, { type ReactNode } from 'react';
import { StyleSheet, View, ScrollView, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export interface ScreenLayoutProps {
  title?: string;
  children: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
}

export function ScreenLayout({ title, children, scrollable = true, style }: ScreenLayoutProps) {
  const content = (
    <View style={[styles.inner, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  title: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.lg,
  },
});
