// app/(auth)/forgot-password.tsx
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

export default function ForgotPasswordScreen() {
  return (
    <View style={styles.container}>
      <ThemedText>Forgot Password Screen</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});