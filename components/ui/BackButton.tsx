// components/ui/BackButton.tsx
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
export function BackButton({ onPress }: { onPress?: () => void }) {
    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (onPress) {
        onPress();
      } else {
        router.back();
      }
    };
  
    return (
      <Pressable 
        onPress={handlePress}
        style={({ pressed }) => [
          pressed && { opacity: 0.7 }
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="chevron-left" size={28} color="#007AFF" />
      </Pressable>
    );
  }