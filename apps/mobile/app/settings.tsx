import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Alert, ActivityIndicator, Linking, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScreenLayout,
  Card,
  Button,
  BackButton,
  Input,
  SectionHeader,
  theme,
} from '@ascension/ui';
import type { UserProfile, SubscriptionStatus } from '@ascension/api';
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

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navWidth = Math.min(360, Math.max(304, width - 32));
  const navBottomOffset = Math.max(insets.bottom + 12, 28);

  const showUnavailableTab = useCallback((label: string) => {
    Alert.alert('Coming Soon', `${label} is not available in the mobile app yet.`);
  }, []);

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
      <View style={styles.screenRoot}>
        <ScreenLayout scrollable={false}>
          <View style={styles.pageHeader}>
            <BackButton onPress={() => router.back()} />
          </View>
          <Text style={styles.pageTitle}>Settings</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        </ScreenLayout>
      </View>
    );
  }

  const badge = STATUS_BADGE_MAP[subscriptionStatus] ?? STATUS_BADGE_MAP.trial;
  const screenContentStyle = {
    paddingBottom: 120 + insets.bottom,
  };

  return (
    <View style={styles.screenRoot}>
    <ScreenLayout style={screenContentStyle}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <BackButton onPress={() => router.back()} />
      </View>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Sections — gap: 28 column layout matching Figma */}
      <View style={styles.sections}>

        {/* Profile */}
        <View>
          <SectionHeader title="Profile" />
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{profile?.email ?? ''}</Text>
            </View>

            <View style={styles.divider} />

            {editingName ? (
              <View style={styles.nameEditContainer}>
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
                    style={styles.editActionButton}
                    onPress={() => {
                      setEditingName(false);
                      setNameValue(profile?.name ?? '');
                    }}
                  />
                  <Button
                    title={savingName ? 'Saving...' : 'Save'}
                    onPress={handleSaveName}
                    disabled={savingName}
                    style={styles.editActionButton}
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
        </View>

        {/* Partner */}
        <View style={styles.partnerSection}>
          <SectionHeader title="Accountability Partner" />
          <View style={styles.partnerInputContainer}>
            <Text style={styles.partnerInputLabel}>Partner email</Text>
            <TextInput
              value={partnerEmail}
              onChangeText={setPartnerEmail}
              placeholder="partner@email.com"
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.partnerInputField}
            />
          </View>
          <Button
            title={savingPartner ? 'Updating...' : 'Update partner'}
            variant="ghost"
            onPress={handleUpdatePartner}
            disabled={savingPartner}
            style={styles.partnerButton}
          />
        </View>

        {/* Subscription */}
        <View style={styles.subscriptionSection}>
          <SectionHeader title="Subscription" />
          <View style={styles.subscriptionStatusContainer}>
            <Text style={styles.subscriptionStatusLabel}>Status</Text>
            <View style={styles.subscriptionStatusValueWrap}>
              <View style={styles.subscriptionStatusDot} />
              <Text style={styles.subscriptionStatusValue}>{badge.text}</Text>
            </View>
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
        </View>

        {/* Notifications */}
        <View>
          <SectionHeader title="Notifications" />
          <Card>
            <Text style={styles.notifDescription}>
              Push notifications are used to alert you about streak milestones,
              partner encouragements, and account updates.
            </Text>
          </Card>
        </View>

        {/* About */}
        <View>
          <SectionHeader title="About" />
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>Version</Text>
              <Text style={styles.value}>0.1.0</Text>
            </View>
          </Card>
        </View>

        {/* Sign out */}
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleSignOut}
        />

      </View>
    </ScreenLayout>

      <View
        style={[
          styles.bottomNav,
          {
            width: navWidth,
            marginLeft: -navWidth / 2,
            bottom: navBottomOffset,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push('/')}
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Go to dashboard"
        >
          <Ionicons name="home-outline" size={23} color="#11131A" />
        </Pressable>

        <Pressable
          onPress={() => showUnavailableTab('Connect')}
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Connect tab coming soon"
        >
          <Ionicons name="search-outline" size={27} color="#11131A" />
        </Pressable>

        <Pressable
          onPress={() => showUnavailableTab('Alerts')}
          style={styles.navItem}
          accessibilityRole="button"
          accessibilityLabel="Alerts tab coming soon"
        >
          <Ionicons name="notifications-outline" size={25} color="#11131A" />
        </Pressable>

        <Pressable
          onPress={() => router.push('/settings')}
          style={[styles.navItem, styles.navItemActive]}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={25} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pageHeader: {
    marginBottom: theme.spacing.base,
  },
  pageTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.semiBold,
    lineHeight: theme.lineHeight.h1,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sections: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 28,
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
    color: theme.colors.inputSecondaryText,
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
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.base,
  },
  nameEditContainer: {
    gap: theme.spacing.xs,
  },
  editActionButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 132,
  },
  editButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    fontWeight: theme.fontWeight.medium,
    fontSize: theme.fontSize.h2,
    borderWidth : 0,
  },
  partnerSection: {
    gap: theme.spacing.md,
    borderWidth: 0,
  },
  partnerInputContainer: {
    height: 56,
    borderWidth: 1,
    borderColor: '#D0D7E5',
    borderRadius: 28,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
  },
  partnerInputLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.inputSecondaryText,
    marginRight: theme.spacing.base,
  },
  partnerInputField: {
    flex: 1,
    textAlign: 'right',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  partnerButton: {
    minHeight: 48,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#223D8C',
    borderRadius: 132,
  },
  subscriptionSection: {
    gap: theme.spacing.md,
  },
  subscriptionStatusContainer: {
    height: 56,
    borderWidth: 1,
    borderColor: '#D0D7E5',
    borderRadius: 28,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
  },
  subscriptionStatusLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
  },
  subscriptionStatusValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5B5B5B',
  },
  subscriptionStatusValue: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  planButton: {
    marginTop: 2,
  },
  notifDescription: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.cardText,
    lineHeight: 22,
  },
  signOutSection: {
    marginBottom: theme.spacing.xl,
  },
  bottomNav: {
    position: 'absolute',
    left: '50%',
    height: 78,
    backgroundColor: '#DCDDFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: '#2A479E',
  },
});
