// app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, ScrollView, View, Pressable, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/hooks/useAppStore";
import { MetricsService } from "@/lib/services/metrics";
import { Session, Scenario } from "@/types";
import { useTheme } from "@/lib/theme/theme";
import { Heading1, Heading2, Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feather } from '@expo/vector-icons';

interface UserMetrics {
  totalSessions?: number;
  completedSessions?: number;
  activeLanguages?: number;
  languageProgress?: Record<
    string,
    {
      sessionsCompleted: number;
      lastPracticed: string;
      level: "beginner" | "intermediate" | "advanced";
      recentSessions?: Session[]; // Make recentSessions optional here
    }
  >;
  recentSessions?: Session[]; // Make recentSessions optional
}

export default function HomeScreen() {
  const user = useAppStore((state) => state.user);
  const router = useRouter();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = useTheme();
  const { setCurrentScenario, setCurrentSession } = useAppStore();

  const loadMetrics = useCallback(async () => {
    if (!user?.id) {
      console.log("HomeScreen: No user ID found, skipping metrics load.");
      setMetrics(null); // Clear previous metrics
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    console.log(`HomeScreen: Loading metrics for user: ${user.id}`);
    if(!isRefreshing) setIsLoading(true);

    try {
      const userMetrics = await MetricsService.getUserMetrics(user.id);
      console.log("HomeScreen: Loaded metrics:", userMetrics);
      setMetrics(userMetrics);
    } catch (error) {
      console.error("HomeScreen: Error loading metrics:", error);
      Alert.alert("Error", "Could not load your progress data. Please try again.");
      setMetrics(null); // Clear metrics on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, isRefreshing]); // Added isRefreshing

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]); // loadMetrics is memoized

  const onRefresh = useCallback(() => {
    console.log("HomeScreen: Refreshing metrics...");
    setIsRefreshing(true);
    loadMetrics(); // loadMetrics will set isRefreshing to false
  }, [loadMetrics]);


  const handleContinueSession = async (session: Session | null | undefined) => {
    if (!session || !session.id || !session.scenario?.id) { // Defensive check
      console.error("HomeScreen: Invalid session data for continuation.", session);
      Alert.alert("Error", "Could not continue this session due to missing details.");
      return;
    }
    console.log(`HomeScreen: Continuing session: ${session.id}, Scenario: ${session.scenario.id}`);
    try {
      setCurrentScenario(session.scenario);
      setCurrentSession(session);
      router.push({
        pathname: "/(chat)/[id]",
        params: {
          id: session.id,
          scenarioId: session.scenario.id,
          isNewSession: "false",
        },
      });
    } catch (error) {
      console.error("HomeScreen: Error navigating to chat session:", error);
      Alert.alert("Navigation Error", "Could not open the chat session.");
    }
  };

  const renderGreeting = () => {
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Hello";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";
    return (
      <View style={styles.welcomeHeader}>
        <Heading1>{greeting}, {user?.name || "Explorer"}!</Heading1>
      </View>
    );
  };

  const renderTodaysFocus = () => {
    const recentActivity = metrics?.recentSessions?.[0];
    return (
      <Card variant="elevated" style={styles.focusCard}>
        <CardHeader title="Today's Focus" />
        <CardContent>
          {isLoading && !metrics ? ( // Show loader only if no metrics yet
             <ActivityIndicator color={theme.colors.primary.main} />
          ) : recentActivity && recentActivity.id && recentActivity.scenario?.id ? ( // Ensure activity is valid
            <View>
              <Body1 style={styles.focusTitle}>Continue your progress</Body1>
              <Body2 style={styles.focusSubtitle} numberOfLines={1}>
                {recentActivity.scenario?.title || "Practice Session"}
              </Body2>
              <Button
                variant="primary"
                size="medium"
                icon="play"
                style={styles.continueButton}
                onPress={() => handleContinueSession(recentActivity)}
              >
                Continue Learning
              </Button>
            </View>
          ) : (
            <View>
              <Body1 style={styles.focusTitle}>Start your learning journey</Body1>
              <Body2 style={styles.focusSubtitle}>
                Choose a scenario to begin practicing
              </Body2>
              <Button
                variant="primary"
                size="medium"
                icon="plus"
                style={styles.continueButton}
                onPress={() => router.push("/(tabs)/scenarios")}
              >
                Start New Conversation
              </Button>
            </View>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderProgressSummary = () => {
    return (
      <Card variant="elevated" style={styles.progressCard}>
        <CardHeader title="Your Progress" />
        <CardContent>
          <View style={[styles.statsContainer, { justifyContent: 'space-around' }]}>
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading && !metrics ? "--" : metrics?.totalSessions ?? 0}
              </Heading2>
              <Caption>Total Sessions</Caption>
            </View>
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading && !metrics ? "--" : Object.keys(metrics?.languageProgress || {}).length}
              </Heading2>
              <Caption>Languages</Caption>
            </View>
          </View>
        </CardContent>
      </Card>
    );
  };

  const renderRecentActivities = () => {
    const recentSessions = metrics?.recentSessions ?? [];

    if (isLoading && !metrics) { // Show loader only if no metrics yet and still loading
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      );
    }

    if (!isLoading && recentSessions.length === 0) { // Show empty state only if not loading
      return (
        <Card variant="flat" style={styles.emptyStateCard}>
          <CardContent>
            <Body1 style={styles.emptyStateText}>
              No conversations yet. Start practicing!
            </Body1>
            <Button
              variant="primary"
              onPress={() => router.push("/(tabs)/scenarios")}
              style={styles.emptyStateButton}
            >
              Browse Scenarios
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <View style={styles.recentActivitiesContainer}>
        <View style={styles.sectionHeader}>
          <Heading3>Recent Conversations</Heading3>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentSessionsScrollContent}
        >
          {recentSessions.filter(s => s && s.id && s.scenario?.id).map((session) => { // Filter for valid sessions
            const formattedDate = session.startTime
              ? new Date(session.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : 'Date unknown';
            const languageName = session.target_language?.name || 'N/A';

            return (
              <Card
                key={session.id}
                variant="elevated"
                style={styles.sessionCard}
                onPress={() => handleContinueSession(session)}
              >
                <CardContent>
                  <View style={styles.sessionCardHeader}>
                    <View style={[styles.languageTag, { backgroundColor: theme.colors.primary.light }]}>
                      <Caption style={styles.languageTagText}>{languageName}</Caption>
                    </View>
                    <Caption>{formattedDate}</Caption>
                  </View>
                  <Body1 style={styles.sessionTitle} numberOfLines={2}>
                    {session.scenario?.title || "Practice Session"}
                  </Body1>
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStat}>
                      <Feather name="message-circle" size={14} color={theme.colors.text.secondary} />
                      <Caption style={styles.sessionStatText}>
                        {session.messages?.length ?? 0} messages
                      </Caption>
                    </View>
                  </View>
                  <Button
                    variant="secondary"
                    size="small"
                    style={styles.continueSessionButton}
                    icon="arrow-right"
                    iconPosition="right"
                    onPress={() => handleContinueSession(session)}
                  >
                    Continue
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          <Card
            variant="outlined"
            style={styles.newSessionCard}
            onPress={() => router.push("/(tabs)/scenarios")}
          >
            <CardContent style={styles.newSessionCardContent}>
              <View style={styles.newSessionIconContainer}>
                <Feather name="plus" size={24} color={theme.colors.primary.main} />
              </View>
              <Body1 style={styles.newSessionText}>Start New</Body1>
            </CardContent>
          </Card>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.default }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={ // Added RefreshControl
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary.main} // iOS
            colors={[theme.colors.primary.main]} // Android
          />
        }
      >
        {renderGreeting()}
        {renderTodaysFocus()}
        {renderProgressSummary()}
        {renderRecentActivities()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  welcomeHeader: {
    marginBottom: 24,
  },
  focusCard: {
    marginBottom: 20,
  },
  focusTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  focusSubtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  continueButton: {
    alignSelf: "flex-start",
  },
  progressCard: {
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recentActivitiesContainer: {
    marginBottom: 24,
  },
  recentSessionsScrollContent: {
    paddingRight: 16,
    paddingLeft: 4,
  },
  sessionCard: {
    width: 220,
    marginRight: 12,
    overflow: 'hidden',
  },
  sessionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  languageTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  languageTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: '600',
  },
  sessionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    minHeight: 40,
    lineHeight: 20,
  },
  sessionStats: {
    flexDirection: "row",
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  sessionStatText: {
    marginLeft: 4,
    fontSize: 12,
  },
  continueSessionButton: {
    marginTop: 'auto',
    alignSelf: "flex-start",
  },
  newSessionCard: {
    width: 120,
    justifyContent: "center",
    alignItems: 'center',
    minHeight: 150,
  },
  newSessionCardContent: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  newSessionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F0F0F0", // Consider theme.colors.background.default or similar
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  newSessionText: {
    fontWeight: "500",
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyStateCard: {
    padding: 20,
    alignItems: "center",
    // backgroundColor: '#F9F9F9', // Consider theme.colors.background.default
    borderRadius: 8,
    marginTop: 10,
  },
  emptyStateText: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 16,
    opacity: 0.8,
  },
  emptyStateButton: {
    alignSelf: "center",
  },
});
