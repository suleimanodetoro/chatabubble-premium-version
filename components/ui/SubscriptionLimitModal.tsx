// components/ui/SubscriptionLimitModal.tsx
import React from 'react';
import { Modal, StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

interface SubscriptionLimitModalProps {
  visible: boolean;
  onClose: () => void;
  sessionCount: number;
  maxFreeSessions: number;
}

export default function SubscriptionLimitModal({
  visible,
  onClose,
  sessionCount,
  maxFreeSessions
}: SubscriptionLimitModalProps) {
  const handleUpgrade = () => {
    onClose();
    router.push('/(tabs)/profile');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Feather name="lock" size={40} color="#007AFF" />
          </View>
          
          <ThemedText style={styles.title}>Free Limit Reached</ThemedText>
          
          <ThemedText style={styles.description}>
            You've used {sessionCount} of your {maxFreeSessions} free conversations.
            Upgrade to Premium for unlimited conversations and more features.
          </ThemedText>
          
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitRow}>
              <Feather name="check-circle" size={18} color="#28a745" />
              <ThemedText style={styles.benefitText}>Unlimited conversations</ThemedText>
            </View>
            <View style={styles.benefitRow}>
              <Feather name="check-circle" size={18} color="#28a745" />
              <ThemedText style={styles.benefitText}>Advanced language models</ThemedText>
            </View>
            <View style={styles.benefitRow}>
              <Feather name="check-circle" size={18} color="#28a745" />
              <ThemedText style={styles.benefitText}>No ads</ThemedText>
            </View>
            <View style={styles.benefitRow}>
              <Feather name="check-circle" size={18} color="#28a745" />
              <ThemedText style={styles.benefitText}>Priority support</ThemedText>
            </View>
          </View>
          
          <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
            <ThemedText style={styles.upgradeButtonText}>Upgrade to Premium</ThemedText>
          </Pressable>
          
          <Pressable style={styles.closeButton} onPress={onClose}>
            <ThemedText style={styles.closeButtonText}>Maybe Later</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
    lineHeight: 22,
  },
  benefitsContainer: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 15,
    marginLeft: 10,
    color: '#333',
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
});