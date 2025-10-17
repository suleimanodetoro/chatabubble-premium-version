// components/HapticTab.tsx
import React from 'react';
// Pressable and Haptics removed
import { Feather } from '@expo/vector-icons';

interface HapticTabProps {
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  size?: number;
}

// Removed Pressable wrapper and onPress handler
export function HapticTab({ iconName, color, size = 24 }: HapticTabProps) {
  return (
    <Feather name={iconName} size={size} color={color} />
  );
}
