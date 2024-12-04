// components/ui/LanguageSelector.tsx
import { useState } from 'react';
import { 
  StyleSheet, 
  Modal, 
  View, 
  ScrollView, 
  TextInput,
  Pressable,
  Alert 
} from 'react-native';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { Language, PREDEFINED_LANGUAGES } from '../../types';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  onSelectLanguage: (language: Language) => void;
  selectedLanguage?: Language;
}

export function LanguageSelector({ 
  isVisible, 
  onClose, 
  onSelectLanguage,
  selectedLanguage 
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customLanguage, setCustomLanguage] = useState('');

  const filteredLanguages = PREDEFINED_LANGUAGES.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCustom = () => {
    if (!customLanguage.trim()) return;

    const newLanguage: Language = {
      code: customLanguage.toLowerCase().replace(/\s+/g, '-'),
      name: customLanguage.trim(),
      direction: 'ltr',
      isCustom: true
    };

    onSelectLanguage(newLanguage);
    setCustomLanguage('');
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <ThemedView style={styles.content}>
          <ThemedText style={styles.title}>Select Language</ThemedText>
          
          <TextInput
            style={styles.searchInput}
            placeholder="Search languages..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#A3A3A3"
          />

          <ScrollView style={styles.languageList}>
            {filteredLanguages.map(language => (
              <Pressable
                key={language.code}
                style={[
                  styles.languageItem,
                  selectedLanguage?.code === language.code && styles.selectedItem
                ]}
                onPress={() => {
                  onSelectLanguage(language);
                  onClose();
                }}
              >
                <ThemedText style={[
                  styles.languageName,
                  selectedLanguage?.code === language.code && styles.selectedText
                ]}>
                  {language.name}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.customSection}>
            <ThemedText style={styles.sectionTitle}>Add Custom Language</ThemedText>
            <TextInput
              style={styles.customInput}
              placeholder="Enter language name"
              value={customLanguage}
              onChangeText={setCustomLanguage}
              placeholderTextColor="#A3A3A3"
            />
            <Pressable 
              style={styles.addButton}
              onPress={handleAddCustom}
            >
              <ThemedText style={styles.addButtonText}>Add Language</ThemedText>
            </Pressable>
          </View>

          <Pressable 
            style={styles.closeButton}
            onPress={onClose}
          >
            <ThemedText style={styles.closeButtonText}>Close</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  languageList: {
    maxHeight: 300,
  },
  languageItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectedItem: {
    backgroundColor: '#007AFF20',
  },
  languageName: {
    fontSize: 16,
  },
  selectedText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  customSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  customInput: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});