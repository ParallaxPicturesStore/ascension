import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useFonts, AfacadFlux_400Regular, AfacadFlux_500Medium, AfacadFlux_600SemiBold, AfacadFlux_700Bold } from '@expo-google-fonts/afacad-flux';
import { Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { theme } from '@ascension/ui';
import { createApiClient } from '@ascension/api';
import type { StorageAdapter } from '@ascension/api';
import { useAuth } from '../src/hooks/useAuth';
import { ApiProvider, useApi } from '../src/providers/ApiProvider';
import { config } from '../src/config';
import { startMonitoring, stopMonitoring, onDetection } from '../src/services/MonitoringService';
import type { AnalysisResult } from '../src/services/ContentAnalyzer';
import { isSubscriptionExpired } from '../src/utils/subscription';

// SecureStore-backed storage adapter so Supabase sessions persist across restarts
const secureStoreAdapter: StorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// ---------------------------------------------------------------------------
// Onboarding context — lets child screens mark onboarding as done so the
// routing effect doesn't redirect them back to /onboarding on navigate.
// ---------------------------------------------------------------------------

const OnboardingContext = createContext<{
  completeOnboarding: () => void;
  completeMonitoringSetup: () => Promise<void>;
  deferMonitoringSetup: () => void;
}>({
  completeOnboarding: () => {},
  completeMonitoringSetup: async () => {},
  deferMonitoringSetup: () => {},
});
export function useOnboarding() { return useContext(OnboardingContext); }

function monitoringSetupKey(userId: string): string {
  return `monitoring_setup_done_${userId}`;
}

// ---------------------------------------------------------------------------
// Auth gate + monitoring lifecycle
// ---------------------------------------------------------------------------

function AuthGate() {
  const api = useApi();
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [monitoringSetupChecked, setMonitoringSetupChecked] = useState(false);
  const [monitoringSetupDone, setMonitoringSetupDone] = useState(false);
  const [monitoringSetupDeferred, setMonitoringSetupDeferred] = useState(false);

  // Track whether we've started monitoring for this session
  const monitoringStarted = useRef(false);
  // Sync flag so the routing guard doesn't redirect back to onboarding mid-navigation
  const onboardingDone = useRef(false);

  // Detection alert modal state
  const [detection, setDetection] = useState<AnalysisResult | null>(null);

  // Register detection callback once
  useEffect(() => {
    const unsubscribe = onDetection((result) => setDetection(result));
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session || !user) {
      setMonitoringSetupChecked(true);
      setMonitoringSetupDone(false);
      setMonitoringSetupDeferred(false);
      return;
    }

    setMonitoringSetupChecked(false);
    SecureStore.getItemAsync(monitoringSetupKey(user.id))
      .then((value) => {
        if (cancelled) return;
        setMonitoringSetupDone(value === 'true');
        setMonitoringSetupChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setMonitoringSetupDone(false);
        setMonitoringSetupChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  // Start monitoring once the user is authenticated and profile is complete
  useEffect(() => {
    if (!session || !user) {
      // User signed out — stop monitoring if it was running
      if (monitoringStarted.current) {
        monitoringStarted.current = false;
        stopMonitoring().catch((err) =>
          console.warn('[Layout] stopMonitoring error:', err),
        );
      }
      return;
    }

    if (!profileChecked || needsOnboarding || subscriptionExpired || !monitoringSetupChecked || !monitoringSetupDone) {
      if (subscriptionExpired && monitoringStarted.current) {
        monitoringStarted.current = false;
        stopMonitoring().catch((err) =>
          console.warn('[Layout] stopMonitoring error:', err),
        );
      }
      return; // Wait until onboarding is done and subscription is valid
    }

    if (monitoringStarted.current) return; // Already started for this session
    monitoringStarted.current = true;

    startMonitoring(
      user.id,
      config.supabaseUrl,
      session.access_token,
      config.supabaseAnonKey,
    ).catch((err) => {
      console.warn('[Layout] startMonitoring error:', err);
      // Reset so the user can retry manually
      monitoringStarted.current = false;
      Alert.alert(
        'Monitoring Failed to Start',
        'There was a problem starting screen monitoring. Please try again.',
        [
          { text: 'Try Again', onPress: () => {
            monitoringStarted.current = false;
            startMonitoring(user.id, config.supabaseUrl, session.access_token, config.supabaseAnonKey)
              .then(() => { monitoringStarted.current = true; })
              .catch((retryErr) => {
                console.warn('[Layout] startMonitoring retry error:', retryErr);
                Alert.alert('Still Failed', 'Monitoring could not start. Please restart the app.');
              });
          }},
          { text: 'Dismiss', style: 'cancel' },
        ],
      );
    });
  }, [session, user, profileChecked, needsOnboarding, subscriptionExpired, monitoringSetupChecked, monitoringSetupDone]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const inOnboarding = segments[0] === 'onboarding';
    const inSystemSetup = segments[0] === 'system-setup';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/login');
      }
      setProfileChecked(false);
      setNeedsOnboarding(false);
      setSubscriptionExpired(false);
      setMonitoringSetupChecked(true);
      setMonitoringSetupDone(false);
      setMonitoringSetupDeferred(false);
      onboardingDone.current = false;
      return;
    }

    if (!monitoringSetupChecked) {
      return;
    }

    // Signed in - check if profile is complete
    if (!profileChecked && user) {
      api.users
        .getProfile(user.id)
        .then((profile) => {
          const incomplete = !profile.name;
          const expired = isSubscriptionExpired(profile.subscription_lapse_date)
            || profile.subscription_status === 'expired';
          setNeedsOnboarding(incomplete);
          setSubscriptionExpired(expired);
          setProfileChecked(true);

          if (incomplete && !inOnboarding) {
            router.replace('/onboarding');
          } else if (!incomplete && !expired && !monitoringSetupDone && !monitoringSetupDeferred && !inSystemSetup) {
            router.replace('/system-setup');
          } else if (
            !incomplete
            && (inAuthGroup || inOnboarding)
          ) {
            router.replace('/');
          }
        })
        .catch(() => {
          // Profile doesn't exist yet - needs onboarding
          setNeedsOnboarding(true);
          setSubscriptionExpired(false);
          setProfileChecked(true);
          if (!inOnboarding) {
            router.replace('/onboarding');
          }
        });
      return;
    }

    if (profileChecked) {
      if (needsOnboarding && !inOnboarding && !onboardingDone.current) {
        router.replace('/onboarding');
      } else if (!needsOnboarding && !subscriptionExpired && !monitoringSetupDone && !monitoringSetupDeferred && !inSystemSetup) {
        router.replace('/system-setup');
      } else if (
        !needsOnboarding
        && (inAuthGroup || inOnboarding)
      ) {
        router.replace('/');
      }
    }
  }, [
    session,
    loading,
    segments,
    profileChecked,
    needsOnboarding,
    subscriptionExpired,
    user,
    api,
    router,
    monitoringSetupChecked,
    monitoringSetupDone,
    monitoringSetupDeferred,
  ]);

  const completeOnboarding = useCallback(() => {
    onboardingDone.current = true;
    setNeedsOnboarding(false);
  }, []);

  const completeMonitoringSetup = useCallback(async () => {
    if (!session || !user) {
      throw new Error('Missing active session');
    }

    if (!monitoringStarted.current) {
      await startMonitoring(
        user.id,
        config.supabaseUrl,
        session.access_token,
        config.supabaseAnonKey,
      );
      monitoringStarted.current = true;
    }

    await SecureStore.setItemAsync(monitoringSetupKey(user.id), 'true');
    setMonitoringSetupDone(true);
    setMonitoringSetupDeferred(false);
  }, [session, user]);

  const deferMonitoringSetup = useCallback(() => {
    setMonitoringSetupDeferred(true);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <OnboardingContext.Provider
      value={{
        completeOnboarding,
        completeMonitoringSetup,
        deferMonitoringSetup,
      }}
    >
      <Slot />

      {/* Detection alert modal — shown when NSFW content is detected */}
      <Modal
        visible={detection !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetection(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unusual Activity Detected</Text>
            {detection && (
              <>
                <Text style={styles.modalBody}>
                  {detection.topCategory} content detected
                  {detection.topScore > 0
                    ? ` (${Math.round(detection.topScore)}% confidence)`
                    : ''}
                  .
                </Text>
                {detection.alert && (
                  <Text style={styles.modalAlert}>
                    Your partner has been notified.
                  </Text>
                )}
              </>
            )}
            <Pressable style={styles.modalButton} onPress={() => setDetection(null)}>
              <Text style={styles.modalButtonText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </OnboardingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

const INSTALL_FLAG_KEY = 'ascension_installed_v1';

async function clearKeychainOnFreshInstall() {
  try {
    const flag = await SecureStore.getItemAsync(INSTALL_FLAG_KEY);
    if (!flag) {
      // Fresh install — Keychain may have stale session from previous install
      const keysToDelete = [
        'supabase.auth.token',
        'supabase.auth.refreshToken',
        'sb-flrllorqzmbztvtccvab-auth-token',
        'sb-flrllorqzmbztvtccvab-auth-token-code-verifier',
      ];
      await Promise.all(keysToDelete.map((k) => SecureStore.deleteItemAsync(k).catch(() => {})));
      await SecureStore.setItemAsync(INSTALL_FLAG_KEY, '1');
    }
  } catch {}
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clearKeychainOnFreshInstall().finally(() => setReady(true));
  }, []);

  const api = useMemo(
    () => createApiClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      storage: secureStoreAdapter,
    }),
    [],
  );
  const [fontsLoaded] = useFonts({
    'Afacad Flux': AfacadFlux_400Regular,
    'Afacad Flux Medium': AfacadFlux_500Medium,
    'Afacad Flux SemiBold': AfacadFlux_600SemiBold,
    'Afacad Flux Bold': AfacadFlux_700Bold,
    'Phosphate-Solid': require('../assets/fonts/Phosphate-Solid.ttf'),
    'Nunito': Nunito_400Regular,
    'Nunito Medium': Nunito_500Medium,
    'Nunito SemiBold': Nunito_600SemiBold,
    'Nunito Bold': Nunito_700Bold,
  });

  if (!fontsLoaded || !ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ApiProvider api={api}>
        <StatusBar style="dark" />
        <AuthGate />
      </ApiProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c0392b',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  modalAlert: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
