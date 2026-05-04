import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useFonts, AfacadFlux_400Regular, AfacadFlux_500Medium, AfacadFlux_600SemiBold, AfacadFlux_700Bold } from '@expo-google-fonts/afacad-flux';
import { theme } from '@ascension/ui';
import { createApiClient } from '@ascension/api';
import type { AscensionAPI, StorageAdapter } from '@ascension/api';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { config } from '@/config';

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

/**
 * Inner layout that handles auth-based routing.
 * Redirects to /login if no session, /connect if no partner linked.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { partner, loading: partnerLoading } = usePartner(session?.user?.id);
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading || (session && partnerLoading)) return;

    const onAuthScreen = segments[0] === 'login' || segments[0] === 'signup';
    const onConnectScreen = segments[0] === 'connect';

    if (!session) {
      // Not logged in - go to login
      if (!onAuthScreen) {
        router.replace('/login');
      }
    } else if (!partner) {
      // Logged in but no partner connected
      if (!onConnectScreen) {
        router.replace('/connect');
      }
    } else {
      // Fully authenticated and connected
      if (onAuthScreen || onConnectScreen) {
        router.replace('/');
      }
    }

    setReady(true);
  }, [session, partner, authLoading, partnerLoading, segments, router]);

  if (authLoading || (session && partnerLoading && !ready)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const api = useMemo(
    () => createApiClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      functionsBaseUrl: config.functionsBaseUrl,
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
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ApiContext.Provider value={api}>
        <StatusBar style="dark" />
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
              animation: 'fade',
            }}
          />
        </AuthGate>
      </ApiContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
