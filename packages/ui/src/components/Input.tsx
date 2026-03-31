import React, { useState } from 'react';
import { StyleSheet, TextInput, View, Text, type ViewStyle, type TextInputProps } from 'react-native';
import { theme } from '../theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  style?: ViewStyle;
}

export function Input({ label, error, style, ...textInputProps }: InputProps) {
  const [focused, setFocused] = useState(false);

  const inputBorderColor = error
    ? theme.colors.danger
    : focused
    ? theme.colors.accent
    : theme.colors.cardBorder;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...textInputProps}
        style={[styles.input, { borderColor: inputBorderColor }]}
        placeholderTextColor={theme.colors.muted}
        onFocus={(e) => {
          setFocused(true);
          textInputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          textInputProps.onBlur?.(e);
        }}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.base,
  },
  label: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  input: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  error: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
});
