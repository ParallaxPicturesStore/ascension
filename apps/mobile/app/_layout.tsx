import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { theme } from '@ascension/ui';
import { createApiClient } from '@ascension/api';
import type { AscensionAPI, StorageAdapter } from '@ascension/api';
import { useAuth } from '../src/hooks/useAuth';
import { config } from '../src/config';
import { startMonitoring, stopMonitoring, onDetection } from '../src/services/MonitoringService';
import type { AnalysisResult } from '../src/services/ContentAnalyzer';

// SecureStore-backed storage adapter so Supabase sessions persist across restarts
const secureStoreAdapter: StorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Inline ApiProvider to avoid React dual-instance issue in monorepo
const ApiContext = createContext<AscensionAPI | null>(null);
export function useApi(): AscensionAPI {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used within ApiProvider');
  return api;
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

  // Track whether we've started monitoring for this session
  const monitoringStarted = useRef(false);

  // Detection alert modal state
  const [detection, setDetection] = useState<AnalysisResult | null>(null);

  // Register detection callback once
  useEffect(() => {
    const unsubscribe = onDetection((result) => setDetection(result));
    return unsubscribe;
  }, []);

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

    if (!profileChecked || needsOnboarding) return; // Wait until onboarding is done

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
  }, [session, user, profileChecked, needsOnboarding]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/login');
      }
      setProfileChecked(false);
      setNeedsOnboarding(false);
      return;
    }

    // Signed in - check if profile is complete
    if (!profileChecked && user) {
      api.users
        .getProfile(user.id)
        .then((profile) => {
          const incomplete = !profile.name;
          setNeedsOnboarding(incomplete);
          setProfileChecked(true);

          if (incomplete && !inOnboarding) {
            router.replace('/onboarding');
          } else if (!incomplete && (inAuthGroup || inOnboarding)) {
            router.replace('/');
          }
        })
        .catch(() => {
          // Profile doesn't exist yet - needs onboarding
          setNeedsOnboarding(true);
          setProfileChecked(true);
          if (!inOnboarding) {
            router.replace('/onboarding');
          }
        });
      return;
    }

    if (profileChecked) {
      if (needsOnboarding && !inOnboarding) {
        router.replace('/onboarding');
      } else if (!needsOnboarding && (inAuthGroup || inOnboarding)) {
        router.replace('/');
      }
    }
  }, [session, loading, segments, profileChecked, needsOnboarding, user, api, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <>
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const api = useMemo(
    () => createApiClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      storage: secureStoreAdapter,
    }),
    [],
  );

  return (
    <SafeAreaProvider>
      <ApiContext.Provider value={api}>
        <StatusBar style="dark" />
        <AuthGate />
      </ApiContext.Provider>
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
