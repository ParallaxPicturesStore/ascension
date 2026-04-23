import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Alert, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ScreenLayout,
  Card,
  Button,
  Input,
  SectionHeader,
  Badge,
  theme,
} from '@ascension/ui';
import type { UserProfile, SubscriptionStatus } from '../src/hooks/useApi';
import { useApi } from '../src/hooks/useApi';
import { useAuth } from '../src/hooks/useAuth';

const STATUS_BADGE_MAP: Record<string, { text: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  active: { text: 'Active', variant: 'success' },
  trial: { text: 'Trial', variant: 'neutral' },
  cancelled: { text: 'Cancelled', variant: 'warning' },
  expired: { text: 'Expired', variant: 'danger' },
};

export default function SettingsScreen() {
  const router = useRouter();
  const api = useApi();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('trial');
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [partnerEmail, setPartnerEmail] = useState('');
  const [savingPartner, setSavingPartner] = useState(false);

  const [managingSubscription, setManagingSubscription] = useState(false);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      api.users.getProfile(user.id),
      api.billing.getSubscriptionStatus(user.id),
    ])
      .then(([profileData, status]) => {
        setProfile(profileData);
        setSubscriptionStatus(status);
        setNameValue(profileData.name ?? '');
        setPartnerEmail(profileData.partner_email ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, user]);

  const handleSaveName = async () => {
    if (!user || !nameValue.trim()) return;

    setSavingName(true);
    try {
      await api.users.updateProfile(user.id, { name: nameValue.trim() });
      setProfile((prev) => (prev ? { ...prev, name: nameValue.trim() } : prev));
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdatePartner = async () => {
    const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();

    if (!user || !normalizedPartnerEmail) return;

    if (normalizedPartnerEmail === user.email.trim().toLowerCase()) {
      Alert.alert('Invalid Partner', "You can't be your own accountability partner.");
      return;
    }

    setSavingPartner(true);
    try {
      await api.users.updateProfile(user.id, {
        partner_email: normalizedPartnerEmail,
      });

      const latestProfile = await api.users.getProfile(user.id);
      const inviteCode = user.id;
      await api.alerts.invitePartner(
        normalizedPartnerEmail,
        latestProfile.name || 'Your partner',
        inviteCode,
      );

      setProfile((prev) =>
        prev ? { ...prev, partner_email: normalizedPartnerEmail } : prev,
      );
      setPartnerEmail(normalizedPartnerEmail);
      Alert.alert('Partner Updated', 'Your accountability partner has been updated and invited.');
    } catch {
      Alert.alert('Error', 'Failed to update partner. Please try again.');
    } finally {
      setSavingPartner(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    setManagingSubscription(true);
    try {
      const customerId = await api.billing.getCustomerId(user.id);
      if (!customerId) {
        Alert.alert('No Subscription', 'No active subscription found to manage.');
        return;
      }
      const session = await api.billing.createPortalSession(customerId);
      if (!session?.url) {
        Alert.alert('Error', 'Could not open subscription portal. Please try again.');
        return;
      }
      await Linking.openURL(session.url);
    } catch {
      Alert.alert('Error', 'Failed to open subscription portal.');
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenLayout title="Settings" scrollable={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </ScreenLayout>
    );
  }

  const badge = STATUS_BADGE_MAP[subscriptionStatus] ?? STATUS_BADGE_MAP.trial;

  return (
    <ScreenLayout title="Settings">
      {/* Profile */}
      <SectionHeader title="Profile" />
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email ?? ''}</Text>
        </View>

        <View style={styles.divider} />

        {editingName ? (
          <View>
            <Input
              label="Name"
              value={nameValue}
              onChangeText={setNameValue}
              autoCapitalize="words"
            />
            <View style={styles.editActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  setEditingName(false);
                  setNameValue(profile?.name ?? '');
                }}
              />
              <Button
                title={savingName ? 'Saving...' : 'Save'}
                onPress={handleSaveName}
                disabled={savingName}
              />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.editRow}>
              <Text style={styles.value}>{profile?.name ?? 'Not set'}</Text>
              <Button
                title="Edit"
                variant="ghost"
                onPress={() => setEditingName(true)}
                style={styles.editButton}
              />
            </View>
          </View>
        )}
      </Card>

      {/* Partner */}
      <SectionHeader
        title="Accountability Partner"
        style={styles.sectionSpacer}
      />
      <Card style={styles.card}>
        <Input
          label="Partner Email"
          placeholder="partner@email.com"
          value={partnerEmail}
          onChangeText={setPartnerEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button
          title={savingPartner ? 'Updating...' : 'Update Partner'}
          variant="secondary"
          onPress={handleUpdatePartner}
          disabled={savingPartner}
        />
      </Card>

      {/* Subscription */}
      <SectionHeader title="Subscription" style={styles.sectionSpacer} />
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Badge text={badge.text} variant={badge.variant} />
        </View>

        {subscriptionStatus === 'trial' && (
          <Button
            title="View Plans"
            variant="primary"
            onPress={() => router.push('/pricing')}
            style={styles.planButton}
          />
        )}

        {(subscriptionStatus === 'active' || subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired') && (
          <Button
            title={managingSubscription ? 'Opening...' : 'Manage Subscription'}
            variant="secondary"
            onPress={handleManageSubscription}
            disabled={managingSubscription}
            style={styles.planButton}
          />
        )}
      </Card>

      {/* Notifications */}
      <SectionHeader title="Notifications" style={styles.sectionSpacer} />
      <Card style={styles.card}>
        <Text style={styles.notifDescription}>
          Push notifications are used to alert you about streak milestones,
          partner encouragements, and account updates.
        </Text>
      </Card>

      {/* About */}
      <SectionHeader title="About" style={styles.sectionSpacer} />
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>0.1.0</Text>
        </View>
      </Card>

      {/* Sign out */}
      <View style={styles.signOutSection}>
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleSignOut}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: theme.spacing.sm,
  },
  sectionSpacer: {
    marginTop: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.cardBorder,
    marginVertical: theme.spacing.md,
  },
  label: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
  },
  value: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  editButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  planButton: {
    marginTop: theme.spacing.base,
  },
  notifDescription: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
  },
  signOutSection: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
});
