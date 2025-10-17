// app/(auth)/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

export default function AuthLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ title: "Login" }} />
          <Stack.Screen name="register" options={{ title: "Register" }} />
          <Stack.Screen
            name="forgot-password"
            options={{ title: "Forgot Password" }}
          />
          <Stack.Screen
            name="reset-password"
            options={{ title: "Reset Password" }}
          />
          <Stack.Screen
            name="reset-callback"
            options={{ title: "Reset Callback" }}
          />
          <Stack.Screen
            name="debug"
            options={{ title: "Debug" }}
          />
          {/* Now include your email-confirmation screen */}
          <Stack.Screen
            name="confirm"
            options={{ title: "Confirm Email" }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaView>
  );
}
