import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle, type TextStyle } from 'react-native';
import { theme } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'inverse' | 'danger' | 'ghost';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  leftSlot?: ReactNode;
}

export interface BackButtonProps {
  onPress: () => void;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, style, leftSlot }: ButtonProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[variant],
    disabled && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
    disabled && styles.disabledText,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      <View style={styles.content}>
        {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : null}
        <Text style={textStyle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function BackButton({ onPress, style }: BackButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.backButton, style]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
    >
      <View style={styles.backChevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: theme.components.backButton.size,
    height: theme.components.backButton.size,
    borderRadius: theme.borderRadius.circle,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: theme.colors.primary,
    transform: [{ rotate: '45deg' }, { translateX: 1 }],
  },
  base: {
    minHeight: theme.components.button.height,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.light,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  inverse: {
    backgroundColor: theme.colors.secondary,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftSlot: {
    marginRight: theme.spacing.sm,
  },
  text: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.button,
    lineHeight: theme.lineHeight.button,
    fontWeight: theme.fontWeight.semiBold,
  },
  primaryText: {
    color: theme.colors.onPrimary,
  },
  secondaryText: {
    color: theme.colors.textPrimary,
  },
  outlineText: {
    color: theme.colors.textPrimary,
  },
  inverseText: {
    color: theme.colors.surface,
  },
  dangerText: {
    color: theme.colors.onPrimary,
  },
  ghostText: {
    color: theme.colors.primary,
  },
  disabledText: {
    opacity: 0.7,
  },
});
