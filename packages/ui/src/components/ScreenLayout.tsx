import React, { type ReactNode } from 'react';
import { StyleSheet, View, ScrollView, Text, Platform, type ViewStyle, type RefreshControlProps } from 'react-native';
import { theme } from '../theme';

// Use SafeAreaView on native, plain View on web
let SafeAreaView: typeof View;
try {
  SafeAreaView = require('react-native-safe-area-context').SafeAreaView;
} catch {
  SafeAreaView = View;
}

export interface ScreenLayoutProps {
  title?: string;
  children: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function ScreenLayout({ title, children, scrollable = true, style, refreshControl }: ScreenLayoutProps) {
  const content = (
    <View style={[styles.inner, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );

  const Wrapper = Platform.OS === 'web' ? View : SafeAreaView;

  if (scrollable) {
    return (
      <Wrapper style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      </Wrapper>
    );
  }

  return <Wrapper style={styles.container}>{content}</Wrapper>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
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
