import React, { useState } from 'react';
import { StyleSheet, View, Text, Switch, Alert } from 'react-native';
import { theme, ScreenLayout, Card, Button, SectionHeader, Avatar } from '@ascension/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';

interface NotificationPrefs {
  content_detected: boolean;
  evasion: boolean;
  attempted_access: boolean;
  streak_milestones: boolean;
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { partner } = usePartner(session?.user?.id);
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    content_detected: true,
    evasion: true,
    attempted_access: true,
    streak_milestones: true,
  });

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  }

  const partnerName = partner?.name ?? 'Unknown';

  return (
    <ScreenLayout title="Settings">
      {/* Connected Partner */}
      <SectionHeader title="Connected Account" />
      <Card style={styles.partnerCard}>
        <View style={styles.partnerRow}>
          <Avatar name={partnerName} size={44} />
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            <Text style={styles.partnerEmail}>{partner?.email ?? ''}</Text>
          </View>
        </View>
      </Card>

      {/* Notification Preferences */}
      <SectionHeader
        title="Notifications"
        subtitle="Choose which alerts you receive push notifications for"
        style={styles.sectionSpacing}
      />

      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Content Detected</Text>
            <Text style={styles.settingDescription}>
              Flagged screenshots or explicit content alerts
            </Text>
          </View>
          <Switch
            value={notifications.content_detected}
            onValueChange={() => toggleNotification('content_detected')}
            trackColor={{ true: theme.colors.accent, false: theme.colors.cardBorder }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Monitoring Disabled</Text>
            <Text style={styles.settingDescription}>
              Alerts when monitoring or VPN is turned off
            </Text>
          </View>
          <Switch
            value={notifications.evasion}
            onValueChange={() => toggleNotification('evasion')}
            trackColor={{ true: theme.colors.accent, false: theme.colors.cardBorder }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Blocked Attempts</Text>
            <Text style={styles.settingDescription}>
              When a blocked site or app is accessed
            </Text>
          </View>
          <Switch
            value={notifications.attempted_access}
            onValueChange={() => toggleNotification('attempted_access')}
            trackColor={{ true: theme.colors.accent, false: theme.colors.cardBorder }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Streak Milestones</Text>
            <Text style={styles.settingDescription}>
              Celebrate when your partner hits streak goals
            </Text>
          </View>
          <Switch
            value={notifications.streak_milestones}
            onValueChange={() => toggleNotification('streak_milestones')}
            trackColor={{ true: theme.colors.accent, false: theme.colors.cardBorder }}
          />
        </View>
      </Card>

      {/* Privacy Info */}
      <SectionHeader
        title="Privacy"
        style={styles.sectionSpacing}
      />
      <Card>
        <Text style={styles.privacyText}>
          As an accountability partner, you can see:
        </Text>
        <Text style={styles.privacyItem}>
          {'\u{2022}'} Blurred screenshots of your partner's screen activity
        </Text>
        <Text style={styles.privacyItem}>
          {'\u{2022}'} Alert notifications for flagged content
        </Text>
        <Text style={styles.privacyItem}>
          {'\u{2022}'} Their current streak and progress stats
        </Text>
        <Text style={[styles.privacyText, styles.privacyNote]}>
          You cannot see full-resolution screenshots, passwords, private
          messages, or any financial information. All images are automatically
          blurred before being shared.
        </Text>
      </Card>

      {/* Your Account */}
      <SectionHeader
        title="Your Account"
        style={styles.sectionSpacing}
      />
      <Card style={styles.accountCard}>
        <Text style={styles.accountEmail}>
          {session?.user?.email ?? ''}
        </Text>
      </Card>

      <Button
        title="Sign Out"
        variant="danger"
        onPress={handleSignOut}
        style={styles.signOutButton}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  partnerCard: {
    marginBottom: theme.spacing.base,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  partnerName: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  partnerEmail: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: 2,
  },
  sectionSpacing: {
    marginTop: theme.spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.base,
  },
  settingLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  settingDescription: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.cardBorder,
    marginVertical: theme.spacing.sm,
  },
  privacyText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  privacyItem: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
    lineHeight: 22,
    paddingLeft: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  privacyNote: {
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
    marginBottom: 0,
  },
  accountCard: {
    marginBottom: theme.spacing.base,
  },
  accountEmail: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
  },
  signOutButton: {
    marginTop: theme.spacing.base,
  },
});
