// app/create-scenario.tsx
import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
  Pressable,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Scenario, Language } from '@/types';
import { useAppStore } from '@/hooks/useAppStore';
import { generateId } from '@/lib/utils/ids';
import { ScenarioService } from '@/lib/services/scenario';
import { useTheme } from '@/lib/theme/theme';
import { Heading1, Heading2, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { BackButton } from '@/components/ui/BackButton';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

// Category chip component
const CategoryChip = ({ 
  label, 
  isSelected, 
  onPress 
}: { 
  label: string; 
  isSelected: boolean; 
  onPress: () => void;
}) => {
  const theme = useTheme();
  
  return (
    <Pressable
      style={[
        styles.chip,
        isSelected ? { 
          backgroundColor: theme.colors.primary.main,
          shadowColor: theme.colors.primary.main,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 3,
        } : { 
          backgroundColor: '#F5F7FA',
        }
      ]}
      onPress={onPress}
    >
      {isSelected && (
        <Feather 
          name="check" 
          size={14} 
          color="#fff" 
          style={{ marginRight: 4 }}
        />
      )}
      <Body2 
        color={isSelected ? "#fff" : theme.colors.text.primary}
        weight={isSelected ? "semibold" : "regular"}
      >
        {label}
      </Body2>
    </Pressable>
  );
};

export default function CreateScenarioScreen() {
  const theme = useTheme();
  const { addScenario, user } = useAppStore();

  // Form state
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation values
  const headerOpacity = useSharedValue(0);
  const formOpacity = useSharedValue(0);
  
  // Start animations - FIXED: Changed useState to useEffect
  useEffect(() => {
    setTimeout(() => {
      headerOpacity.value = withSpring(1, { damping: 18 });
    }, 100);
    
    setTimeout(() => {
      formOpacity.value = withSpring(1, { damping: 18 });
    }, 300);
  }, []); // Empty dependency array to run only once on mount
  
  // Animated styles
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: (1 - headerOpacity.value) * -20 }]
  }));
  
  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: (1 - formOpacity.value) * -15 }]
  }));

  const handleCreate = useCallback(async () => {
    // Validation
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
      setIsSubmitting(true);
      
      if (!user?.id) {
        Alert.alert('Error', 'Must be logged in to create scenarios');
        return;
      }
  
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
        target_language: selectedLanguage,
      };

      // First save to Supabase
      await ScenarioService.createScenario(newScenario, user.id);
      
      // Then add to local state
      addScenario(newScenario);
      router.back();
    } catch (error) {
      console.error('Error creating scenario:', error);
      Alert.alert('Error', 'Failed to create scenario. Please try again.');
    } finally {
      setIsSubmitting(false);
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
    user
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <Animated.View style={[styles.header, headerAnimatedStyle]}>
          <View style={styles.headerRow}>
            <BackButton />
            <Heading1 style={styles.headerTitle}>Create Scenario</Heading1>
            <View style={{ width: 40 }} />
          </View>
          <Body1 style={styles.headerSubtitle} color={theme.colors.text.secondary}>
            Create a new language practice scenario
          </Body1>
        </Animated.View>
        
        <Animated.View style={[styles.formContainer, formAnimatedStyle]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Card variant="elevated" style={styles.formCard}>
              <CardContent>
                <Heading2 style={styles.sectionTitle}>Scenario Details</Heading2>
                
                <Input
                  label="Title*"
                  placeholder="e.g., Shopping for Groceries"
                  value={title}
                  onChangeText={setTitle}
                  containerStyle={styles.inputGroup}
                  iconName="edit-3"
                />
                
                <Input
                  label="Description*"
                  placeholder="Describe the scenario and its goals"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  containerStyle={styles.inputGroup}
                  iconName="align-left"
                />
                
                <Heading2 style={[styles.sectionTitle, styles.topSpacing]}>Conversation Partner</Heading2>
                
                <Input
                  label="Persona Name*"
                  placeholder="e.g., Maria"
                  value={personaName}
                  onChangeText={setPersonaName}
                  containerStyle={styles.inputGroup}
                  iconName="user"
                />
                
                <Input
                  label="Persona Role*"
                  placeholder="e.g., Shop Assistant"
                  value={personaRole}
                  onChangeText={setPersonaRole}
                  containerStyle={styles.inputGroup}
                  iconName="briefcase"
                />
                
                <Input
                  label="Persona Personality"
                  placeholder="e.g., Friendly and helpful"
                  value={personaPersonality}
                  onChangeText={setPersonaPersonality}
                  containerStyle={styles.inputGroup}
                  iconName="smile"
                  hint="Leave blank for default friendly personality"
                />
                
                <Heading2 style={[styles.sectionTitle, styles.topSpacing]}>Settings</Heading2>
                
                <View style={styles.selectionGroup}>
                  <Body1 weight="semibold" style={styles.selectionLabel}>Category</Body1>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContainer}
                  >
                    {['Shopping', 'Dining', 'Travel', 'Business', 'Casual'].map((cat) => (
                      <CategoryChip
                        key={cat}
                        label={cat}
                        isSelected={category === cat.toLowerCase()}
                        onPress={() => setCategory(cat.toLowerCase())}
                      />
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.selectionGroup}>
                  <Body1 weight="semibold" style={styles.selectionLabel}>Difficulty</Body1>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContainer}
                  >
                    {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                      <CategoryChip
                        key={diff}
                        label={diff}
                        isSelected={difficulty === diff.toLowerCase()}
                        onPress={() => setDifficulty(diff.toLowerCase())}
                      />
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.selectionGroup}>
                  <Body1 weight="semibold" style={styles.selectionLabel}>Language Style</Body1>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContainer}
                  >
                    {['Casual', 'Formal', 'Mixed'].map((style) => (
                      <CategoryChip
                        key={style}
                        label={style}
                        isSelected={languageStyle === style.toLowerCase()}
                        onPress={() => setLanguageStyle(style.toLowerCase())}
                      />
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.languageGroup}>
                  <Body1 weight="semibold" style={styles.selectionLabel}>Target Language*</Body1>
                  <Pressable
                    style={styles.languageSelector}
                    onPress={() => setIsLanguageSelectorVisible(true)}
                  >
                    <Feather 
                      name="globe" 
                      size={18} 
                      color={selectedLanguage ? theme.colors.primary.main : theme.colors.text.hint} 
                      style={styles.languageIcon}
                    />
                    <Body1
                      color={selectedLanguage ? theme.colors.text.primary : theme.colors.text.hint}
                    >
                      {selectedLanguage?.name || 'Select a language'}
                    </Body1>
                    <Feather name="chevron-down" size={18} color={theme.colors.text.hint} />
                  </Pressable>
                </View>
              </CardContent>
            </Card>
            
            <Button 
              variant="primary"
              fullWidth
              size="large"
              icon="check"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={handleCreate}
              style={styles.createButton}
            >
              Create Scenario
            </Button>
          </ScrollView>
        </Animated.View>

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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    textAlign: 'center',
    flexGrow: 1,
  },
  headerSubtitle: {
    textAlign: 'center',
    opacity: 0.8,
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  formCard: {
    marginBottom: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  topSpacing: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  selectionGroup: {
    marginBottom: 20,
  },
  selectionLabel: {
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageGroup: {
    marginBottom: 24,
  },
  languageSelector: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  languageIcon: {
    marginRight: 12,
  },
  createButton: {
    marginTop: 8,
  },
});