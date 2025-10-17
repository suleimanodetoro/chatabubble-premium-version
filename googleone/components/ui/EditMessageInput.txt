// components/ui/EditMessageInput.tsx
import { useState, useEffect, memo, useCallback } from 'react';
import { StyleSheet, TextInput, Pressable, View } from 'react-native';
import { ThemedText } from '../ThemedText';

interface Props {
  initialText: string;
  onSave: (newText: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const EditMessageInput = memo(function EditMessageInput({ 
  initialText, 
  onSave, 
  onCancel, 
  isLoading 
}: Props) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const handleSave = useCallback(() => {
    if (!text.trim() || isLoading) return;
    onSave(text);
  }, [text, isLoading, onSave]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        selectTextOnFocus
        editable={!isLoading}
      />
      <View style={styles.buttonContainer}>
        <Pressable 
          onPress={onCancel} 
          style={styles.cancelButton}
          disabled={isLoading}
        >
          <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
        </Pressable>
        <Pressable 
          onPress={handleSave}
          style={[
            styles.saveButton, 
            (!text.trim() || isLoading) && styles.saveButtonDisabled
          ]}
          disabled={!text.trim() || isLoading}
        >
          <ThemedText style={styles.saveButtonText}>
            {isLoading ? 'Saving...' : 'Save'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    margin: 4,
  },
  input: {
    minHeight: 40,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});