// app/create-scenario.tsx
import { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Scenario, Language } from '@/types';
import { useAppStore } from '@/hooks/useAppStore';
import { generateId } from '@/lib/utils/ids';


export default function CreateScenarioScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [personaName, setPersonaName] = useState('');
  const [personaRole, setPersonaRole] = useState('');
  const [personaPersonality, setPersonaPersonality] = useState('');
  const [category, setCategory] = useState('shopping');
  const [difficulty, setDifficulty] = useState('beginner');
  const [languageStyle, setLanguageStyle] = useState('casual');
  const [selectedLanguage, setSelectedLanguage] = useState<Language | undefined>();
  const [isLanguageSelectorVisible, setIsLanguageSelectorVisible] = useState(false);

  const { addScenario } = useAppStore();

  const handleCreate = useCallback(() => {
    console.log('Validating form...', {
      title,
      description,
      personaName,
      personaRole,
      selectedLanguage,
    });

    if (!title.trim()) {
      Alert.alert('Missing Information', 'Please enter a title');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Information', 'Please enter a description');
      return;
    }
    if (!personaName.trim()) {
      Alert.alert('Missing Information', 'Please enter a persona name');
      return;
    }
    if (!personaRole.trim()) {
      Alert.alert('Missing Information', 'Please enter a persona role');
      return;
    }
    if (!selectedLanguage) {
      Alert.alert('Missing Information', 'Please select a target language');
      return;
    }

    try {
      const newScenario: Scenario = {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        category: category as 'shopping' | 'dining' | 'travel' | 'business' | 'casual',
        difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
        persona: {
          name: personaName.trim(),
          role: personaRole.trim(),
          personality: personaPersonality.trim() || 'Friendly and professional',
          languageStyle: languageStyle as 'formal' | 'casual' | 'mixed',
        },
        targetLanguage: selectedLanguage,
      };

      console.log('Selected Language:', selectedLanguage); // Add this
      console.log('Creating scenario:', newScenario);
      addScenario(newScenario);
      router.back();
    } catch (error) {
      console.error('Error creating scenario:', error);
      Alert.alert('Error', 'Failed to create scenario. Please try again.');
    }
  }, [
    title,
    description,
    personaName,
    personaRole,
    personaPersonality,
    category,
    difficulty,
    languageStyle,
    selectedLanguage,
    addScenario,
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              style={[styles.input, styles.multilineInput]}
              placeholder="Describe the scenario and its goals"
              placeholderTextColor="#A3A3A3"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
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
                <Pressable
                  key={cat}
                  style={[
                    styles.chip,
                    category === cat.toLowerCase() && styles.selectedChip,
                  ]}
                  onPress={() => setCategory(cat.toLowerCase())}
                >
                  <ThemedText style={[
                    styles.chipText,
                    category === cat.toLowerCase() && styles.selectedChipText,
                  ]}>
                    {cat}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>

          <ThemedView style={styles.selectionGroup}>
            <ThemedText style={styles.label}>Difficulty</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                <Pressable
                  key={diff}
                  style={[
                    styles.chip,
                    difficulty === diff.toLowerCase() && styles.selectedChip,
                  ]}
                  onPress={() => setDifficulty(diff.toLowerCase())}
                >
                  <ThemedText style={[
                    styles.chipText,
                    difficulty === diff.toLowerCase() && styles.selectedChipText,
                  ]}>
                    {diff}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>

          <ThemedView style={styles.selectionGroup}>
            <ThemedText style={styles.label}>Language Style</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Casual', 'Formal', 'Mixed'].map((style) => (
                <Pressable
                  key={style}
                  style={[
                    styles.chip,
                    languageStyle === style.toLowerCase() && styles.selectedChip,
                  ]}
                  onPress={() => setLanguageStyle(style.toLowerCase())}
                >
                  <ThemedText style={[
                    styles.chipText,
                    languageStyle === style.toLowerCase() && styles.selectedChipText,
                  ]}>
                    {style}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>Target Language*</ThemedText>
            <Pressable
              style={styles.languageSelector}
              onPress={() => setIsLanguageSelectorVisible(true)}
            >
              <ThemedText
                style={selectedLanguage ? styles.selectedLanguage : styles.placeholderText}
              >
                {selectedLanguage?.name || 'Select a language'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <Pressable 
            style={styles.createButton} 
            onPress={handleCreate}
          >
            <ThemedText style={styles.createButtonText}>Create Scenario</ThemedText>
          </Pressable>
        </ScrollView>

        <LanguageSelector
          isVisible={isLanguageSelectorVisible}
          onClose={() => setIsLanguageSelectorVisible(false)}
          onSelectLanguage={setSelectedLanguage}
          selectedLanguage={selectedLanguage}
        />
      </KeyboardAvoidingView>
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
  multilineInput: {
    height: 80,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
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
  languageSelector: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  placeholderText: {
    color: '#A3A3A3',
    fontSize: 16,
  },
  selectedLanguage: {
    color: '#1C1C1E',
    fontSize: 16,
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