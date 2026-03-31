import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Input, Button, Card, theme } from '@ascension/ui';
import { useApi } from '@ascension/api';
import { useAuth } from '../../src/hooks/useAuth';

const GOALS = [
  { id: 'freedom', label: 'Freedom from pornography' },
  { id: 'relationship', label: 'Strengthen my relationship' },
  { id: 'mental_health', label: 'Better mental health' },
  { id: 'self_control', label: 'Build self-discipline' },
  { id: 'faith', label: 'Spiritual growth' },
];

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const api = useApi();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId],
    );
  };

  const handleNext = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (selectedGoals.length === 0) {
      setError('Please select at least one goal.');
      return;
    }

    if (!user) return;

    setError(null);
    setSaving(true);

    try {
      await api.users.updateProfile(user.id, {
        name: name.trim(),
        goals: selectedGoals.join(','),
      });
      router.push('/onboarding/partner');
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout title="Set Up Your Profile">
      <Text style={styles.stepIndicator}>Step 1 of 3</Text>

      <Input
        label="Your Name"
        placeholder="What should we call you?"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        textContentType="name"
      />

      <Text style={styles.goalsLabel}>What are your goals?</Text>
      <Text style={styles.goalsHint}>Select all that apply</Text>

      <View style={styles.goalsList}>
        {GOALS.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <TouchableOpacity
              key={goal.id}
              onPress={() => toggleGoal(goal.id)}
              activeOpacity={0.7}
            >
              <Card
                style={[
                  styles.goalCard,
                  isSelected && styles.goalCardSelected,
                ]}
              >
                <View style={styles.goalRow}>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.goalText,
                      isSelected && styles.goalTextSelected,
                    ]}
                  >
                    {goal.label}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={saving ? 'Saving...' : 'Next'}
        onPress={handleNext}
        disabled={saving}
        style={styles.nextButton}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stepIndicator: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
  },
  goalsLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.xs,
  },
  goalsHint: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing.base,
  },
  goalsList: {
    gap: theme.spacing.sm,
  },
  goalCard: {
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  goalCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentLight,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: theme.borderRadius.card,
    borderWidth: 2,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  checkboxSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  checkmark: {
    color: theme.colors.onAccent,
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.bold,
  },
  goalText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.body,
    color: theme.colors.foreground,
  },
  goalTextSelected: {
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.accent,
  },
  error: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: theme.spacing.base,
  },
  nextButton: {
    marginTop: theme.spacing.lg,
  },
});
