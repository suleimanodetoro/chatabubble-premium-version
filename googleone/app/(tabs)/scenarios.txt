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
  FlatList,
  Text // Added Text import
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/hooks/useAppStore";
import { Scenario, Session, ChatMessage, Language } from '@/types'; // Added Language import
import { generateId } from "@/lib/utils/ids";
import { StorageService } from "@/lib/services/storage";
import { ChatService } from "@/lib/services/chat"; // Import ChatService
import { useTheme } from "@/lib/theme/theme";
import { Heading1, Heading2, Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input"; // Assuming SearchInput exists
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInRight,
  Layout
} from 'react-native-reanimated';
import { supabase } from "@/lib/supabase/client";


// Helper components - Assuming DifficultyBadge exists and is correct
const DifficultyBadge = ({ level }: { level: 'beginner' | 'intermediate' | 'advanced' }) => {
  const theme = useTheme();
  const colors = {
    beginner: { bg: theme.colors.success.light, text: theme.colors.success.dark },
    intermediate: { bg: theme.colors.warning.light, text: theme.colors.warning.dark },
    advanced: { bg: theme.colors.error.light, text: theme.colors.error.dark }
  };
  const selectedColor = colors[level];
  return (
    <View style={[styles.difficultyBadge, { backgroundColor: selectedColor.bg }]}>
      <Caption color={selectedColor.text} weight="semibold">
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Caption>
    </View>
  );
};

export default function ScenariosScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true); // For initial load and scenario press
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const {
    scenarios,
    saveSession, // Keep saveSession for local caching after load
    source_language,
    loadScenarios,
    user
  } = useAppStore();

  // Load scenarios on mount and when user changes
  useEffect(() => {
    loadInitialData();
  }, [user?.id]); // Dependency on user.id

  const loadInitialData = async () => {
    console.log("ScenariosScreen: Loading initial data...");
    setLoading(true);
    try {
      await loadScenarios(); // Fetches scenarios from Supabase via useAppStore
      console.log("ScenariosScreen: Initial data loaded.");
    } catch (error) {
      console.error('ScenariosScreen: Error initializing scenarios screen:', error);
      Alert.alert("Error", "Could not load scenarios. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    console.log("ScenariosScreen: Refreshing scenarios...");
    setRefreshing(true);
    try {
      await loadScenarios();
      console.log("ScenariosScreen: Scenarios refreshed.");
    } catch (error) {
      console.error('ScenariosScreen: Error refreshing scenarios:', error);
      Alert.alert("Error", "Could not refresh scenarios.");
    } finally {
      setRefreshing(false);
    }
  }, [loadScenarios]); // Dependency on loadScenarios

  // --- Modified handleScenarioPress - removed loading state updates ---
  const handleScenarioPress = async (scenario: Scenario) => {
    console.log(`ScenariosScreen: Handling press for scenario: ${scenario.id} (${scenario.title})`);

    if (!user?.id) {
       Alert.alert("Authentication Error", "User not found. Please log in.");
       return;
    }
    if (!source_language || !scenario.target_language) {
      Alert.alert("Language Selection Required", `Source or target language is missing.`);
      return;
    }

    try {
      let sessionToUseId: string | null = null;
      let isNewSession = false; // Flag to know if we need to create it on the chat screen

      // 1. Check Supabase for existing, non-completed sessions
      console.log(`ScenariosScreen: Checking Supabase for existing sessions for scenario ${scenario.id}...`);
      const { data: existingSessionsData, error: fetchError } = await supabase
        .from('chat_sessions')
        .select('id, status') // Minimal select
        .eq('scenario_id', scenario.id)
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (fetchError) { throw new Error("Failed to check for existing sessions."); }

      if (existingSessionsData && existingSessionsData.length > 0) {
        const existingSessionInfo = existingSessionsData[0];
        console.log(`ScenariosScreen: Found existing session ${existingSessionInfo.id} with status ${existingSessionInfo.status}.`);
        sessionToUseId = existingSessionInfo.id;
        isNewSession = false;
      } else {
        // 3. If no existing session, generate an ID but don't create the session here.
        console.log(`ScenariosScreen: No existing active/saved session found for scenario ${scenario.id}. Will create new on chat screen load.`);
        sessionToUseId = generateId(); // Generate ID for the potential new session
        isNewSession = true;
      }

      // 4. Navigate, passing IDs
      if (sessionToUseId) {
        console.log(`ScenariosScreen: Navigating to chat screen. Session ID: ${sessionToUseId}, Scenario ID: ${scenario.id}, Is New: ${isNewSession}`);


        router.push({
          pathname: "/(chat)/[id]",
          params: {
              id: sessionToUseId, // Pass the session ID (existing or new)
              scenarioId: scenario.id, // Pass the scenario ID
              isNewSession: isNewSession.toString(), // Pass flag indicating if it's new
           },
        });
      } else {
        throw new Error("Failed to determine a session ID.");
      }

    } catch (error) {
      console.error('ScenariosScreen: Error handling scenario press:', error);
      Alert.alert('Error', `Failed to load scenario: ${(error as Error).message}`);
    }
  };

  // --- End of Modified handleScenarioPress ---


  const handleCreateScenario = () => {
    router.push("/create-scenario");
  };

  // Renders a single scenario card - minor style adjustments
  const renderScenarioItem = ({ item, index }: { item: Scenario; index: number }) => {
    const categoryColor = getCategoryColor(item.category);

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(300)} // Faster animation
        layout={Layout.springify()}
      >
        <Card
          variant="elevated"
          style={[
            styles.scenarioCard,
            { borderLeftWidth: 4, borderLeftColor: categoryColor } // Slightly thinner border
          ]}
          onPress={() => handleScenarioPress(item)} // Ensure this calls the refactored function
        >
          <CardContent style={styles.cardContentPadding}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.categoryBadgeContainer}>
                <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                  <Caption color="#fff" weight="semibold" style={styles.categoryText}>
                    {item.category}
                  </Caption>
                </View>
                <DifficultyBadge level={item.difficulty} />
              </View>
              <View style={styles.languageBadge}>
                <Feather name="globe" size={12} color={theme.colors.primary.main} />
                <Caption style={styles.languageText} color={theme.colors.primary.main}>
                  {item.target_language.name}
                </Caption>
              </View>
            </View>

            {/* Title and Description */}
            <Heading3 style={styles.scenarioTitle}>{item.title}</Heading3>
            <Body2 style={styles.scenarioDescription} numberOfLines={2} color={theme.colors.text.secondary}>
              {item.description}
            </Body2>

            {/* Persona Info */}
            <View style={styles.personaContainer}>
              <View style={[styles.personaAvatarContainer, { backgroundColor: categoryColor }]}>
                <Feather name="user" size={16} color="#fff" />
              </View>
              <View style={styles.personaInfo}>
                <Body2 weight="semibold">{item.persona.name}</Body2>
                <Caption color={theme.colors.text.secondary}>{item.persona.role}</Caption>
              </View>
            </View>

            {/* Start Button - Removed, card is pressable */}
            {/* <Button variant="primary" size="small" style={[styles.startButton, { backgroundColor: categoryColor }]}>Start Conversation</Button> */}
          </CardContent>
        </Card>
      </Animated.View>
    );
  };


  const renderEmptyState = () => {
    // Show loading indicator specifically during initial load or refresh
    if (loading && !refreshing && scenarios.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Body1 style={styles.emptyText}>Loading scenarios...</Body1>
        </View>
      );
    }
    // Show empty state if not loading and no scenarios match filter
    if (!loading && filteredScenarios.length === 0) {
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
               : "No scenarios available yet. Pull down to refresh or create one!"}
           </Body1>
           <Button
             variant="primary"
             onPress={handleCreateScenario}
             style={styles.createButton}
             icon="plus"
           >
             Create New Scenario
           </Button>
         </View>
       );
    }
    return null; // Return null if list has items or is loading more
  };

  // Filter scenarios based on search query
  const filteredScenarios = scenarios.filter(
    (scenario) => {
      const query = searchQuery.toLowerCase();
      return scenario.title.toLowerCase().includes(query) ||
             scenario.description.toLowerCase().includes(query) ||
             scenario.category.toLowerCase().includes(query) ||
             scenario.target_language.name.toLowerCase().includes(query);
    }
  );

  // Get category color helper
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
        {/* Header */}
        <View style={styles.header}>
          <Heading1 style={styles.headerTitle}>Language Scenarios</Heading1>
          <Body1 style={styles.headerSubtitle}>
            Choose a scenario to practice your conversation skills
          </Body1>
        </View>

        {/* Search and Create Button */}
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

        {/* Loading Indicator for Scenario Press */}
        {loading && !refreshing && (
            <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.colors.primary.main} />
            </View>
        )}

        {/* Scenarios List */}
        <FlatList
          data={filteredScenarios}
          renderItem={renderScenarioItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState} // Handles loading and empty states
          initialNumToRender={7}
          maxToRenderPerBatch={10}
          windowSize={11}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary.main]}
              tintColor={theme.colors.primary.main}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />} // Spacing between cards
        />
      </View>
    </SafeAreaView>
  );
}

