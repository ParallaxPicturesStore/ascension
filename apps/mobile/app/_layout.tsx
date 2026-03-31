import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@ascension/ui';
import { ApiProvider } from '../src/contexts/ApiContext';
import { useAuth } from '../src/hooks/useAuth';
import { useApi } from '../src/hooks/useApi';

function AuthGate() {
  const api = useApi();
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ApiProvider>
      <StatusBar style="dark" />
      <AuthGate />
    </ApiProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
