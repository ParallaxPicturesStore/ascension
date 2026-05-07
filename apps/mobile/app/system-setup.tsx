import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Header, ScreenLayout, theme } from '@ascension/ui';
import LockIcon from '../assets/icons/lock.svg';
import ProtectedIcon from '../assets/icons/protected.svg';
import { useOnboarding } from './_layout';
import { vpnManager } from '../src/native/VPNManager';

export default function SystemSetupScreen() {
  const router = useRouter();
  const { completeMonitoringSetup, deferMonitoringSetup } = useOnboarding();
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(Platform.OS === 'ios');

  // On iOS, if VPN is already connected go straight to dashboard
  useEffect(() => {
    if (Platform.OS !== 'ios') { setChecking(false); return; }
    vpnManager.getVPNStatus().then((status) => {
      if (status === 'connected') router.replace('/');
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, []);

  const handleEnableMonitoring = async () => {
    setActivationError(null);
    setActivating(true);
    try {
      await completeMonitoringSetup();
      setReady(true);
    } catch {
      setActivationError(Platform.OS === 'ios' ? 'Could not enable VPN. Please try again.' : 'Could not enable monitoring. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const handleLater = () => {
    deferMonitoringSetup();
    router.replace('/');
  };

  if (checking) {
    return (
      <ScreenLayout scrollable={false}>
        <View style={styles.successContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </ScreenLayout>
    );
  }

  if (ready) {
    return (
      <ScreenLayout scrollable={false}>
        <View style={styles.successContainer}>
          <Text style={styles.brand}>ASCENSION</Text>

          <ProtectedIcon width={96} height={96} style={styles.successBadge} />

          <Text style={styles.successHeading}>You're protected</Text>
          <Text style={styles.successSubheading}>
            {Platform.OS === 'ios'
              ? 'VPN is active. All DNS filtering is running.'
              : 'Monitoring is now active.'}
          </Text>

          <Button
            title="Go to dashboard"
            onPress={() => router.replace('/')}
            style={styles.successButton}
          />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout scrollable>
      <View style={styles.container}>
        <Header title="System setup" showBack onBack={() => router.back()} />

        <Text style={styles.heading}>Turn on monitoring</Text>
        <Text style={styles.subtitle}>
          To protect you, Ascension needs access to your device activity.
        </Text>

        {Platform.OS === 'ios' ? (
          <>
            <Card style={styles.stepsCard}>
              <Text style={styles.stepsTitle}>Steps list</Text>
              <Text style={styles.stepText}>1. Allow VPN configuration.</Text>
              <Text style={styles.stepText}>2. Keep VPN on at all times.</Text>
              <Text style={styles.stepText}>3. Restrict adult websites via Screen Time.</Text>
              <Text style={styles.stepText}>4. Enable Ascension Safari extension.</Text>
              <Text style={styles.stepText}>   • Open Settings</Text>
              <Text style={styles.stepText}>   • Tap Safari → Extensions</Text>
              <Text style={styles.stepText}>   • Find Ascension and toggle it on</Text>
              <Text style={styles.stepText}>   • Tap Allow for all websites</Text>
              <Pressable onPress={() => Linking.openURL('App-Prefs:SAFARI')}>
                <Text style={styles.stepLink}>Open Safari Settings →</Text>
              </Pressable>
            </Card>
          </>
        ) : (
          <Card style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>Steps list</Text>
            <Text style={styles.stepText}>1. Enable screen recording.</Text>
            <Text style={styles.stepText}>2. Allow accessibility access.</Text>
            <Text style={styles.stepText}>3. Allow notifications.</Text>
          </Card>
        )}

        {activationError && <Text style={styles.errorText}>{activationError}</Text>}

        <Button
          title={Platform.OS === 'ios'
            ? (activating ? 'Enabling VPN...' : 'Enable VPN')
            : (activating ? 'Enabling monitoring...' : 'Enable monitoring')}
          onPress={handleEnableMonitoring}
          disabled={activating}
          leftSlot={<LockIcon width={15} height={20} />}
          style={styles.enableButton}
        />

        <Button
          title="I'll do this later"
          variant="secondary"
          onPress={handleLater}
          disabled={activating}
        />

        {activating && (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.loaderText}>
              {Platform.OS === 'ios'
                ? 'Waiting for VPN permission...'
                : 'Waiting for system permission...'}
            </Text>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  heading: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.base,
  },
  subtitle: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.muted,
    marginBottom: theme.spacing.xl,
  },
  stepsCard: {
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: '#f3f5fb',
    marginBottom: theme.spacing.lg,
  },
  stepsTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.black,
    marginBottom: theme.spacing.base,
  },
  stepText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.foreground,
    lineHeight: 38,
  },
  errorText: {
    fontFamily: theme.typography.bodyFamily,
    color: theme.colors.danger,
    marginBottom: theme.spacing.base,
  },
  enableButton: {
    marginBottom: theme.spacing.base,
  },
  loaderRow: {
    marginTop: theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  loaderText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.spacing['3xl'],
  },
  brand: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.muted,
    letterSpacing: 1,
    marginBottom: theme.spacing['3xl'],
  },
  successBadge: {
    marginBottom: theme.spacing.xl,
  },
  successHeading: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },
  successSubheading: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.muted,
    marginBottom: theme.spacing['2xl'],
  },
  successButton: {
    width: '100%',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8dce8',
  },
  stepLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.base,
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumber: {
    fontFamily: theme.typography.headingFamily,
    fontSize: 14,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.onAccent,
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  stepDesc: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepLink: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semiBold,
  },
  safariGuide: {
    marginTop: theme.spacing.base,
    backgroundColor: theme.colors.accentLight,
    borderRadius: 12,
    padding: theme.spacing.base,
  },
  safariGuideTitle: {
    fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  safariGuideStep: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    lineHeight: 26,
  },
  safariGuideEm: {
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.foreground,
  },
  safariGuideButton: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  safariGuideButtonText: {
    fontFamily: theme.typography.bodyFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.semiBold,
    color: theme.colors.accent,
  },
});
