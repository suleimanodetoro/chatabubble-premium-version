// app/(tabs)/index.tsx - Removed streak UI

import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, ScrollView, View, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/hooks/useAppStore";
import { MetricsService } from "@/lib/services/metrics";
import { Session } from "@/types";
import { useTheme } from "@/lib/theme/theme";
import { Heading1, Heading2, Heading3, Body1, Body2, DisplayText, Caption } from "@/components/ui/Typography";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feather } from '@expo/vector-icons';

// Add proper typing for metrics
interface UserMetrics {
  totalSessions: number;
  completedSessions: number;
  activeLanguages: number;
  languageProgress: Record<
    string,
    {
      sessionsCompleted: number;
      lastPracticed: string;
      level: "beginner" | "intermediate" | "advanced";
      recentSessions: Session[];
    }
  >;
  recentSessions: Session[];
}

export default function HomeScreen() {
  const user = useAppStore((state) => state.user);
  const router = useRouter();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const theme = useTheme();
  const { setCurrentScenario, setCurrentSession, saveSession } = useAppStore();

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
      console.log("Loaded metrics:", userMetrics);
      setMetrics(userMetrics);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to handle session continuation
  const handleContinueSession = async (session) => {
    try {
      // Ensure we have both session and scenario data
      if (!session || !session.scenario) {
        console.error("Invalid session or missing scenario data:", session);
        return;
      }
      
      console.log("Continuing session:", session.id);
      
      // Set the current scenario and session in the app store
      setCurrentScenario(session.scenario);
      setCurrentSession(session);
      
      // Save the session first to ensure it's available
      await saveSession(session);
      
      // Navigate to the chat screen with the session ID
      router.push({
        pathname: "/(chat)/[id]",
        params: { id: session.id },
      });
    } catch (error) {
      console.error("Error continuing session:", error);
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
        <Heading1>{greeting}, {user?.name || "there"}!</Heading1>
        
        {/* Removed streak UI */}
      </View>
    );
  };

  const renderTodaysFocus = () => {
    const recentActivity = metrics?.recentSessions?.[0];

    return (
      <Card
        variant="elevated"
        style={styles.focusCard}
        onPress={() => router.push("/(tabs)/scenarios")}
      >
        <CardHeader 
          title="Today's Focus"
          action={
            <Button
              variant="icon"
              icon="more-horizontal"
              onPress={() => {}}
              size="small"
            />
          }
        />
        <CardContent>
          {recentActivity ? (
            <View>
              <Body1 style={styles.focusTitle}>Continue your progress</Body1>
              <Body2 style={styles.focusSubtitle}>
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
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading ? "--" : metrics?.totalSessions || 0}
              </Heading2>
              <Caption>Total Sessions</Caption>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading ? "--" : Object.keys(metrics?.languageProgress || {}).length}
              </Heading2>
              <Caption>Languages</Caption>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading ? "--" : metrics?.completedSessions || 0}
              </Heading2>
              <Caption>Completed</Caption>
            </View>
          </View>
        </CardContent>
      </Card>
    );
  };

  const renderRecentActivities = () => {
    const recentSessions = metrics?.recentSessions || [];

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      );
    }

    if (recentSessions.length === 0) {
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
          <Button
            variant="tertiary"
            size="small"
            onPress={() => {}}
          >
            See all
          </Button>
        </View>
        
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentSessionsScrollContent}
        >
          {recentSessions.map((session) => {
            // Safely check for required properties
            if (!session?.target_language?.name) {
              return null;
            }
            
            const formattedDate = new Date(session.startTime).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric'
            });
            
            return (
              <Card
                key={session.id}
                variant="elevated" 
                style={styles.sessionCard}
                onPress={() => handleContinueSession(session)}
              >
                <CardContent>
                  <View style={styles.sessionCardHeader}>
                    <View style={[
                      styles.languageTag, 
                      { backgroundColor: theme.colors.primary.light }
                    ]}>
                      <Caption style={styles.languageTagText}>
                        {session.target_language.name}
                      </Caption>
                    </View>
                    <Caption>{formattedDate}</Caption>
                  </View>
                  
                  <Body1 
                    style={styles.sessionTitle}
                    numberOfLines={2}
                  >
                    {session.scenario?.title || "Practice Session"}
                  </Body1>
                  
                  <View style={styles.sessionStats}>
                    <View style={styles.sessionStat}>
                      <Feather name="message-circle" size={14} color={theme.colors.text.secondary} />
                      <Caption style={styles.sessionStatText}>
                        {session.messages?.length || 0} messages
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  streakText: {
    marginLeft: 6,
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E0E0E0",
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
  },
  sessionCard: {
    width: 200,
    marginRight: 12,
  },
  sessionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  languageTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  languageTagText: {
    color: "#fff",
  },
  sessionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    height: 48,
  },
  sessionStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sessionStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionStatText: {
    marginLeft: 4,
  },
  continueSessionButton: {
    alignSelf: "flex-start",
  },
  newSessionCard: {
    width: 120,
    marginRight: 12,
    justifyContent: "center",
  },
  newSessionCardContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  newSessionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  newSessionText: {
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyStateCard: {
    padding: 16,
    alignItems: "center",
  },
  emptyStateText: {
    textAlign: "center",
    marginBottom: 16,
  },
  emptyStateButton: {
    alignSelf: "center",
  },
});