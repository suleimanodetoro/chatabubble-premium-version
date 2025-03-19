// app/(tabs)/scenarios.tsx
import React, { useState, useEffect, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  Alert, 
  Pressable, 
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/hooks/useAppStore";
import { Scenario, Session, ChatMessage } from '@/types';
import { generateId } from "@/lib/utils/ids";
import { StorageService } from "@/lib/services/storage";
import { useTheme } from "@/lib/theme/theme";
import { Heading1, Heading2, Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeInRight,
  Layout
} from 'react-native-reanimated';

// Helper components
const DifficultyBadge = ({ level }: { level: 'beginner' | 'intermediate' | 'advanced' }) => {
  const theme = useTheme();
  
  const colors = {
    beginner: {
      bg: theme.colors.success.light,
      text: theme.colors.success.dark
    },
    intermediate: {
      bg: theme.colors.warning.light,
      text: theme.colors.warning.dark
    },
    advanced: {
      bg: theme.colors.error.light,
      text: theme.colors.error.dark
    }
  };
  
  const selectedColor = colors[level];
  
  return (
    <View 
      style={[
        styles.difficultyBadge, 
        { backgroundColor: selectedColor.bg }
      ]}
    >
      <Caption color={selectedColor.text} weight="semibold">
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Caption>
    </View>
  );
};

// Category selector for scenario filtering
const CategorySelector = ({ 
  selectedCategory, 
  onSelectCategory 
}: { 
  selectedCategory: string; 
  onSelectCategory: (category: string) => void;
}) => {
  const theme = useTheme();
  const categories = ['All', 'Shopping', 'Dining', 'Travel', 'Business', 'Casual'];
  
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryList}
    >
      {categories.map((category, index) => {
        const isSelected = selectedCategory === category.toLowerCase();
        return (
          <Pressable
            key={category}
            style={[
              styles.categoryChip,
              isSelected && { 
                backgroundColor: theme.colors.primary.main 
              }
            ]}
            onPress={() => onSelectCategory(
              category === 'All' ? '' : category.toLowerCase()
            )}
          >
            <Body2 
              color={isSelected ? theme.colors.primary.contrast : theme.colors.text.primary}
              weight={isSelected ? "semibold" : "regular"}
            >
              {category}
            </Body2>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default function ScenariosScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();
  
  const {
    scenarios,
    setCurrentScenario,
    setCurrentSession,
    saveSession,
    source_language,
    loadScenarios,
    user
  } = useAppStore();

  // Load scenarios
  useEffect(() => {
    loadInitialData();
  }, [user?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await loadScenarios();
    } catch (error) {
      console.error('Error initializing scenarios screen:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadScenarios();
    } catch (error) {
      console.error('Error refreshing scenarios:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadScenarios]);

  const handleScenarioPress = async (scenario: Scenario) => {
    console.log('Pressing scenario:', scenario);
    
    if (!source_language || !scenario.target_language) {
      console.log('Missing languages:', { source_language, target_language: scenario.target_language });
      Alert.alert(
        "Language Selection Required",
        "This scenario doesn't have a target language set"
      );
      return;
    }
  
    try {
      // First, check for existing active sessions for this scenario
      const existingSessions = Object.values(useAppStore.getState().activeSessions)
        .filter(session => 
          session.scenarioId === scenario.id && 
          session.status !== 'completed'
        );
  
      let sessionToUse: Session;
      let messages: ChatMessage[] = [];
  
      if (existingSessions.length > 0) {
        // Use the most recent session but update the userId
        sessionToUse = existingSessions.sort((a, b) => b.lastUpdated - a.lastUpdated)[0];
        console.log('Using existing session:', sessionToUse.id);
        
        // Load messages for existing session
        messages = await StorageService.loadChatHistory(sessionToUse.id);
        console.log('Loaded existing messages:', messages.length);
        
        sessionToUse = {
          ...sessionToUse,
          messages,
          lastUpdated: Date.now(),
          userId: user?.id || 'guest' // Update the userId here
        };
      } else {
        // Create new session only if no existing one found
        const sessionId = generateId();
        console.log('Creating new session:', sessionId);
        
        sessionToUse = {
          id: sessionId,
          userId: user?.id || 'guest',
          scenarioId: scenario.id,
          target_language: scenario.target_language,
          source_language,
          messages: [],
          startTime: Date.now(),
          lastUpdated: Date.now(),
          scenario: scenario,
          status: 'active'
        };
      }
  
      // Add debug log
      console.log('Session user state:', {
        sessionUserId: sessionToUse.userId,
        currentUser: user?.id,
        isLoggedIn: !!user
      });
  
      setCurrentScenario(scenario);
      setCurrentSession(sessionToUse);
      await saveSession(sessionToUse);
  
      router.push({
        pathname: "/(chat)/[id]",
        params: { id: sessionToUse.id },
      });
    } catch (error) {
      console.error('Error handling scenario press:', error);
      Alert.alert('Error', 'Failed to load scenario');
    }
  };

  const handleCreateScenario = () => {
    router.push("/create-scenario");
  };

  const renderScenarioItem = ({ item, index }: { item: Scenario; index: number }) => {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).springify()}
        layout={Layout.springify()}
      >
        <Card
          variant="elevated"
          style={styles.scenarioCard}
          onPress={() => handleScenarioPress(item)}
        >
          <CardContent>
            <View style={styles.cardHeader}>
              <View style={styles.categoryBadgeContainer}>
                <View style={[
                  styles.categoryBadge,
                  { backgroundColor: getCategoryColor(item.category) }
                ]}>
                  <Caption color="#fff" weight="semibold" style={styles.categoryText}>
                    {item.category}
                  </Caption>
                </View>
                <DifficultyBadge level={item.difficulty} />
              </View>
              <View style={styles.languageBadge}>
                <Feather name="globe" size={12} color={theme.colors.primary.main} />
                <Caption 
                  style={styles.languageText}
                  color={theme.colors.primary.main}
                >
                  {item.target_language.name}
                </Caption>
              </View>
            </View>
            
            <Heading3 style={styles.scenarioTitle}>
              {item.title}
            </Heading3>
            
            <Body2 
              style={styles.scenarioDescription}
              numberOfLines={2}
              color={theme.colors.text.secondary}
            >
              {item.description}
            </Body2>
            
            <View style={styles.personaContainer}>
              <View style={styles.personaAvatarContainer}>
                <Feather name="user" size={16} color="#fff" />
              </View>
              <View style={styles.personaInfo}>
                <Body2 weight="semibold">{item.persona.name}</Body2>
                <Caption>{item.persona.role}</Caption>
              </View>
            </View>
            
            <Button
              variant="primary"
              size="small"
              style={styles.startButton}
            >
              Start Conversation
            </Button>
          </CardContent>
        </Card>
      </Animated.View>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Body1 style={styles.emptyText}>Loading scenarios...</Body1>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <Feather 
          name={searchQuery ? "search" : "book-open"} 
          size={50} 
          color={theme.colors.text.hint}
          style={styles.emptyIcon}
        />
        <Body1 style={styles.emptyText}>
          {searchQuery
            ? "No scenarios match your search"
            : "No scenarios available. Create one to get started!"}
        </Body1>
        <Button
          variant="primary"
          onPress={handleCreateScenario}
          style={styles.createButton}
        >
          Create New Scenario
        </Button>
      </View>
    );
  };

  // Filter scenarios based on search and category
  const filteredScenarios = scenarios.filter(
    (scenario) => {
      const matchesSearch = 
        scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scenario.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory 
        ? scenario.category === selectedCategory 
        : true;
      
      return matchesSearch && matchesCategory;
    }
  );

  // Get category color
  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      'shopping': theme.colors.success.main,
      'dining': theme.colors.warning.main,
      'travel': theme.colors.info.main,
      'business': theme.colors.primary.dark,
      'casual': theme.colors.secondary.main,
    };
    
    return categoryColors[category] || theme.colors.primary.main;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Heading1 style={styles.headerTitle}>Language Scenarios</Heading1>
          <Body1 style={styles.headerSubtitle}>
            Choose a scenario to practice your conversation skills
          </Body1>
        </View>
  
        <View style={styles.searchContainer}>
          <SearchInput
            placeholder="Search scenarios..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={styles.searchInputContainer}
          />
          <Button
            variant="primary"
            icon="plus"
            onPress={handleCreateScenario}
            style={styles.createScenarioButton}
          >
            Create
          </Button>
        </View>
        
        <CategorySelector 
          selectedCategory={selectedCategory || 'All'} 
          onSelectCategory={setSelectedCategory}
        />
  
        <FlatList
          data={filteredScenarios}
          renderItem={renderScenarioItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary.main]}
              tintColor={theme.colors.primary.main}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    marginBottom: 4,
  },
  headerSubtitle: {
    opacity: 0.7,
  },
  searchContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  createScenarioButton: {
    minWidth: 100,
  },
  scenarioCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    textTransform: 'capitalize',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageText: {
    marginLeft: 2,
  },
  scenarioTitle: {
    marginBottom: 8,
  },
  scenarioDescription: {
    marginBottom: 16,
    height: 40, // Fixed height for 2 lines
  },
  personaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  personaAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A6FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  personaInfo: {
    flex: 1,
  },
  startButton: {
    alignSelf: 'flex-start',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  createButton: {
    minWidth: 200,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F2F2F7',
  },
  selectedChip: {
    backgroundColor: '#4A6FFF',
  },
});