// Styles - Adjusted slightly for clarity and appearance
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Lighter background
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20, // More padding
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', // Subtle separator
    backgroundColor: '#fff',
  },
  headerTitle: {
    marginBottom: 4,
  },
  headerSubtitle: {
    opacity: 0.7,
    fontSize: 15,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff', // Match header background
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  createScenarioButton: {
    // Style adjustments if needed
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, // Cover the screen
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Semi-transparent white
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure it's above the list
  },
  scenarioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12, // More rounded corners
    borderWidth: 1,
    borderColor: '#E5E7EB', // Subtle border
    overflow: 'hidden', // Ensure content respects border radius
    // Shadow adjustments
    shadowColor: "#9CA3AF", // Lighter shadow color
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
   cardContentPadding: {
     padding: 16, // Consistent padding
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
    fontWeight: '600',
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
    backgroundColor: '#E0E7FF', // Light background for language
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  languageText: {
    marginLeft: 2,
    fontWeight: '500',
  },
  scenarioTitle: {
    marginBottom: 6,
    fontSize: 18, // Slightly larger title
  },
  scenarioDescription: {
    marginBottom: 16,
    minHeight: 38, // Ensure space for 2 lines
    fontSize: 14,
    lineHeight: 19,
  },
  personaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // Removed bottom margin, handled by overall padding
  },
  personaAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  personaInfo: {
    flex: 1,
  },
  // Removed startButton styles as button is removed
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 50, // Add some top margin
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
    fontSize: 16,
  },
  createButton: {
    minWidth: 200,
  },
  listContent: {
    padding: 20, // Consistent padding
    paddingTop: 8,
    flexGrow: 1, // Ensure it grows to fill space for empty state
  },
});