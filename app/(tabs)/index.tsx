// app/(tabs)/index.tsx
import { StyleSheet, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { HelloWave } from "@/components/HelloWave";
import { useAppStore } from "@/hooks/useAppStore";
import { Session } from "@/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { MetricsService } from "@/lib/services/metrics";

// Add proper typing for metrics
interface UserMetrics {
  totalSessions: number;
  completedSessions: number;
  totalMinutesPracticed: number;
  activeLanguages: number;
  languageProgress: Record<
    string,
    {
      sessionsCompleted: number;
      totalDuration: number;
      lastPracticed: string;
      level: "beginner" | "intermediate" | "advanced";
      recentSessions: Session[];
    }
  >;
  recentSessions: Session[];
  streak: number;
  lastPracticed: string | null;
}

export default function HomeScreen() {
  const user = useAppStore((state) => state.user);
  const router = useRouter();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [user?.id]);

  const loadMetrics = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const userMetrics = await MetricsService.getUserMetrics(user.id);
      console.log("Loaded metrics:", userMetrics); // Debug log
      setMetrics(userMetrics);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const renderWelcomeSection = () => (
    <ThemedView style={styles.welcomeSection}>
      <HelloWave />
      <View style={styles.welcomeHeader}>
        <ThemedText style={styles.welcomeText}>
          Welcome back{user?.name ? `, ${user.name}` : ""}!
        </ThemedText>
        {(metrics?.streak ?? 0) > 0 && (
          <ThemedText style={styles.streakText}>
            🔥 {metrics?.streak} day streak
          </ThemedText>
        )}
      </View>
      <Pressable
        style={styles.startButton}
        onPress={() => router.push("/(tabs)/scenarios")}
      >
        <ThemedText style={styles.startButtonText}>
          Start New Conversation
        </ThemedText>
      </Pressable>
    </ThemedView>
  );

  const renderQuickStats = () => (
    <ThemedView style={styles.statsContainer}>
      <ThemedView style={styles.statCard}>
        <ThemedText style={styles.statNumber}>
          {isLoading ? "..." : metrics?.totalSessions || 0}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Total Chats</ThemedText>
      </ThemedView>
      <ThemedView style={styles.statCard}>
        <ThemedText style={styles.statNumber}>
          {isLoading ? "..." : Math.round(metrics?.totalMinutesPracticed || 0)}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Minutes</ThemedText>
      </ThemedView>
      <ThemedView style={styles.statCard}>
        <ThemedText style={styles.statNumber}>
          {isLoading
            ? "..."
            : Object.keys(metrics?.languageProgress || {}).length}
        </ThemedText>
        <ThemedText style={styles.statLabel}>Languages</ThemedText>
      </ThemedView>
    </ThemedView>
  );

  // In renderRecentSection:
  const renderRecentSection = () => {
    const recentSessions = metrics?.recentSessions || [];

    return (
      <ThemedView style={styles.recentSection}>
        <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
        {recentSessions.length > 0 ? (
          <View>
            {recentSessions.map((session) => {
              // Check if the session has the required data
              if (!session?.target_language?.name) {
                console.warn("Session missing target language:", session);
                return null;
              }

              return (
                <Pressable
                  key={session.id}
                  onPress={() => router.push(`/(chat)/${session.id}`)}
                  style={({ pressed }) => [
                    styles.sessionCard,
                    pressed && styles.sessionCardPressed,
                  ]}
                >
                  <View style={styles.sessionHeader}>
                    <ThemedText style={styles.sessionTitle} numberOfLines={1}>
                      {session.scenario?.title || "Practice Session"}
                    </ThemedText>
                    <ThemedText style={styles.sessionLanguage}>
                      {session.target_language.name}
                    </ThemedText>
                  </View>
                  <View style={styles.sessionInfo}>
                    <ThemedText style={styles.sessionDate}>
                      {new Date(session.startTime).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText style={styles.sessionMetrics}>
                      {session.messages?.length || 0} messages •
                      {Math.round((session.metrics?.duration || 0) / 60000)}m
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyStateText}>
              No conversations yet. Start practicing!
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>
    );
  };
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
    backgroundColor: "#fff",
  },
  contentContainer: {
    flexGrow: 1,
  },
  welcomeSection: {
    padding: 20,
    paddingBottom: 30,
  },
  welcomeHeader: {
    marginTop: 10,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  streakText: {
    fontSize: 16,
    color: "#FF9500",
    marginTop: 5,
  },
  startButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    alignSelf: "center",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  recentSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  sessionCard: {
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    marginBottom: 10,
  },
  sessionCardPressed: {
    opacity: 0.7,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  sessionLanguage: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  sessionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionDate: {
    fontSize: 13,
    color: "#666",
  },
  sessionMetrics: {
    fontSize: 13,
    color: "#666",
  },
  emptyState: {
    padding: 30,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
});
