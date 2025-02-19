// components/ui/AppleSignInButton.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ThemedText } from '../ThemedText';

interface AppleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function AppleSignInButton({ onPress, disabled }: AppleSignInButtonProps) {
  return (
    <Pressable
      style={[styles.appleButton, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.buttonContent}>
        {/* FontAwesome apple icon */}
        <FontAwesome name="apple" size={24} color="#fff" style={styles.icon} />
        <ThemedText style={styles.appleButtonText}>Sign in with Apple</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  appleButton: {
    backgroundColor: '#000',   // Apple-style black background
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
