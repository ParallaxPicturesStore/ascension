import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Input, Button, Card, theme } from '@ascension/ui';
import { useApi } from '@ascension/api';
import { useAuth } from '../../src/hooks/useAuth';

export default function OnboardingPartnerScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

  const [partnerEmail, setPartnerEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleInvite = async () => {
    if (!partnerEmail.trim()) {
      setError('Please enter your partner\'s email.');
      return;
    }

    if (!user) return;

    setError(null);
    setSending(true);

    try {
      await api.users.updateProfile(user.id, {
        partner_email: partnerEmail.trim().toLowerCase(),
      });
      setSent(true);
    } catch {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleNext = () => {
    router.push('/onboarding/confirm');
  };

  return (
    <ScreenLayout title="Invite a Partner">
      <Text style={styles.stepIndicator}>Step 2 of 3</Text>

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>What is an accountability partner?</Text>
        <Text style={styles.infoBody}>
          Your partner receives alerts if concerning activity is detected on your
          devices. They can see your streak progress and send you words of
          encouragement. Choose someone you trust - a spouse, close friend, or
          mentor.
        </Text>
      </Card>

      <View style={styles.partnerSection}>
        <Text style={styles.partnerLabel}>What will your partner see?</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>Your current streak and progress</Text>
          <Text style={styles.bullet}>Alerts when concerning content is detected</Text>
          <Text style={styles.bullet}>Blocked access attempts</Text>
          <Text style={styles.bullet}>They will NOT see screenshots or specific URLs</Text>
        </View>
      </View>

      {sent ? (
        <Card style={styles.successCard}>
          <Text style={styles.successText}>
            Invitation sent to {partnerEmail}! They will receive an email with
            instructions to set up their account.
          </Text>
        </Card>
      ) : (
        <View style={styles.form}>
          <Input
            label="Partner's Email"
            placeholder="partner@email.com"
            value={partnerEmail}
            onChangeText={setPartnerEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title={sending ? 'Sending...' : 'Invite Partner'}
            onPress={handleInvite}
            disabled={sending}
          />
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title={sent ? 'Continue' : 'Skip for now'}
          variant={sent ? 'primary' : 'ghost'}
          onPress={handleNext}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stepIndicator: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
  },
  infoCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.warmBg,
    borderColor: theme.colors.cardBorder,
  },
  infoTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  infoBody: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
  },
  partnerSection: {
    marginBottom: theme.spacing.lg,
  },
  partnerLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  bulletList: {
    gap: theme.spacing.xs,
  },
  bullet: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    paddingLeft: theme.spacing.base,
    lineHeight: 22,
  },
  form: {
    marginBottom: theme.spacing.base,
  },
  error: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing.base,
  },
  successCard: {
    marginBottom: theme.spacing.base,
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.success,
  },
  successText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.success,
    lineHeight: 22,
  },
  actions: {
    marginTop: theme.spacing.lg,
  },
});
