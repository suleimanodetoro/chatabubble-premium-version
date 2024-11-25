// app/(tabs)/profile.tsx
import { StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useAppStore } from '../../hooks/useAppStore';
import { Language } from '../../types';

const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'es', name: 'Spanish', direction: 'ltr' },
  { code: 'fr', name: 'French', direction: 'ltr' },
  { code: 'de', name: 'German', direction: 'ltr' },
  { code: 'it', name: 'Italian', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', direction: 'ltr' },
  { code: 'ja', name: 'Japanese', direction: 'ltr' },
];

export default function ProfileScreen() {
  const { user, setUser } = useAppStore();

  const renderLanguageCard = ({ item: language }: { item: Language }) => {
    const isLearning = user?.learningLanguages.some(l => l.code === language.code);
    const level = user?.currentLevel[language.code];

    return (
      <ThemedView 
        style={[
          styles.languageCard,
          isLearning && styles.learningCard
        ]}
        onTouchEnd={() => {
          if (user && !isLearning) {
            setUser({
              ...user,
              learningLanguages: [...user.learningLanguages, language],
              currentLevel: {
                ...user.currentLevel,
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
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.name}>
          {user?.name || 'Guest User'}
        </ThemedText>
        <ThemedText style={styles.email}>
          {user?.email || 'Sign in to sync your progress'}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.statsSection}>
        <ThemedText style={styles.sectionTitle}>
          Your Progress
        </ThemedText>
        <ThemedView style={styles.statsGrid}>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Total Sessions</ThemedText>
          </ThemedView>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Words Learned</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.languagesSection}>
        <ThemedText style={styles.sectionTitle}>
          Languages
        </ThemedText>
        <FlashList
          data={AVAILABLE_LANGUAGES}
          renderItem={renderLanguageCard}
          estimatedItemSize={80}
          numColumns={2}
          contentContainerStyle={styles.languagesGrid}
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      padding: 20,
      alignItems: 'center',
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    email: {
      fontSize: 14,
      opacity: 0.7,
      marginTop: 4,
    },
    statsSection: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 15,
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
  });