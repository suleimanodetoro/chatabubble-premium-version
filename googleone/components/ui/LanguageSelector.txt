// components/ui/LanguageSelector.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Modal, 
  View, 
  ScrollView, 
  TextInput,
  Pressable,
  Text
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme/theme';
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
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [customLanguage, setCustomLanguage] = useState('');

  // Reset search when modal opens
  useEffect(() => {
    if (isVisible) {
      setSearchQuery('');
    }
  }, [isVisible]);

  // Filter languages by search query
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
        <View style={styles.content}>
          {/* Handle indicator at top */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          <Text style={styles.title}>Choose Language</Text>
          
          {/* Search input */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search languages..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Language list */}
          <ScrollView style={styles.languageList}>
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map(language => (
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
                  <View style={styles.languageInfo}>
                    <View style={styles.flagContainer}>
                      <Feather 
                        name="globe" 
                        size={18} 
                        color={selectedLanguage?.code === language.code ? theme.colors.primary.main : "#64748B"} 
                      />
                    </View>
                    <Text style={[
                      styles.languageName,
                      selectedLanguage?.code === language.code && styles.selectedText
                    ]}>
                      {language.name}
                    </Text>
                  </View>
                  
                  {selectedLanguage?.code === language.code && (
                    <Feather name="check" size={20} color={theme.colors.primary.main} />
                  )}
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="search" size={24} color="#9CA3AF" />
                <Text style={styles.emptyText}>No languages match "{searchQuery}"</Text>
              </View>
            )}
          </ScrollView>

          {/* Custom language section */}
          <View style={styles.customSection}>
            <Text style={styles.sectionTitle}>Add Custom Language</Text>
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="Enter language name"
                value={customLanguage}
                onChangeText={setCustomLanguage}
                placeholderTextColor="#9CA3AF"
              />
              <Pressable 
                style={styles.addButton}
                onPress={handleAddCustom}
                disabled={!customLanguage.trim()}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>
          </View>

          {/* Close button */}
          <Pressable 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Feather name="x" size={18} color="#FFF" style={styles.closeIcon} />
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
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
    padding: 20,
    maxHeight: '80%',
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1E293B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1E293B',
  },
  languageList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedItem: {
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
  },
  languageName: {
    fontSize: 16,
    color: '#1E293B',
  },
  selectedText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  customSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1E293B',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  customInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
  },
  addButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  closeIcon: {
    marginRight: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});