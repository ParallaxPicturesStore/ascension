import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme, ScreenLayout, Input, Button, Card, BackButton } from '@ascension/ui';
import { useApi } from '../src/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

export default function ConnectScreen() {
  const api = useApi();
  const { session } = useAuth();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!inviteCode.trim() || !session) return;

    setLoading(true);
    setError(null);

    try {
      // Accept the invitation by updating the partner link via the user profile
      // The invite code is the partner's user ID or a generated invite token
      await api.users.updateUserPartnerId(inviteCode.trim(), {
        partner_id: session.user.id,
      });
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect. Please check the invite code and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenLayout>

      <BackButton onPress={()=>{
        router.back()
      }}/>
      
        <View style={styles.header}>
                <Text style={styles.title}>Connect with your partner</Text>
                <Text style={styles.intro}>
        Your partner has invited you to be their accountability ally. Enter the
        invite code they shared with you to get connected.
      </Text>
              </View>
     

      <View style={styles.card}>
        <View style={styles.inviteSection}>
          <Input
            label="Invite Code"
            placeholder="Paste invite code here"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title={loading ? 'Connecting...' : 'Connect'}
            onPress={handleConnect}
            disabled={loading || !inviteCode.trim()}
          />
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>What you will be able to see</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>{'🔒'}</Text>
          <Text style={styles.infoText}>
            Blurred activity screenshots - enough to see patterns, private
            enough to respect boundaries
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>{'📈'}</Text>
          <Text style={styles.infoText}>
            Their current streak and progress over time
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>{'🔔'}</Text>
          <Text style={styles.infoText}>
            Alerts when something needs your attention
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>{'💬'}</Text>
          <Text style={styles.infoText}>
            Send them words of encouragement when they need it most
          </Text>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.intro,
    lineHeight: 22,
    fontWeight:theme.fontWeight.regular,
    marginBottom: theme.spacing.lg,
  },
  header:{
    paddingTop:theme.spacing.base,
    gap:theme.spacing.xs
  },
  title:{
  fontFamily: theme.typography.headingFamily,
    fontSize: theme.fontSize.h1,
    lineHeight: theme.lineHeight.h1,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  card: {
    marginBottom: theme.spacing.xl,
  },
  inviteSection:{
    gap:theme.spacing.lg
  },
  error: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    marginBottom: theme.spacing.base,
  },
  infoSection: {
    backgroundColor:'#F8FAFF',
    marginTop: theme.spacing.md,
    padding:theme.spacing.base
  },
  infoTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  infoIcon: {
    fontSize: theme.fontSize.iconSm,
    marginRight: theme.spacing.md,
    // marginTop: theme.spacing.sm / 2,
  },
  infoText: {
    flex: 1,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight:theme.fontWeight.regular,
    color: theme.colors.foreground,
    lineHeight: 22,
  },
});
