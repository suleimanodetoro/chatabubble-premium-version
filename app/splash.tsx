// app/splash.tsx
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/lib/theme/theme';
import { Heading1, Body1 } from '@/components/ui/Typography';
import { Feather } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  runOnJS,
  Easing 
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase/client';
import { useAppStore } from '@/hooks/useAppStore';
import { ProfileService } from '@/lib/services/profile';

export default function SplashScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setUser = useAppStore(state => state.setUser);
  
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  
  const logoStyle = useAnimatedStyle(() => {
    return {
      opacity: logoOpacity.value,
      transform: [
        { scale: logoScale.value }
      ]
    };
  });
  
  const textStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value
    };
  });
  
  const navigateToNextScreen = async () => {
    console.log('Determining next screen from splash...');
    
    // Check user authentication status
    const { data } = await supabase.auth.getSession();
    
    if (data.session?.user) {
      console.log('User is logged in, checking profile...');
      
      // User is authenticated, get profile
      const profile = await ProfileService.getProfile(data.session.user.id);

      // Set user data
      setUser(profile || {
        id: data.session.user.id,
        email: data.session.user.email,
        name: data.session.user.email?.split('@')[0] || ''
      });
      
      // Check if user has completed onboarding
      const hasCompletedOnboarding = await ProfileService.hasCompletedOnboarding(data.session.user.id);
      
      console.log('Onboarding status:', hasCompletedOnboarding ? 'Completed' : 'Not completed');
      
      if (hasCompletedOnboarding) {
        // Go to main app
        console.log('Going to main app from splash');
        router.replace('/(tabs)');
      } else {
        // Go to onboarding
        console.log('Going to onboarding from splash');
        router.replace('/onboarding');
      }
    } else {
      // User is not authenticated, go to login
      console.log('User not logged in, going to login');
      router.replace('/(auth)/login');
    }
  };
  
  useEffect(() => {
    // Start the animation sequence
    logoOpacity.value = withTiming(1, { duration: 1000 });
    logoScale.value = withTiming(1, { duration: 1200, easing: Easing.elastic(1.2) });
    
    // After logo animation, show the text
    textOpacity.value = withDelay(
      600, 
      withTiming(1, { duration: 800 })
    );
    
    // After animations complete, navigate to the appropriate screen
    const timer = setTimeout(() => {
      runOnJS(navigateToNextScreen)();
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={[styles.logoCircle, { backgroundColor: `${theme.colors.primary.main}20` }]}>
          <View style={[styles.logoInnerCircle, { backgroundColor: `${theme.colors.primary.main}40` }]}>
            <Feather name="message-circle" size={70} color={theme.colors.primary.main} />
          </View>
        </View>
      </Animated.View>
      
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Heading1 style={styles.appName}>ChataBubble</Heading1>
        <Body1 style={styles.tagline}>Speak languages with confidence</Body1>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInnerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    opacity: 0.8,
    textAlign: 'center',
  },
});