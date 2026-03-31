import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Card, Button, Badge, theme } from '@ascension/ui';
import { useApi } from '@ascension/api';
import { useAuth } from '../src/hooks/useAuth';

type PlanType = 'monthly' | 'annual';

interface PlanDetails {
  id: string;
  name: string;
  price: string;
  perMonth: string;
  badge?: string;
}

const PLANS: Record<PlanType, PlanDetails> = {
  monthly: {
    id: 'monthly',
    name: 'Monthly',
    price: '$14.99/mo',
    perMonth: '$14.99',
  },
  annual: {
    id: 'annual',
    name: 'Annual',
    price: '$119.88/yr',
    perMonth: '$9.99',
    badge: 'Save 33%',
  },
};

const FEATURES = [
  'Real-time screen monitoring',
  'AI-powered content detection',
  'Accountability partner alerts',
  'Streak tracking and milestones',
  'Blocked site protection',
  'Partner encouragement messages',
  'Priority support',
];

export default function PricingScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const result = await api.billing.createCheckout(
        user.id,
        user.email,
        selectedPlan,
      );

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      if (result.url) {
        await Linking.openURL(result.url);
      }
    } catch {
      Alert.alert('Error', 'Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout title="Choose Your Plan">
      <Text style={styles.subtitle}>
        Start your journey with full access to all Ascension features.
      </Text>

      {/* Plan cards */}
      <View style={styles.planCards}>
        {(Object.keys(PLANS) as PlanType[]).map((planKey) => {
          const plan = PLANS[planKey];
          const isSelected = selectedPlan === planKey;

          return (
            <TouchableOpacity
              key={planKey}
              onPress={() => setSelectedPlan(planKey)}
              activeOpacity={0.7}
              style={styles.planTouchable}
            >
              <Card
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                ]}
              >
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                    {plan.name}
                  </Text>
                  {plan.badge && (
                    <Badge text={plan.badge} variant="success" />
                  )}
                </View>

                <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                  {plan.perMonth}
                </Text>
                <Text style={styles.planPriceLabel}>per month</Text>

                {planKey === 'annual' && (
                  <Text style={styles.planBilled}>Billed annually at {plan.price}</Text>
                )}

                {/* Selection indicator */}
                <View style={styles.radioRow}>
                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>
                    {isSelected ? 'Selected' : 'Select'}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>Everything included:</Text>
        {FEATURES.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Subscribe button */}
      <Button
        title={loading ? 'Loading...' : `Subscribe - ${PLANS[selectedPlan].price}`}
        onPress={handleSubscribe}
        disabled={loading}
        style={styles.subscribeButton}
      />

      <Button
        title="Back"
        variant="ghost"
        onPress={() => router.back()}
        style={styles.backButton}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.muted,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  planCards: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  planTouchable: {
    flex: 1,
  },
  planCard: {
    borderWidth: 2,
    borderColor: theme.colors.cardBorder,
  },
  planCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentLight,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  planName: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  planNameSelected: {
    color: theme.colors.accent,
  },
  planPrice: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  planPriceSelected: {
    color: theme.colors.accent,
  },
  planPriceLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
  },
  planBilled: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  radioSelected: {
    borderColor: theme.colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
  },
  radioLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
  },
  featuresSection: {
    marginBottom: theme.spacing.xl,
  },
  featuresTitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.base,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  featureCheck: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.success,
    fontWeight: theme.fontWeight.bold,
    marginRight: theme.spacing.md,
  },
  featureText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
    lineHeight: 22,
  },
  subscribeButton: {
    marginBottom: theme.spacing.md,
  },
  backButton: {
    marginBottom: theme.spacing.lg,
  },
});
