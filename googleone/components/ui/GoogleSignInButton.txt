// components/ui/GoogleSignInButton.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { ThemedText } from '../ThemedText';

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, disabled }: GoogleSignInButtonProps) {
  return (
    <Pressable
      style={[styles.googleButton, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.buttonContent}>
        {/* FontAwesome google icon */}
        <FontAwesome name="google" size={24} color="#DB4437" style={styles.icon} />
        <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#dbdbdb',
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
  googleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
