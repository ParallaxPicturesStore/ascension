import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { SvgProps } from 'react-native-svg';
import { ScreenLayout, Header, Input, Button, Card, theme } from '@ascension/ui';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/hooks/useAuth';
import AlertIcon from '../../assets/icons/alert.svg';
import BlockIcon from '../../assets/icons/block.svg';
import GraphIcon from '../../assets/icons/graph.svg';
import ProtectIcon from '../../assets/icons/Protect.svg';
import SecureIcon from '../../assets/icons/secure.svg';

type PartnerVisibilityItem = {
  Icon: React.FC<SvgProps>;
  text: string;
};

const PARTNER_VISIBILITY_ITEMS: PartnerVisibilityItem[] = [
  { Icon: GraphIcon, text: 'Your current streak and progress' },
  { Icon: AlertIcon, text: 'Alerts when concerning content is detected' },
  { Icon: BlockIcon, text: 'Blocked access attempts' },
  { Icon: SecureIcon, text: 'They will NOT see screenshots or specific URLs' },
  { Icon: ProtectIcon, text: 'They will NOT see your browsing history' },
];

export default function OnboardingPartnerScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

  const [partnerEmail, setPartnerEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const trimmedPartnerEmail = partnerEmail.trim();
  const primaryButtonStyle = sent || trimmedPartnerEmail
    ? styles.primaryButtonActive
    : styles.primaryButtonDisabled;

  const handleInvite = async () => {
    const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();

    if (!normalizedPartnerEmail) {
      setError('Please enter your partner\'s email.');
      return;
    }

    if (!user) return;

    if (normalizedPartnerEmail === user.email.trim().toLowerCase()) {
      setError("You can't be your own accountability partner.");
      return;
    }

    setError(null);
    setSending(true);

    try {
      await api.users.updateProfile(user.id, {
        partner_email: normalizedPartnerEmail,
      });

      const profile = await api.users.getProfile(user.id);
      const inviteCode = user.id; // Using user ID as invite code for simplicity; can be changed to a generated token if needed
      await api.alerts.invitePartner(
        normalizedPartnerEmail,
        profile.name || 'Your partner',
        inviteCode,
      );

      setSent(true);
      setPartnerEmail(normalizedPartnerEmail);
    } catch {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/confirm');
  };

  return (
    <ScreenLayout>
      <View style={styles.screen}>
        <View>
          <Header
            title="Create account"
            showBack
            onBack={() => router.back()}
          />

          <View style={styles.hero}>
            <Text style={styles.stepIndicator}>STEP 2 OF 3</Text>
            <Text style={styles.heading}>Choose your partner</Text>
            <Text style={styles.subheading}>
              Pick someone you trust. A friend, partner or mentor who will hold you
              accountable. Your partner will receive an email invitation to create
              their account.
            </Text>
          </View>

          {sent ? (
            <Card style={styles.successCard}>
              <Text style={styles.successTitle}>Invitation sent</Text>
              <Text style={styles.successText}>
                We sent an invite to {partnerEmail}. They will receive instructions
                to create their account.
              </Text>
            </Card>
          ) : (
            <View>
              <Input
                label="Partner's email"
                placeholder="Enter partner's email"
                value={partnerEmail}
                onChangeText={setPartnerEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
              />

              <Card style={styles.infoCard}>
                <Text style={styles.infoTitle}>What will your partner see?</Text>
                <View style={styles.infoList}>
                  {PARTNER_VISIBILITY_ITEMS.map((item) => (
                    <View key={item.text} style={styles.infoRow}>
                      <View style={styles.infoIconWrap}>
                        <item.Icon width={24} height={24} />
                      </View>
                      <Text style={styles.infoText}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.footer}>
          <Button
            title={sent ? 'Continue' : sending ? 'Sending...' : 'Send Invite & Continue'}
            onPress={sent ? handleContinue : handleInvite}
            disabled={!sent && (sending || !trimmedPartnerEmail)}
            style={primaryButtonStyle}
          />

          {!sent ? (
            <Button
              title="Skip for now - I'll add a partner later"
              onPress={handleContinue}
              variant="ghost"
              style={styles.secondaryButton}
            />
          ) : null}
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    gap: theme.spacing.xl,
  },
  hero: {
    marginBottom: theme.spacing.xl,
  },
  stepIndicator: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    letterSpacing: 1,
    marginBottom: theme.spacing.base,
  },
  heading: {
    fontFamily: theme.typography.headingFamily,
    fontSize: 30,
    fontWeight: theme.fontWeight.semiBold,
    lineHeight: 36,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.base,
  },
  subheading: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.h3,
    lineHeight: 38,
    color: '#5E5E67',
  },
  input: {
    marginBottom: theme.spacing.lg,
  },
  infoCard: {
    backgroundColor: '#F6F7FB',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  infoTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: 24,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  infoList: {
    gap: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  infoIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  error: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: theme.spacing.base,
  },
  footer: {
    gap: theme.spacing.base,
    paddingBottom: theme.spacing.base,
  },
  primaryButtonActive: {
    backgroundColor: theme.colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonDisabled: {
    backgroundColor: '#CBD3E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  successCard: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.success,
  },
  successTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.success,
    marginBottom: theme.spacing.sm,
  },
  successText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.success,
    lineHeight: 22,
  },
});
