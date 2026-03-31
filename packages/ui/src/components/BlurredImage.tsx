import React from 'react';
import { StyleSheet, View, Image, type ViewStyle, type ImageSourcePropType } from 'react-native';
import { theme } from '../theme';

export interface BlurredImageProps {
  source: ImageSourcePropType;
  blurRadius?: number;
  aspectRatio?: number;
  style?: ViewStyle;
}

/**
 * Placeholder component for blurred screenshot display (used in the Ally app feed).
 * Uses React Native's built-in blurRadius on the Image component.
 */
export function BlurredImage({ source, blurRadius = 25, aspectRatio = 16 / 9, style }: BlurredImageProps) {
  return (
    <View style={[styles.container, { aspectRatio }, style]}>
      <Image
        source={source}
        style={styles.image}
        blurRadius={blurRadius}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: theme.borderRadius.card,
    overflow: 'hidden',
    backgroundColor: theme.colors.warmBg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
