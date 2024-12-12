// app/(tabs)/profile.tsx
import { StyleSheet, Alert, Pressable, TextInput, Modal, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAppStore } from '@/hooks/useAppStore';
import { Language } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function ProfileScreen() {
  const router = useRouter();
  const { 
    user, 
    setUser,
    setCurrentSession,
    setCurrentScenario,
  } = useAppStore();

  // Modal states
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const AVAILABLE_LANGUAGES: Language[] = [
    { code: 'es', name: 'Spanish', direction: 'ltr' },
    { code: 'fr', name: 'French', direction: 'ltr' },
    { code: 'de', name: 'German', direction: 'ltr' },
    { code: 'it', name: 'Italian', direction: 'ltr' },
    { code: 'pt', name: 'Portuguese', direction: 'ltr' },
    { code: 'ja', name: 'Japanese', direction: 'ltr' },
  ];

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear all relevant state
      setUser(null);
      setCurrentSession(null);
      setCurrentScenario(null);
      
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Error signing out', (error as Error).message);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Error', 'Please enter a new email');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ 
        email: newEmail.trim() 
      });
      
      if (error) throw error;
      
      Alert.alert(
        'Success', 
        'Please check your new email for verification',
        [{ text: 'OK', onPress: () => setIsEmailModalVisible(false) }]
      );
      setNewEmail('');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      
      if (error) throw error;
      
      Alert.alert(
        'Success', 
        'Password updated successfully',
        [{ text: 'OK', onPress: () => setIsPasswordModalVisible(false) }]
      );
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.admin.deleteUser(
                user?.id as string
              );
              if (error) throw error;
              setUser(null);
              setCurrentSession(null);
              setCurrentScenario(null);
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const renderLanguageCard = ({ item: language }: { item: Language }) => {
    const isLearning = user?.learningLanguages?.some(l => l.code === language.code) || false;
    const level = user?.currentLevel?.[language.code];
  
    return (
      <ThemedView 
        style={[
          styles.languageCard,
          isLearning && styles.learningCard
        ]}
        onTouchEnd={() => {
          if (user) {
            setUser({
              ...user,
              learningLanguages: [...(user.learningLanguages || []), language],
              currentLevel: {
                ...(user.currentLevel || {}),
                [language.code]: 'beginner'
              }
            });
          }
        }}
      >
        <ThemedText style={styles.languageName}>
          {language.name}
        </ThemedText>
        {isLearning && level && (
          <ThemedText style={styles.levelBadge}>
            {level}
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
    <ThemedView style={styles.container}>

      <ThemedView style={styles.header}>
        <ThemedText style={styles.email}>
          {user?.email || 'Guest User'}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Account Settings</ThemedText>
        <Pressable 
          style={styles.button} 
          onPress={() => setIsEmailModalVisible(true)}
        >
          <ThemedText style={styles.buttonText}>Update Email</ThemedText>
        </Pressable>
        <Pressable 
          style={styles.button} 
          onPress={() => setIsPasswordModalVisible(true)}
        >
          <ThemedText style={styles.buttonText}>Update Password</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Your Progress</ThemedText>
        <ThemedView style={styles.statsGrid}>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>
            {user?.learningLanguages?.length || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Languages</ThemedText>
          </ThemedView>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Total Sessions</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.languagesSection}>
        <ThemedText style={styles.sectionTitle}>Learning Languages</ThemedText>
        <FlashList
          data={AVAILABLE_LANGUAGES}
          renderItem={renderLanguageCard}
          estimatedItemSize={80}
          numColumns={2}
          contentContainerStyle={styles.languagesGrid}
        />
      </ThemedView>

      <ThemedView style={styles.footer}>
        <Pressable 
          style={styles.signOutButton} 
          onPress={handleSignOut}
        >
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </Pressable>

        <Pressable 
          style={styles.deleteButton} 
          onPress={handleDeleteAccount}
        >
          <ThemedText style={styles.deleteText}>Delete Account</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Email Update Modal */}
      <Modal
        visible={isEmailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEmailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Update Email</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="New Email"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={styles.modalButton} 
                onPress={() => setIsEmailModalVisible(false)}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]} 
                onPress={handleUpdateEmail}
              >
                <ThemedText style={styles.modalButtonTextPrimary}>Update</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Password Update Modal */}
      <Modal
        visible={isPasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Update Password</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={styles.modalButton} 
                onPress={() => setIsPasswordModalVisible(false)}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]} 
                onPress={handleUpdatePassword}
              >
                <ThemedText style={styles.modalButtonTextPrimary}>Update</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
    </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    flex: 1,
    margin: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  languagesSection: {
    flex: 1,
    padding: 20,
  },
  languagesGrid: {
    padding: 5,
  },
  languageCard: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  learningCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  levelBadge: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
  },
  signOutButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteText: {
    color: '#ff3b30',
    fontSize: 16,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
  },
});