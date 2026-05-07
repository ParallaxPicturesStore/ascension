import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Platform,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { theme } from '../theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONFIRMATION_SVG = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.3333 9.16667C18.3333 14.2293 14.2293 18.3333 9.16667 18.3333C4.10406 18.3333 0 14.2293 0 9.16667C0 4.10406 4.10406 0 9.16667 0C14.2293 0 18.3333 4.10406 18.3333 9.16667Z" fill="#67A869"/><path d="M13.7777 7.36108L8.24995 12.8888L4.55553 9.19442L5.5277 8.22225L8.24995 10.9445L12.8055 6.38892L13.7777 7.36108Z" fill="white"/></svg>`;

const EYE_CLOSED_SVG = `<svg width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.833333 1.05833L1.9 0L15.8333 13.9333L14.775 15L12.2083 12.4333C11.25 12.75 10.2333 12.9167 9.16667 12.9167C5 12.9167 1.44167 10.325 0 6.66667C0.575 5.2 1.49167 3.90833 2.65833 2.88333L0.833333 1.05833ZM9.16667 4.16667C9.82971 4.16667 10.4656 4.43006 10.9344 4.8989C11.4033 5.36774 11.6667 6.00363 11.6667 6.66667C11.6671 6.95047 11.6192 7.23228 11.525 7.5L8.33333 4.30833C8.60106 4.21415 8.88286 4.16625 9.16667 4.16667ZM9.16667 0.416667C13.3333 0.416667 16.8917 3.00833 18.3333 6.66667C17.6528 8.39411 16.4971 9.8936 15 10.9917L13.8167 9.8C14.9691 9.00287 15.8986 7.92425 16.5167 6.66667C15.843 5.29155 14.7971 4.13303 13.4978 3.32279C12.1985 2.51256 10.6979 2.08314 9.16667 2.08333C8.25833 2.08333 7.36667 2.23333 6.53333 2.5L5.25 1.225C6.45 0.708333 7.775 0.416667 9.16667 0.416667ZM1.81667 6.66667C2.49029 8.04178 3.53621 9.20031 4.83553 10.0105C6.13485 10.8208 7.63543 11.2502 9.16667 11.25C9.74167 11.25 10.3083 11.1917 10.8333 11.075L8.93333 9.16667C8.35347 9.10451 7.81235 8.84573 7.39998 8.43335C6.9876 8.02098 6.72882 7.47986 6.66667 6.9L3.83333 4.05833C3.00833 4.76667 2.31667 5.65 1.81667 6.66667Z" fill="#666666"/></svg>`;

const EYE_OPEN_SVG = `<svg width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.16667 0.416667C13.3333 0.416667 16.8917 3.00833 18.3333 6.66667C16.8917 10.325 13.3333 12.9167 9.16667 12.9167C5 12.9167 1.44167 10.325 0 6.66667C1.44167 3.00833 5 0.416667 9.16667 0.416667ZM9.16667 2.08333C7.63543 2.08314 6.13485 2.51256 4.83553 3.32279C3.53621 4.13303 2.49029 5.29155 1.81667 6.66667C2.49029 8.04178 3.53621 9.20031 4.83553 10.0105C6.13485 10.8208 7.63543 11.2502 9.16667 11.25C10.6979 11.2502 12.1985 10.8208 13.4978 10.0105C14.7971 9.20031 15.843 8.04178 16.5167 6.66667C15.843 5.29155 14.7971 4.13303 13.4978 3.32279C12.1985 2.51256 10.6979 2.08314 9.16667 2.08333ZM9.16667 4.16667C9.82971 4.16667 10.4656 4.43006 10.9344 4.8989C11.4033 5.36774 11.6667 6.00363 11.6667 6.66667C11.6667 7.32971 11.4033 7.96559 10.9344 8.43443C10.4656 8.90327 9.82971 9.16667 9.16667 9.16667C8.50363 9.16667 7.86774 8.90327 7.3989 8.43443C6.93006 7.96559 6.66667 7.32971 6.66667 6.66667C6.66667 6.00363 6.93006 5.36774 7.3989 4.8989C7.86774 4.43006 8.50363 4.16667 9.16667 4.16667Z" fill="#666666"/></svg>`;

