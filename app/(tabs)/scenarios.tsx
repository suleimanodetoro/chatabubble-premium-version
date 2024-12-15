// app/(tabs)/scenarios.tsx
import { useState, useEffect } from "react";
import { StyleSheet, TextInput, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ThemedView } from "../../components/ThemedView";
import { ThemedText } from "../../components/ThemedText";
import { Collapsible } from "../../components/Collapsible";
import { useAppStore } from "../../hooks/useAppStore";
import { Scenario, Session } from "../../types";
import { generateId } from "@/lib/utils/ids";
import { StorageService } from "@/lib/services/storage";


export default function ScenariosScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    scenarios,
    setCurrentScenario,
    setCurrentSession,
    saveSession,
    sourceLanguage,
    loadScenarios,
    user,  
  } = useAppStore();

  // Simply call loadScenarios from useAppStore
  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

 


  const clearStorage = async () => {
    try {
      await StorageService.clearAll();
      Alert.alert('Success', 'Storage cleared');
    } catch (error) {
      console.error('Error clearing storage:', error);
      Alert.alert('Error', 'Failed to clear storage');
    }
  };

  const handleScenarioPress = async (scenario: Scenario) => {
    console.log('Pressing scenario:', scenario);
    
    if (!sourceLanguage || !scenario.targetLanguage) {
      console.log('Missing languages:', { sourceLanguage, targetLanguage: scenario.targetLanguage });
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
          targetLanguage: scenario.targetLanguage,
          sourceLanguage,
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

  const filteredScenarios = scenarios.filter(
    (scenario) =>
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderScenarioCard = ({ item: scenario }: { item: Scenario }) => (
    <Pressable onPress={() => handleScenarioPress(scenario)}>
      <ThemedView style={styles.scenarioCard}>
        <ThemedView style={styles.categoryBadge}>
          <ThemedText style={styles.categoryText}>
            {scenario.category}
          </ThemedText>
        </ThemedView>

        <ThemedText style={styles.scenarioTitle}>{scenario.title}</ThemedText>
        <ThemedText style={styles.scenarioDescription}>
          {scenario.description}
        </ThemedText>

        <Collapsible title="Scenario Details">
          <ThemedView style={styles.detailsContainer}>
            <ThemedView style={styles.personaContainer}>
              <ThemedView style={styles.personaInfo}>
                <ThemedText style={styles.personaName}>
                  {scenario.persona.name}
                </ThemedText>
                <ThemedText style={styles.personaRole}>
                  ({scenario.persona.role})
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.languageStyleBadge}>
                <ThemedText style={styles.languageStyleText}>
                  {scenario.persona.languageStyle}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <ThemedText style={styles.detailText}>
              Personality: {scenario.persona.personality}
            </ThemedText>

            <ThemedText style={styles.difficultyText}>
              Level: {scenario.difficulty}
            </ThemedText>

            {scenario.targetLanguage && (
              <ThemedText style={styles.detailText}>
                Language: {scenario.targetLanguage.name}
              </ThemedText>
            )}
          </ThemedView>
        </Collapsible>
      </ThemedView>
    </Pressable>
  );

  return (
    
    <ThemedView useSafeArea style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.headerTitle}>Language Scenarios</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Choose a scenario to start practicing or create your own
        </ThemedText>
      </ThemedView>
      
{/* <ThemedView style={styles.searchContainer}>
  <TextInput
    style={styles.searchInput}
    placeholder="Search scenarios..."
    value={searchQuery}
    onChangeText={setSearchQuery}
    placeholderTextColor="#666"
  />
  <Pressable onPress={handleCreateScenario} style={styles.createButton}>
    <ThemedText style={styles.createButtonText}>Create New</ThemedText>
  </Pressable>
  {__DEV__ && (
    <Pressable onPress={clearStorage} style={styles.createButton}>
      <ThemedText style={styles.createButtonText}>Clear Storage</ThemedText>
    </Pressable>
  )}
</ThemedView> */}


      <ThemedView style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search scenarios..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
        <Pressable onPress={handleCreateScenario} style={styles.createButton}>
          <ThemedText style={styles.createButtonText}>Create New</ThemedText>
        </Pressable>
      </ThemedView>

      <FlashList
        data={filteredScenarios}
        renderItem={renderScenarioCard}
        estimatedItemSize={200}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyStateText}>
              {searchQuery
                ? "No scenarios match your search"
                : "No scenarios available. Create one to get started!"}
            </ThemedText>
          </ThemedView>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  searchContainer: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#f5f5f5",
  },
  createButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listContainer: {
    padding: 16,
  },
  scenarioCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#f8f9fa",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scenarioTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1a1a1a",
  },
  scenarioDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    lineHeight: 20,
  },
  detailsContainer: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 6,
    color: "#4a4a4a",
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
    color: "#666",
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#e9ecef",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    color: "#495057",
    textTransform: "capitalize",
  },
  difficultyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  difficultyText: {
    fontSize: 12,
    color: "#6c757d",
    marginLeft: 4,
    textTransform: "capitalize",
  },
  personaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dee2e6",
  },
  personaInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  personaName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#212529",
  },
  personaRole: {
    fontSize: 12,
    color: "#6c757d",
    marginLeft: 4,
  },
  languageStyleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#e2e3e5",
  },
  languageStyleText: {
    fontSize: 12,
    color: "#383d41",
    textTransform: "capitalize",
  },
});
