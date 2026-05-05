import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
}

export function Card({ children, header, footer, style }: CardProps) {
  return (
    <View style={[styles.container, style]}>
      {header && <View style={styles.header}>{header}</View>}
      <View style={styles.body}>{children}</View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadow.subtle,
  },
  header: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  body: {
    padding: theme.spacing.base,
    fontSize : theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.cardText,
  },
  footer: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
  },
});
