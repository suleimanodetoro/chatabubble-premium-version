// app/(tabs)/scenarios.tsx
import { useState } from "react";
import { StyleSheet, TextInput, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ThemedView } from "../../components/ThemedView";
import { ThemedText } from "../../components/ThemedText";
import { Collapsible } from "../../components/Collapsible";
import { useAppStore } from "../../hooks/useAppStore";
import { Scenario, Session } from "../../types";
import { SafeAreaView } from "react-native-safe-area-context";

// First, let's make sure SCENARIOS matches your Scenario type exactly
const SCENARIOS: Scenario[] = [
  {
    id: "1",
    title: "Shopping at a Clothing Store",
    description: "Practice buying clothes and discussing sizes, colors, and styles.",
    category: "shopping",
    difficulty: "beginner",
    persona: {
      name: "Maria",
      role: "Shop Assistant",
      personality: "Friendly and helpful",
      languageStyle: "casual",
    },
  },
  {
    id: "2",
    title: "Ordering at a Restaurant",
    description: "Learn how to order food, ask about ingredients, and make special requests.",
    category: "dining",
    difficulty: "beginner",
    persona: {
      name: "Jean",
      role: "Waiter",
      personality: "Professional and attentive",
      languageStyle: "formal",
    },
  },
];

export default function ScenariosScreen() {
    const [searchQuery, setSearchQuery] = useState("");
    const { setCurrentScenario, setCurrentSession, sourceLanguage, targetLanguage } = useAppStore();
  
    const handleScenarioPress = (scenario: Scenario) => {
      // Ensure we have languages set
      if (!sourceLanguage || !targetLanguage) {
        Alert.alert(
          'Language Selection Required',
          'Please set your languages in the profile tab first.'
        );
        return;
      }
  
      const sessionId = `${scenario.id}-${Date.now()}`;
      
      const newSession: Session = {
        id: sessionId,
        userId: 'guest',
        scenarioId: scenario.id,
        targetLanguage,
        sourceLanguage,
        messages: [],
        startTime: Date.now(),
        lastUpdated: Date.now()
      };
  
      setCurrentScenario(scenario);
      setCurrentSession(newSession);
  
      router.push({
        pathname: "/(chat)/[id]",
        params: { id: sessionId }
      });
    };
    const handleCreateScenario = () => {
        // TODO: Implement scenario creation
        router.push("/create-scenario"); // You'll need to create this route
      };
    
      const filteredScenarios = SCENARIOS.filter(
        (scenario) =>
          scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          scenario.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
      const renderScenarioCard = ({ item: scenario }: { item: Scenario }) => (
        <Pressable onPress={() => handleScenarioPress(scenario)}>
          <ThemedView style={styles.scenarioCard}>
            <ThemedText style={styles.scenarioTitle}>{scenario.title}</ThemedText>
            <ThemedText style={styles.scenarioDescription}>
              {scenario.description}
            </ThemedText>
    
            <Collapsible title="Scenario Details">
              <ThemedView style={styles.detailsContainer}>
                <ThemedText style={styles.detailText}>
                  Category: {scenario.category}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  Difficulty: {scenario.difficulty}
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  Persona: {scenario.persona.name} ({scenario.persona.role})
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  Language Style: {scenario.persona.languageStyle}
                </ThemedText>
              </ThemedView>
            </Collapsible>
          </ThemedView>
        </Pressable>
      );
    
      return (
        <ThemedView style={styles.container} useSafeArea>
          <ThemedView style={styles.header}>
            <ThemedText style={styles.headerTitle}>Language Scenarios</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              Choose a scenario to start practicing or create your own
            </ThemedText>
          </ThemedView>
    
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
            contentContainerStyle={styles.listContainer}
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
          borderBottomColor: '#ccc',
        },
        headerTitle: {
          fontSize: 24,
          fontWeight: 'bold',
          marginBottom: 8,
        },
        headerSubtitle: {
          fontSize: 16,
          opacity: 0.7,
        },
        searchContainer: {
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        searchInput: {
          flex: 1,
          height: 40,
          borderRadius: 20,
          paddingHorizontal: 16,
          fontSize: 16,
          backgroundColor: '#f5f5f5',
        },
        createButton: {
          backgroundColor: '#007AFF',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
        },
        createButtonText: {
          color: '#fff',
          fontWeight: '600',
        },
        listContainer: {
          padding: 16,
        },
        scenarioCard: {
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
          backgroundColor: '#f8f9fa',
          shadowColor: '#000',
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
          fontWeight: '600',
          marginBottom: 8,
          color: '#1a1a1a',
        },
        scenarioDescription: {
          fontSize: 14,
          color: '#666',
          marginBottom: 16,
          lineHeight: 20,
        },
        detailsContainer: {
          backgroundColor: '#fff',
          padding: 12,
          borderRadius: 8,
          marginTop: 8,
        },
        detailText: {
          fontSize: 14,
          marginBottom: 6,
          color: '#4a4a4a',
        },
        emptyState: {
          padding: 32,
          alignItems: 'center',
        },
        emptyStateText: {
          fontSize: 16,
          opacity: 0.7,
          textAlign: 'center',
          color: '#666',
        },
        categoryBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: '#e9ecef',
          alignSelf: 'flex-start',
          marginBottom: 8,
        },
        categoryText: {
          fontSize: 12,
          color: '#495057',
          textTransform: 'capitalize',
        },
        difficultyIndicator: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
        },
        difficultyText: {
          fontSize: 12,
          color: '#6c757d',
          marginLeft: 4,
          textTransform: 'capitalize',
        },
        personaContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#dee2e6',
        },
        personaInfo: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        personaName: {
          fontSize: 14,
          fontWeight: '500',
          color: '#212529',
        },
        personaRole: {
          fontSize: 12,
          color: '#6c757d',
          marginLeft: 4,
        },
        languageStyleBadge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
          backgroundColor: '#e2e3e5',
        },
        languageStyleText: {
          fontSize: 12,
          color: '#383d41',
          textTransform: 'capitalize',
        },
      });