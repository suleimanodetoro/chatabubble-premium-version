// components/HapticTab.tsx
import React from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

interface HapticTabProps {
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  size?: number;
}

export function HapticTab({ iconName, color, size = 24 }: HapticTabProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable onPress={handlePress}>
      <Feather name={iconName} size={size} color={color} />
    </Pressable>
  );
}