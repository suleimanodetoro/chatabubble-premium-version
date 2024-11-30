// app/(tabs)/create-scenario.tsx
import { useState } from 'react';
import { StyleSheet, ScrollView, TextInput, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useAppStore } from '../../hooks/useAppStore';
import { Scenario } from '../../types';

export default function CreateScenarioScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('shopping');
  const [difficulty, setDifficulty] = useState('beginner');
  const [personaName, setPersonaName] = useState('');
  const [personaRole, setPersonaRole] = useState('');
  const [personaPersonality, setPersonaPersonality] = useState('');
  const [languageStyle, setLanguageStyle] = useState('casual');

  const { addScenario } = useAppStore();

  const handleCreate = () => {
    if (!title || !description || !personaName || !personaRole) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    const newScenario: Scenario = {
      id: Date.now().toString(),
      title,
      description,
      category: category as 'shopping' | 'dining' | 'travel' | 'business' | 'casual',
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      persona: {
        name: personaName,
        role: personaRole,
        personality: personaPersonality || 'Friendly and professional',
        languageStyle: languageStyle as 'formal' | 'casual' | 'mixed',
      },
    };

    addScenario(newScenario);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <ThemedText style={styles.title}>Create New Scenario</ThemedText>

        <ThemedView style={styles.inputGroup}>
          <ThemedText style={styles.label}>Title*</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g., Shopping for Groceries"
            placeholderTextColor="#A3A3A3"
            value={title}
            onChangeText={setTitle}
          />
        </ThemedView>

        <ThemedView style={styles.inputGroup}>
          <ThemedText style={styles.label}>Description*</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Describe the scenario and its goals"
            placeholderTextColor="#A3A3A3"
            value={description}
            onChangeText={setDescription}
          />
        </ThemedView>

        <ThemedView style={styles.inputGroup}>
          <ThemedText style={styles.label}>Persona Name*</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g., Maria"
            placeholderTextColor="#A3A3A3"
            value={personaName}
            onChangeText={setPersonaName}
          />
        </ThemedView>

        <ThemedView style={styles.inputGroup}>
          <ThemedText style={styles.label}>Persona Role*</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g., Shop Assistant"
            placeholderTextColor="#A3A3A3"
            value={personaRole}
            onChangeText={setPersonaRole}
          />
        </ThemedView>

        <ThemedView style={styles.inputGroup}>
          <ThemedText style={styles.label}>Persona Personality</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g., Friendly and helpful"
            placeholderTextColor="#A3A3A3"
            value={personaPersonality}
            onChangeText={setPersonaPersonality}
          />
        </ThemedView>

        <ThemedView style={styles.selectionGroup}>
          <ThemedText style={styles.label}>Category</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Shopping', 'Dining', 'Travel', 'Business', 'Casual'].map((cat) => (
              <ThemedView
                key={cat}
                style={[
                  styles.chip,
                  category === cat.toLowerCase() && styles.selectedChip,
                ]}
                onTouchEnd={() => setCategory(cat.toLowerCase())}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    category === cat.toLowerCase() && styles.selectedChipText,
                  ]}
                >
                  {cat}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>

        <ThemedView style={styles.selectionGroup}>
          <ThemedText style={styles.label}>Difficulty</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
              <ThemedView
                key={diff}
                style={[
                  styles.chip,
                  difficulty === diff.toLowerCase() && styles.selectedChip,
                ]}
                onTouchEnd={() => setDifficulty(diff.toLowerCase())}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    difficulty === diff.toLowerCase() && styles.selectedChipText,
                  ]}
                >
                  {diff}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>

        <ThemedView style={styles.selectionGroup}>
          <ThemedText style={styles.label}>Language Style</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Casual', 'Formal', 'Mixed'].map((style) => (
              <ThemedView
                key={style}
                style={[
                  styles.chip,
                  languageStyle === style.toLowerCase() && styles.selectedChip,
                ]}
                onTouchEnd={() => setLanguageStyle(style.toLowerCase())}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    languageStyle === style.toLowerCase() && styles.selectedChipText,
                  ]}
                >
                  {style}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>

        <ThemedView style={styles.createButton} onTouchEnd={handleCreate}>
          <ThemedText style={styles.createButtonText}>Create Scenario</ThemedText>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 34,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#1C1C1E',
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1C1C1E',
  },
  selectionGroup: {
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  selectedChip: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  selectedChipText: {
    color: '#FFFFFF',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
