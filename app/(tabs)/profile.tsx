// app/(tabs)/profile.tsx
import { StyleSheet, Alert, Pressable, ScrollView, TextInput, Modal, View, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAppStore } from '@/hooks/useAppStore';
import { Language } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MetricsService } from '@/lib/services/metrics';
import { ProfileService } from '@/lib/services/profile';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { 
    user, 
    setUser,
    setCurrentSession,
    setCurrentScenario,
  } = useAppStore();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isLanguagesExpanded, setIsLanguagesExpanded] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [stats, setStats] = useState({
    totalSessions: 0,
    languageStats: {} as Record<string, {
      sessionsCompleted: number,
      lastPracticed: string | null
    }>
  });

  const AVAILABLE_LANGUAGES: Language[] = [
    { code: 'es', name: 'Spanish', direction: 'ltr' },
    { code: 'fr', name: 'French', direction: 'ltr' },
    { code: 'de', name: 'German', direction: 'ltr' },
    { code: 'it', name: 'Italian', direction: 'ltr' },
    { code: 'pt', name: 'Portuguese', direction: 'ltr' },
    { code: 'ja', name: 'Japanese', direction: 'ltr' },
  ];

  // Load user metrics
  useEffect(() => {
    async function loadUserStats() {
      if (user?.id) {
        try {
          setIsLoading(true);
          const metrics = await MetricsService.getUserMetrics(user.id);
          setStats({
            totalSessions: metrics.totalSessions,
            languageStats: Object.entries(metrics.languageProgress).reduce((acc, [code, data]) => ({
              ...acc,
              [code]: {
                sessionsCompleted: data.sessionsCompleted,
                lastPracticed: data.lastPracticed
              }
            }), {})
          });
        } catch (error) {
          console.error('Error loading user stats:', error);
          Alert.alert('Error', 'Failed to load user statistics');
        } finally {
          setIsLoading(false);
        }
      }
    }
    loadUserStats();
  }, [user?.id]);

  // Event handlers
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
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
    const languageStats = stats.languageStats[language.code];

    const handleLanguageSelect = async () => {
      if (!user) return;
      
      try {
        const updatedLanguages = isLearning
          ? user.learningLanguages.filter(l => l.code !== language.code)
          : [...(user.learningLanguages || []), language];

        await ProfileService.updateProfile(user.id, {
          learning_languages: updatedLanguages,
          current_levels: {
            ...(user.currentLevel || {}),
            [language.code]: isLearning ? undefined : 'beginner'
          }
        });

        setUser({
          ...user,
          learningLanguages: updatedLanguages,
          currentLevel: {
            ...(user.currentLevel || {}),
            [language.code]: isLearning ? undefined : 'beginner'
          }
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to update language preferences');
      }
    };

    return (
      <Pressable onPress={handleLanguageSelect} style={styles.languageCard}>
        <ThemedView 
          style={[
            styles.languageCardInner,
            isLearning && styles.learningCard
          ]}
        >
          <ThemedText style={styles.languageName}>
            {language.name}
          </ThemedText>
          {isLearning && (
            <>
              <ThemedText style={styles.levelBadge}>
                {level}
              </ThemedText>
              {languageStats && (
                <ThemedText style={styles.statsText}>
                  {languageStats.sessionsCompleted} sessions
                </ThemedText>
              )}
            </>
          )}
        </ThemedView>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.header}>
            <ThemedText style={styles.email}>
              {user?.email || 'Guest User'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Your Progress</ThemedText>
            <ThemedView style={styles.statsGrid}>
              <ThemedView style={styles.statBox}>
                <ThemedText style={styles.statNumber}>
                  {isLoading ? '...' : user?.learningLanguages?.length || 0}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Languages</ThemedText>
              </ThemedView>
              <ThemedView style={styles.statBox}>
                <ThemedText style={styles.statNumber}>
                  {isLoading ? '...' : stats.totalSessions}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Total Sessions</ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <Pressable 
              style={styles.sectionHeader} 
              onPress={() => setIsLanguagesExpanded(!isLanguagesExpanded)}
            >
              <ThemedText style={styles.sectionTitle}>Learning Languages</ThemedText>
  <ThemedText style={styles.expandIcon}>
    {isLanguagesExpanded ? '▼' : '▲'}
  </ThemedText>
            </Pressable>
            
            {isLanguagesExpanded && (
              <View style={styles.languagesGrid}>
                {AVAILABLE_LANGUAGES.map((language) => (
                  <View key={language.code} style={styles.languageWrapper}>
                    {renderLanguageCard({ item: language })}
                  </View>
                ))}
              </View>
            )}
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

          <ThemedView style={[styles.section, styles.dangerSection]}>
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
        </ScrollView>

        {/* Modals */}
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
      backgroundColor: '#fff',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
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
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 15,
    },
    dangerSection: {
      borderBottomWidth: 0,
      marginTop: 20,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statsText: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
    },
    statBox: {
      alignItems: 'center',
      padding: 15,
      borderRadius: 12,
      flex: 1,
      margin: 5,
      backgroundColor: '#f8f9fa',
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
    languagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -5,
    },
    languageWrapper: {
      width: '50%',
      padding: 5,
    },
    languageCard: {
      flex: 1,
    },
    languageCardInner: {
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
    button: {
      backgroundColor: '#f8f9fa',
      padding: 15,
      borderRadius: 8,
      marginBottom: 10,
    },
    buttonText: {
      fontSize: 16,
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