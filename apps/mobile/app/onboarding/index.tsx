import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout, Header, Input, Button, theme } from '@ascension/ui';
import { useApi } from '../../src/hooks/useApi';
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
    <ScreenLayout>
      <Header
        title="Create account"
      />
      <View style={styles.textBlock}>
        <Text style={styles.stepIndicator}>STEP 1 OF 3</Text>
        <Text style={styles.heading}>About you</Text>
        <Text style={styles.subheading}>Tell us your name and what you want to achieve.</Text>
      </View>

      <Input
        label="Your name"
        placeholder="First name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        textContentType="name"
      />

      <Text style={styles.goalsLabel}>What are your goals?</Text>
      <Text style={styles.goalsHint}>Select all that apply.</Text>

      <View style={styles.goalsList}>
        {GOALS.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <TouchableOpacity
              key={goal.id}
              onPress={() => toggleGoal(goal.id)}
              activeOpacity={0.7}
              style={styles.goalItem}
            >
              <View
                style={[
                  styles.goalRow,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}
                >
                  {isSelected && (
                    <View style={styles.checkboxFill}>
                      <View style={styles.checkmark} />
                    </View>
                  )}
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
            </TouchableOpacity>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={saving ? 'Saving...' : 'Continue'}
        onPress={handleNext}
        disabled={saving || !name.trim() || selectedGoals.length === 0}
        style={styles.nextButton}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  textBlock: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    alignSelf: 'stretch',
    marginBottom: theme.spacing.lg,
  },
  stepIndicator: {
    fontFamily: 'Nunito',
    fontSize: theme.fontSize.caption,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    letterSpacing: 1,
  },
  heading: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.h1,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  subheading: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.muted,
  },
  goalsLabel: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.header,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  goalsHint: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing.base,
  },
  goalsList: {
    gap: 20,
    alignSelf: 'stretch',
  },
  goalItem: {
    alignSelf: 'stretch',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#223D8C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    flexShrink: 0,
  },
  checkboxSelected: {
    borderColor: '#223D8C',
    borderWidth: 0,
  },
  checkboxFill: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#223D8C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 6,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginTop: -1,
  },
  goalText: {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.bodyLg,
    color: theme.colors.foreground,
  },
  goalTextSelected: {
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
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
