// app/(tabs)/index.tsx
import { StyleSheet, Pressable, ScrollView } from "react-native";
import { Link } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ThemedView } from "../../components/ThemedView";
import { ThemedText } from "../../components/ThemedText";
import { HelloWave } from "../../components/HelloWave";
import { useAppStore } from "../../hooks/useAppStore";
import { Session } from "../../types";
import { SafeAreaView } from 'react-native-safe-area-context';


export default function HomeScreen() {
  const user = useAppStore((state) => state.user);

  // Placeholder recent sessions - replace with actual data later
  const recentSessions: Session[] = [];

  const renderWelcomeSection = () => (
    <ThemedView style={styles.welcomeSection} useSafeArea>
      <HelloWave />
      <ThemedText style={styles.welcomeText}>
        Welcome{user?.name ? `, ${user.name}` : ""}!
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Ready to practice your language skills?
      </ThemedText>
      <Link href="/(tabs)/scenarios" asChild>
        <Pressable>
          <ThemedView style={styles.startButton}>
            <ThemedText style={styles.startButtonText}>
              Start New Conversation
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>
    </ThemedView>
  );

  const renderQuickStats = () => (
    <ThemedView style={styles.statsContainer}>
      <ThemedView style={styles.statCard}>
        <ThemedText style={styles.statNumber}>0</ThemedText>
        <ThemedText style={styles.statLabel}>Conversations</ThemedText>
      </ThemedView>
      <ThemedView style={styles.statCard}>
        <ThemedText style={styles.statNumber}>0</ThemedText>
        <ThemedText style={styles.statLabel}>Minutes Practiced</ThemedText>
      </ThemedView>
      <ThemedView style={styles.statCard}>
        <ThemedText style={styles.statNumber}>0</ThemedText>
        <ThemedText style={styles.statLabel}>Languages</ThemedText>
      </ThemedView>
    </ThemedView>
  );

  const renderRecentSection = () => (
    <ThemedView style={styles.recentSection}>
      <ThemedText style={styles.sectionTitle}>Recent Conversations</ThemedText>
      {recentSessions.length > 0 ? (
        <FlashList
          data={recentSessions}
          estimatedItemSize={100}
          renderItem={({ item }) => (
            <Link href="/(tabs)/scenarios" asChild>
              <Pressable>
                <ThemedView style={styles.sessionCard}>
                  <ThemedText style={styles.sessionTitle}>
                    {item.targetLanguage.name} Practice
                  </ThemedText>
                  <ThemedText style={styles.sessionDate}>
                    {new Date(item.startTime).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />
      ) : (
        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>
            No recent conversations. Start one now!
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderWelcomeSection()}
        {renderQuickStats()}
        {renderRecentSection()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // Explicit background color
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20, // Adds some padding at the bottom for better scrolling
  },
  welcomeSection: {
    padding: 20,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginTop: 5,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
    margin: 5,
    padding: 10,
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    textAlign: "center",
  },
  recentSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  sessionCard: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  sessionDate: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  emptyState: {
    padding: 30,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
});