function ConfirmationIcon() {
  return <SvgXml xml={CONFIRMATION_SVG} width={19} height={19} />;
}

function EyeClosedIcon() {
  return <SvgXml xml={EYE_CLOSED_SVG} width={19} height={15} />;
}

function EyeOpenIcon() {
  return <SvgXml xml={EYE_OPEN_SVG} width={19} height={15} />;
}

const borderStyles = StyleSheet.create({
  default: { borderColor: theme.colors.border },
  focused: { borderColor: theme.colors.primary },
  error:   { borderColor: theme.colors.danger },
});

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  style?: ViewStyle;
}

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export function Input({ label, error, style, ...textInputProps }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isEmailField = useMemo(
    () =>
      textInputProps.keyboardType === 'email-address' ||
      textInputProps.autoComplete === 'email' ||
      textInputProps.textContentType === 'emailAddress',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textInputProps.keyboardType, textInputProps.autoComplete, textInputProps.textContentType],
  );

  const isPasswordField = useMemo(
    () =>
      textInputProps.secureTextEntry === true ||
      textInputProps.textContentType === 'password' ||
      textInputProps.textContentType === 'newPassword' ||
      textInputProps.autoComplete === 'password' ||
      (textInputProps.autoComplete as string) === 'new-password',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textInputProps.secureTextEntry, textInputProps.textContentType, textInputProps.autoComplete],
  );

  const emailValid = useMemo(
    () => isEmailField && typeof textInputProps.value === 'string' && EMAIL_REGEX.test(textInputProps.value),
    [isEmailField, textInputProps.value],
  );

  const handleFocus = useCallback(
    (e: any) => { setFocused(true); textInputProps.onFocus?.(e); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textInputProps.onFocus],
  );

  const handleBlur = useCallback(
    (e: any) => { setFocused(false); textInputProps.onBlur?.(e); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textInputProps.onBlur],
  );

  const togglePassword = useCallback(() => setPasswordVisible((v) => !v), []);

  const resolvedSecureTextEntry = isPasswordField ? !passwordVisible : textInputProps.secureTextEntry;
  const wrapperBorder = error ? borderStyles.error : focused ? borderStyles.focused : borderStyles.default;
  const wrapperBg = textInputProps.editable === false ? styles.wrapperDisabled : styles.wrapperEnabled;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, wrapperBorder, wrapperBg, error ? styles.inputError : null]}>
        <TextInput
          {...textInputProps}
          secureTextEntry={resolvedSecureTextEntry}
          style={styles.input}
          placeholderTextColor={theme.colors.muted}
          accessibilityLabel={label ?? textInputProps.placeholder}
          accessibilityState={{ disabled: textInputProps.editable === false }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {(isEmailField || isPasswordField) && (
          <View style={styles.rightSlot}>
            {isEmailField && emailValid && (
              <View style={styles.emailCheck}>
                <ConfirmationIcon />
              </View>
            )}
            {isPasswordField && (
              <TouchableOpacity onPress={togglePassword} hitSlop={HIT_SLOP} accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} accessibilityRole="button">
                {passwordVisible ? <EyeOpenIcon /> : <EyeClosedIcon />}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {  },
  label: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: theme.components.input.borderWidth,
    borderRadius: theme.borderRadius.xl,
    minHeight: theme.components.input.height,
    paddingHorizontal: theme.spacing.base,
  },
  wrapperEnabled:  { backgroundColor: theme.colors.surface },
  wrapperDisabled: { backgroundColor: theme.colors.warmBg },
  input: {
    flex: 1,
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    // lineHeight intentionally omitted: causes TextInput lag/jank on Android
    color: theme.colors.textPrimary,
    paddingVertical: Platform.OS === 'android' ? 0 : theme.spacing.md,
    paddingHorizontal: 0,
  },
  inputError:  { backgroundColor: theme.colors.dangerLight },
  rightSlot:   { marginLeft: theme.spacing.sm, justifyContent: 'center', alignItems: 'center' },
  emailCheck:  { width: 19, height: 19, justifyContent: 'center', alignItems: 'center' },
  error: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
});
