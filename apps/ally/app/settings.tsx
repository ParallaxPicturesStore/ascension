import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { theme, ScreenLayout, Card, Button, SectionHeader, Avatar, BackButton, Toggle } from '@ascension/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { useApi } from '@/hooks/useApi';
import { router } from 'expo-router';

interface NotificationPrefs {
  content_detected: boolean;
  evasion: boolean;
  attempted_access: boolean;
  streak_milestones: boolean;
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { partner } = usePartner(session?.user?.id);
  const api = useApi();
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    content_detected: false,
    evasion: false,
    attempted_access: false,
    streak_milestones: false,
  });

  useEffect(() => {
    if (!session?.user?.id) return;
    api.users.getProfile(session.user.id).then((profile) => {
      const saved = profile.notification_settings;
      if (saved && Object.keys(saved).length > 0) {
        setNotifications((prev) => ({ ...prev, ...saved }));
      }
    }).catch(() => {});
  }, [session?.user?.id]);

  function toggleNotification(key: keyof NotificationPrefs) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    if (!session?.user?.id) return;
    api.users.updateProfile(session.user.id, { notification_settings: updated }).catch(() => {});
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
    <ScreenLayout>
      <BackButton onPress={()=>{
        router.back()
      }}/>
      <View>
        <Text style={styles.headerTitle}>
          Settings
        </Text>
      </View>
      {/* Connected Partner */}
      <SectionHeader title="Connected Account" textStyle={styles.cardHeader} style={{marginTop:theme.spacing.md}}/>
      <View style={styles.partnerCard}>
        <View style={styles.partnerRow}>
          <Avatar name={partnerName} size={44} style={{backgroundColor:theme.colors.white}} />
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            <Text style={styles.partnerEmail}>{partner?.email ?? ''}</Text>
          </View>
        </View>
      </View>

      {/* Notification Preferences */}
      <SectionHeader
      textStyle={styles.cardHeader} 
        title="Notifications"
        subtitle="Choose which alerts you receive push notifications for"
        style={styles.sectionSpacing}
      />

      <View>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Content Detected</Text>
            <Text style={styles.settingDescription}>
              Flagged screenshots or explicit content alerts
            </Text>
          </View>
          <Toggle
            value={notifications.content_detected}
            onValueChange={() => toggleNotification('content_detected')}
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
          <Toggle
            value={notifications.evasion}
            onValueChange={() => toggleNotification('evasion')}
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
          <Toggle
            value={notifications.attempted_access}
            onValueChange={() => toggleNotification('attempted_access')}
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
          <Toggle
            value={notifications.streak_milestones}
            onValueChange={() => toggleNotification('streak_milestones')}
          />
        </View>

        <View style={styles.divider} />
      </View>

      {/* Privacy Info */}
      <SectionHeader
       textStyle={styles.cardHeader} 
        title="Privacy"
        style={styles.sectionSpacing}
      />
      <Card style={{backgroundColor:'transprent'}}>
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
      textStyle={styles.cardHeader} 
        title="Your Account"
        style={styles.sectionSpacing}
      />
      <Card style={{backgroundColor:'transprent'}}>
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
    backgroundColor: theme.colors.backgroundCard,
    marginBottom: theme.spacing.base,
    paddingVertical:theme.spacing.base,
    paddingHorizontal:theme.spacing.md,
    borderRadius:theme.borderRadius.card
  },
  headerTitle:{
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h2,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginTop:theme.spacing.md
  },
  cardHeader:{
    fontSize:theme.fontSize.header,
    fontWeight:theme.fontWeight.medium
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
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  partnerEmail: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.intro,
    marginTop: theme.spacing.xs / 2,
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
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  settingDescription: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.intro,
    marginTop: theme.spacing.xs / 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.devider,
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
