import React from 'react';
import { StyleSheet, View, Text, Image, type ViewStyle, type ImageSourcePropType } from 'react-native';
import { theme } from '../theme';

export interface AvatarProps {
  name?: string | null;
  source?: ImageSourcePropType;
  size?: number;
  style?: ViewStyle;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, source, size = 40, style }: AvatarProps) {
  const containerSize = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.image, containerSize, style]}
      />
    );
  }

  return (
    <View style={[styles.fallback, containerSize, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: theme.fontFamily,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
});
