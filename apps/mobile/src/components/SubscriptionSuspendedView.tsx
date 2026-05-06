import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Button, theme } from '@ascension/ui';
import SubscriptionAlertIcon from '../../assets/icons/subscription_alert.svg';

export type SubscriptionBlockReason = 'expired' | 'cancelled' | 'trial_expired';

interface SubscriptionSuspendedViewProps {
  reason: SubscriptionBlockReason;
  onPrimaryAction: () => void;
}

const COPY: Record<SubscriptionBlockReason, { title: string; body: string; button: string }> = {
  expired: {
    title: 'Access suspended',
    body: "Your Ascension subscription has ended. Renew to restore full monitoring and your partner's dashboard access.",
    button: 'Renew subscription',
  },
  cancelled: {
    title: 'Access suspended',
    body: "Your Ascension subscription has ended. Renew to restore full monitoring and your partner's dashboard access.",
    button: 'Renew subscription',
  },
  trial_expired: {
    title: 'Trial ended',
    body: 'Your 14-day free trial has expired. Pick a plan to continue monitoring and keep your partner informed.',
    button: 'View plans',
  },
};

export function SubscriptionSuspendedView({ reason, onPrimaryAction }: SubscriptionSuspendedViewProps) {
  const copy = COPY[reason];

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>ASCENSION</Text>

      <SubscriptionAlertIcon width={72} height={73} style={styles.alertIcon} />

      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <Button title={copy.button} onPress={onPrimaryAction} style={styles.primaryButton} />

      <Text style={styles.footer}>On-device site blocking continues while suspended.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  brand: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 1.2,
    color: '#4D4F57',
    marginBottom: 34,
    textTransform: 'uppercase',
  },
  alertIcon: {
    marginBottom: 24,
  },
  title: {
    fontFamily: theme.typography.headingFamily,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: theme.fontWeight.bold,
    color: '#10131B',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: 17,
    lineHeight: 27,
    color: '#50545F',
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: 22,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 32,
    marginBottom: 12,
  },
  footer: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: 16,
    lineHeight: 22,
    color: '#50545F',
    textAlign: 'center',
  },
});
