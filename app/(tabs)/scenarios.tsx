// app/(tabs)/scenarios.tsx
import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ThemedView } from "../../components/ThemedView";
import { ThemedText } from "../../components/ThemedText";
import { Collapsible } from "../../components/Collapsible";
import { useAppStore } from "../../hooks/useAppStore";
import { Scenario } from "../../types";

// Placeholder scenarios - replace with actual data later
const SCENARIOS: Scenario[] = [
  {
    id: "1",
    title: "Shopping at a Clothing Store",
    description:
      "Practice buying clothes and discussing sizes, colors, and styles.",
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
    description:
      "Learn how to order food, ask about ingredients, and make special requests.",
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
  const setCurrentScenario = useAppStore((state) => state.setCurrentScenario);

  const filteredScenarios = SCENARIOS.filter(
    (scenario) =>
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleScenarioPress = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    router.push({
      pathname: "/(chat)/[id]",
      params: { id: scenario.id },
    });
  };

  const renderScenarioCard = ({ item: scenario }: { item: Scenario }) => (
    <ThemedView
      style={styles.scenarioCard}
      onTouchEnd={() => handleScenarioPress(scenario)}
    >
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
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search scenarios..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </ThemedView>

      <FlashList
        data={filteredScenarios}
        renderItem={renderScenarioCard}
        estimatedItemSize={200}
        contentContainerStyle={styles.listContainer}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  scenarioCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  scenarioTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  scenarioDescription: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.9,
  },
});
