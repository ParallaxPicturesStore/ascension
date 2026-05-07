import React, { type ReactNode } from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { BackButton } from './Button';

export interface HeaderProps {
  /** Title shown centered in the header. */
  title?: string;
  /** Show the circular back button on the left. */
  showBack?: boolean;
  /** Called when the back button is pressed. */
  onBack?: () => void;
  /** Optional element rendered on the right side (e.g. action button, avatar). */
  rightSlot?: ReactNode;
  /** Optional element overriding the left side (replaces back button). */
  leftSlot?: ReactNode;
  style?: ViewStyle;
}

const SLOT_SIZE = theme.components.backButton.size;

export function Header({
  title,
  showBack = false,
  onBack,
  rightSlot,
  leftSlot,
  style,
}: HeaderProps) {
  const left = leftSlot ?? (showBack ? <BackButton onPress={onBack} /> : null);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.slot}>{left}</View>

      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.titleSpacer} />
      )}

      <View style={[styles.slot, styles.slotRight]}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  slotRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    lineHeight: theme.lineHeight.bodyLg,
    color: theme.colors.cardText,
    textAlign: 'center',
  },
  titleSpacer: {
    flex: 1,
  },
});
