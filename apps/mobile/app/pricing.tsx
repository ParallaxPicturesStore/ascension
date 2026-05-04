import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, Card, Button, Header, theme } from '@ascension/ui';
import { useApi } from '../src/hooks/useApi';
import { useAuth } from '../src/hooks/useAuth';

type PlanType = 'monthly' | 'annual';

interface PlanDetails {
  id: string;
  name: string;
  price: string;
  perMonth: string;
  periodLabel: string;
  badge?: string;
  features: string[];
}

const PLANS: Record<PlanType, PlanDetails> = {
  monthly: {
    id: 'monthly',
    name: 'Monthly',
    price: '£14.99/mo',
    perMonth: '£14.99',
    periodLabel: 'month',
    features: [
      'Real-time screen monitoring',
      'AI-powered content detection',
      'Instant partner alerts',
      'Streak tracking and milestones',
      'Blocked site protection',
    ],
  },
  annual: {
    id: 'annual',
    name: 'Annual',
    price: '£119.88/yr',
    perMonth: '£119.88',
    periodLabel: 'year',
    badge: 'Save 33%',
    features: [
      'Everything in monthly',
      'Priority support',
      'Advanced analytics',
      'Custom blocklist',
      'Early access to new features',
    ],
  },
};

const COLLAPSED_FEATURE_COUNT = 3;

export default function PricingScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const [expandedPlans, setExpandedPlans] = useState<Record<PlanType, boolean>>({
    monthly: false,
    annual: true,
  });
  const [loading, setLoading] = useState(false);

  const toggleExpanded = (planKey: PlanType) => {
    setExpandedPlans((prev) => ({ ...prev, [planKey]: !prev[planKey] }));
  };

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
    <ScreenLayout style={styles.screenLayout}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top header: back button + centered title */}
        <Header
          title="Pricing"
          showBack
          onBack={() => router.back()}
          style={styles.header}
        />

        <Text style={styles.heading}>Choose your plan</Text>
        <Text style={styles.subtitle}>
          14-day free trial on all plans. Cancel anytime.
        </Text>

        {/* Plan cards */}
        <View style={styles.planCards}>
          {(Object.keys(PLANS) as PlanType[]).map((planKey) => {
            const plan = PLANS[planKey];
            const isSelected = selectedPlan === planKey;
            const isExpanded = expandedPlans[planKey];
            const planCardStyle = isSelected
              ? { ...styles.planCard, ...styles.planCardSelected }
              : styles.planCard;
            const visibleFeatures = isExpanded
              ? plan.features
              : plan.features.slice(0, COLLAPSED_FEATURE_COUNT);
            const canToggle = plan.features.length > COLLAPSED_FEATURE_COUNT;

            return (
              <TouchableOpacity
                key={planKey}
                onPress={() => setSelectedPlan(planKey)}
                activeOpacity={0.85}
                style={styles.planTouchable}
              >
                <Card style={planCardStyle}>
                  {/* Header row: name + badge + radio */}
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View style={styles.planHeaderRight}>
                      {plan.badge && (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsBadgeText}>{plan.badge}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.radio,
                          isSelected && styles.radioSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={theme.colors.onAccent}
                          />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Price row */}
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>{plan.perMonth}</Text>
                    <Text style={styles.planPeriod}> {plan.periodLabel}</Text>
                  </View>

                  {/* Features */}
                  <View style={styles.featuresList}>
                    {visibleFeatures.map((feature, index) => (
                      <View key={index} style={styles.featureRow}>
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={theme.colors.success}
                          style={styles.featureCheck}
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {/* See more / less */}
                  {canToggle && (
                    <TouchableOpacity
                      onPress={() => toggleExpanded(planKey)}
                      style={styles.seeMoreRow}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.seeMoreText}>
                        {isExpanded ? 'See less' : 'See more'}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={theme.colors.accent}
                      />
                    </TouchableOpacity>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Subscribe button */}
        <Button
          title={loading ? 'Loading...' : 'Start free trial'}
          onPress={handleSubscribe}
          disabled={loading}
          style={styles.subscribeButton}
        />

        <Text style={styles.footerText}>
          Payments processed securely via Stripe. Cancel anytime from your account settings.
        </Text>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenLayout: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.base,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  heading: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
    lineHeight: theme.lineHeight.h1,
  },
  subtitle: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    lineHeight: theme.lineHeight.body,
    marginBottom: 26,
  },
  planCards: {
    gap: 20,
    marginBottom: 28,
  },
  planTouchable: {
    borderRadius: 30,
  },
  planCard: {
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surface,
    borderRadius: 30,
    shadowOpacity: 0,
    elevation: 0,
  },
  planCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentLight,
    borderWidth: 1.4,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  planHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsBadge: {
    backgroundColor: '#AEC3FF',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.pill,
    marginRight: theme.spacing.md,
  },
  savingsBadgeText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.accent,
  },
  planName: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h3,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  radioSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.sm,
  },
  planPrice: {
    fontFamily: theme.typography.phosphateSolid,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.foreground,
    letterSpacing: -0.3,
  },
  planPeriod: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginLeft: theme.spacing.xs,
  },
  featuresList: {
    marginTop: theme.spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom: theme.spacing.xs,
  },
  featureCheck: {
    marginRight: theme.spacing.sm,
  },
  featureText: {
    flex: 1,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    lineHeight: theme.lineHeight.body,
  },
  seeMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  seeMoreText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.primary,
    marginRight: theme.spacing.xs,
  },
  subscribeButton: {
    marginBottom: 14,
    minHeight: 64,
    borderRadius: theme.borderRadius.button,
  },
  footerText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
    marginBottom: theme.spacing.sm,
  },
});
