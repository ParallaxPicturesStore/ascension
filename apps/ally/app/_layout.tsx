import React, { useEffect, useMemo, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { theme } from '@ascension/ui';
import { ApiProvider } from '@ascension/api';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import { config } from '@/config';

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

    const onAuthScreen = segments[0] === 'login';
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
  const apiConfig = useMemo(
    () => ({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      functionsBaseUrl: config.functionsBaseUrl,
    }),
    [],
  );

  return (
    <ApiProvider config={apiConfig}>
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
    </ApiProvider>
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
