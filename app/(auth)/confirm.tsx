// app/(auth)/confirm.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Text as RNText } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { Heading2, Body1 } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button'; // Assuming you have a Button component
import { useTheme } from '@/lib/theme/theme';
import { Feather } from '@expo/vector-icons'; // For an icon

export default function EmailConfirmScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log("EmailConfirmScreen: Mounted. Params:", params);
    // Check for errors passed directly in the URL parameters.
    const error = params.error as string;
    const errorCode = params.error_code as string;
    const errorDescription = params.error_description as string;

    if (error || errorCode) {
        const errorMessage = (errorDescription?.replace(/\+/g, ' ') || "Invalid or expired confirmation link.").trim();
        console.error(`EmailConfirmScreen: Error in deep link params - Code: ${errorCode || error}, Desc: ${errorMessage}`);
        // Show an alert and then navigate to login. The screen will primarily show the success message.
        Alert.alert("Link Error", `${errorMessage} Please try logging in or request a new link if issues persist.`, [
            { text: "Go to Login", onPress: () => router.replace('/(auth)/login') }
        ]);
    }
  }, [params, router]);

  const handleProceedToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <>
      <Stack.Screen options={{ title: "Email Verified" }} />
      <ThemedView style={styles.container} useSafeArea>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Feather name="check-circle" size={64} color={theme.colors.success.main} />
          </View>
          <Heading2 style={styles.title}>Email Successfully Verified!</Heading2>
          <Body1 style={styles.message}>
            Your email address has been successfully verified. You can now proceed to log in to your account.
          </Body1>
          <Button
            variant="primary"
            size="large"
            onPress={handleProceedToLogin}
            style={styles.loginButton}
          >
            Proceed to Login
          </Button>
        </View>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    width: '90%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    color: '#4B5563',
  },
  loginButton: {
    width: '100%', // Make button full width of its container
  },
});
