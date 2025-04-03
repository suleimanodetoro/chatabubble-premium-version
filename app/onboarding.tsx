// app/onboarding.tsx
import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text,
  FlatList, 
  useWindowDimensions, 
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/theme';
import { Heading1, Heading2, Body1 } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '@/hooks/useAppStore';
import { ProfileService } from '@/lib/services/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

// Define the onboarding steps
const onboardingSteps = [
  {
    id: '1',
    title: 'Welcome to ChataBubble',
    description: 'Your language learning companion for real-world conversations.',
    icon: 'message-circle'
  },
  {
    id: '2',
    title: 'Practice Scenarios',
    description: 'Engage in realistic conversations with our AI language partners.',
    icon: 'users'
  },
  {
    id: '3',
    title: 'Learn at Your Pace',
    description: 'Track your progress and improve your language skills over time.',
    icon: 'trending-up'
  },
  {
    id: '4',
    title: 'Ready to Start?',
    description: 'Begin your language learning journey with confidence.',
    icon: 'check-circle'
  }
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore(state => state.user);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const progressValue = useSharedValue(0.25);
  
  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressValue.value * 100}%`
    };
  });
  
  const handleNext = () => {
    if (currentIndex >= onboardingSteps.length - 1) {
      completeOnboarding();
      return;
    }
    
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    progressValue.value = withTiming((nextIndex + 1) / onboardingSteps.length);
  };
  
  const handleSkip = () => {
    completeOnboarding();
  };
  
  const handleBack = () => {
    if (currentIndex <= 0) return;
    
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    progressValue.value = withTiming((prevIndex + 1) / onboardingSteps.length);
  };
  
  const completeOnboarding = async () => {
    try {
      console.log('Completing onboarding...');
      
      if (user?.id) {
        console.log('Saving onboarding completion for user:', user.id);
        
        // Mark onboarding as completed in AsyncStorage for immediate effect
        await AsyncStorage.setItem(`@onboarding_completed:${user.id}`, 'true');
        
        // Also update the user's profile settings for persistence
        const profile = await ProfileService.getProfile(user.id);
        const currentSettings = profile?.settings || {};
        
        await ProfileService.updateProfile(user.id, {
          settings: {
            ...currentSettings,
            hasCompletedOnboarding: true
          }
        });
        
        console.log('Onboarding completion saved successfully');
      } else {
        console.warn('No user ID available, cannot save onboarding status');
      }
      
      // Navigate to the main app
      console.log('Navigating to tabs after onboarding completion');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still navigate even if there was an error saving
      router.replace('/(tabs)');
    }
  };
  
  const renderOnboardingItem = ({ item, index }: { item: typeof onboardingSteps[0], index: number }) => {
    return (
      <View style={[styles.slide, { width }]}>
        <Animated.View 
          style={styles.iconContainer}
          entering={index % 2 === 0 ? FadeInLeft.delay(300) : FadeInRight.delay(300)}
        >
          <View style={[
            styles.iconCircle, 
            { backgroundColor: `${theme.colors.primary.main}20` }
          ]}>
            <Feather name={item.icon as any} size={50} color={theme.colors.primary.main} />
          </View>
        </Animated.View>
        
        <Animated.View 
          style={styles.textContainer}
          entering={FadeIn.delay(500)}
        >
          <Heading1 style={styles.title}>{item.title}</Heading1>
          <Body1 style={styles.description}>{item.description}</Body1>
        </Animated.View>
      </View>
    );
  };
  
  const isLastStep = currentIndex === onboardingSteps.length - 1;
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressIndicator, 
              { backgroundColor: theme.colors.primary.main },
              progressStyle
            ]} 
          />
        </View>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={onboardingSteps}
        renderItem={renderOnboardingItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
      />
      
      <View style={styles.buttonsContainer}>
        {currentIndex > 0 ? (
          <Button
            variant="tertiary"
            icon="arrow-left"
            onPress={handleBack}
            style={styles.backButton}
          >
            Back
          </Button>
        ) : (
          <Button
            variant="tertiary"
            onPress={handleSkip}
            style={styles.skipButton}
          >
            Skip
          </Button>
        )}
        
        <Button
          variant="primary"
          size="large"
          onPress={handleNext}
          icon={isLastStep ? undefined : "arrow-right"}
          iconPosition="right"
          style={styles.nextButton}
        >
          {isLastStep ? "Get Started" : "Next"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 3,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    opacity: 0.8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    minWidth: 100,
  },
  skipButton: {
    minWidth: 100,
  },
  nextButton: {
    minWidth: 140,
  },
});