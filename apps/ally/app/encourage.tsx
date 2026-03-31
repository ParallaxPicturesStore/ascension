import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { theme, ScreenLayout, Card, Input, Button, SectionHeader } from '@ascension/ui';
import { formatRelativeTime } from '@ascension/shared';
import { useApi } from '@ascension/api';
import { useAuth } from '@/hooks/useAuth';
import { usePartner } from '@/hooks/usePartner';
import type { Encouragement } from '@ascension/api';

const QUICK_MESSAGES = [
  'Proud of you!',
  "Keep going, you've got this",
  'One day at a time',
  'I believe in you',
  'Stay strong',
];

export default function EncourageScreen() {
  const api = useApi();
  const { session } = useAuth();
  const { partner } = usePartner(session?.user?.id);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<Encouragement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!partner) return;
    setLoadingHistory(true);
    try {
      // Get encouragements sent to the monitored user
      const history = await api.encouragements.getForUser(partner.id);
      // Filter to only show ones from the current user
      const mine = history.filter(
        (e) => e.from_user_id === session?.user?.id,
      );
      setSentMessages(mine);
    } catch {
      // Non-critical
    } finally {
      setLoadingHistory(false);
    }
  }, [api, partner, session]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function sendMessage(message: string) {
    if (!session || !partner) return;

    setSending(true);
    try {
      const sent = await api.encouragements.send({
        from_user_id: session.user.id,
        to_user_id: partner.id,
        message,
      });
      setSentMessages((prev) => [sent, ...prev]);
      setCustomMessage('');
      Alert.alert('Sent', `Your encouragement was sent to ${partner.name ?? 'your partner'}.`);
    } catch (err) {
      Alert.alert(
        'Could not send',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  function handleQuickSend(message: string) {
    sendMessage(message);
  }

  function handleCustomSend() {
    if (!customMessage.trim()) return;
    sendMessage(customMessage.trim());
  }

  const partnerName = partner?.name ?? 'your partner';

  return (
    <ScreenLayout title="Send Encouragement">
      <Text style={styles.intro}>
        A few kind words can make all the difference. Let {partnerName} know you
        are in their corner.
      </Text>

      {/* Quick reactions */}
      <SectionHeader title="Quick Messages" />
      <View style={styles.quickMessages}>
        {QUICK_MESSAGES.map((msg) => (
          <TouchableOpacity
            key={msg}
            style={styles.quickButton}
            onPress={() => handleQuickSend(msg)}
            disabled={sending}
          >
            <Text style={styles.quickButtonText}>{msg}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom message */}
      <SectionHeader
        title="Write your own"
        style={styles.customSection}
      />
      <Input
        placeholder="Type something encouraging..."
        value={customMessage}
        onChangeText={setCustomMessage}
        multiline
        numberOfLines={3}
      />
      <Button
        title={sending ? 'Sending...' : 'Send Message'}
        onPress={handleCustomSend}
        disabled={sending || !customMessage.trim()}
      />

      {/* History */}
      {sentMessages.length > 0 && (
        <View style={styles.historySection}>
          <SectionHeader
            title="Sent"
            subtitle="Your recent encouragements"
          />
          {sentMessages.map((item) => (
            <Card key={item.id} style={styles.historyItem}>
              <Text style={styles.historyMessage}>{item.message}</Text>
              <Text style={styles.historyTime}>
                {formatRelativeTime(item.created_at)}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  quickMessages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  quickButton: {
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.pill,
  },
  quickButtonText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.accent,
  },
  customSection: {
    marginTop: theme.spacing.sm,
  },
  historySection: {
    marginTop: theme.spacing.xl,
  },
  historyItem: {
    marginBottom: theme.spacing.sm,
  },
  historyMessage: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
    lineHeight: 22,
  },
  historyTime: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
});
