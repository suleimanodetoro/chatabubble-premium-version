// components/SessionHistory.tsx - Full original code with navigation and style fixes

import React, { useState, useEffect } from 'react'; // Added React import
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native'; // Added ActivityIndicator, Alert
import { FlashList } from '@shopify/flash-list';
import { ThemedText } from './ThemedText'; // Assuming ThemedText exists
import { Session } from '@/types'; // Assuming Session type exists
import { SyncService } from '@/lib/services/sync'; // Assuming SyncService exists
import { useAppStore } from '@/hooks/useAppStore'; // Assuming useAppStore hook exists
import { useRouter } from 'expo-router'; // Use useRouter hook
import { useTheme } from '@/lib/theme/theme'; // Import useTheme

export function SessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAppStore(state => state.user);
  const router = useRouter(); // Initialize router
  const theme = useTheme(); // Get theme for styling

  // Load sessions when component mounts or user changes
  useEffect(() => {
    loadSessions();
  }, [user?.id]); // Depend on user.id

  // Function to fetch sessions
  const loadSessions = async () => {
    if (!user?.id) {
      console.log("SessionHistory: No user ID, cannot load sessions.");
      setLoading(false); // Stop loading if no user
      setSessions([]); // Clear sessions
      return;
    }

    console.log("SessionHistory: Loading sessions...");
    setLoading(true);
    try {
      // Fetch sessions using the SyncService
      const data = await SyncService.fetchSavedSessions(user.id);
      console.log(`SessionHistory: Loaded ${data.length} sessions.`);
      setSessions(data);
    } catch (error) {
      console.error('SessionHistory: Error loading sessions:', error);
      // Optionally show an error message to the user
      // Alert.alert("Error", "Could not load session history.");
    } finally {
      setLoading(false); // Ensure loading is set to false
    }
  };

  // Function to handle pressing a session item
  const handlePress = (session: Session | null | undefined) => {
    // Check if session and session.id are valid before navigating
    if (session && session.id) {
      console.log(`SessionHistory: Navigating to session: ${session.id}`);
      // Navigate using the router push method with params
      router.push({
        pathname: '/(chat)/[id]',
        params: { id: session.id } // Pass the validated session ID
      });
    } else {
      // Log error and inform user if session or ID is invalid
      console.error("SessionHistory: Attempted to navigate with invalid session data:", session);
      Alert.alert("Error", "Cannot open this session because its data is incomplete.");
    }
  };

  // Render function for each session item in the list
  const renderSession = ({ item: session }: { item: Session }) => {
    // Safely format date, provide fallback
    const formattedDate = session.startTime
      ? new Date(session.startTime).toLocaleDateString()
      : 'Unknown Date';
    // Safely get language name
    const languageName = session.target_language?.name || 'N/A';
    // Safely calculate duration
    const durationMinutes = session.metrics?.duration
      ? Math.round(session.metrics.duration / 60000)
      : 0; // Default to 0 if duration is missing

    // *** FIX: Determine background color string based on status, ensuring string access ***
    // Check if theme.colors.success exists and is a string, otherwise use fallback
    const completedColor = typeof theme.colors.success === 'string' ? theme.colors.success : '#4CAF50';
    // Check if theme.colors.primary.main exists and is a string, otherwise use fallback
    const savedColor = typeof theme.colors.primary?.main === 'string' ? theme.colors.primary.main : '#2196F3';

    const badgeBackgroundColor = session.status === 'completed' ? completedColor : savedColor;

    // *** FIX: Use theme.colors.background.paper (or .default if paper doesn't exist) for card background ***
    const cardBackgroundColor = theme.colors.background?.paper || theme.colors.background?.default || '#ffffff'; // Added fallback to white

    return (
      <Pressable
        // *** FIX: Apply corrected card background color ***
        style={[styles.sessionCard, { backgroundColor: cardBackgroundColor }]}
        onPress={() => handlePress(session)} // Use the validated handler
        // Add accessibility props
        accessibilityLabel={`Session: ${session.scenario?.title || 'Unnamed Session'}, Language: ${languageName}, Date: ${formattedDate}`}
        accessibilityRole="button"
      >
        {/* Session Title */}
        <ThemedText type="defaultSemiBold" style={styles.sessionTitle} numberOfLines={1}>
          {session.scenario?.title || 'Unnamed Session'}
        </ThemedText>
        {/* Session Info (Language and Date) */}
        <ThemedText type="default" style={styles.sessionInfo} numberOfLines={1}>
          {languageName} • {formattedDate}
        </ThemedText>
        {/* Session Stats (Messages and Duration) */}
        <View style={styles.statsRow}>
          <ThemedText type="default" style={styles.statText}>
            Messages: {session.messages?.length ?? 0} {/* Safe access */}
          </ThemedText>
          <ThemedText type="default" style={styles.statText}>
            Duration: {durationMinutes}m
          </ThemedText>
        </View>
        {/* Status Badge */}
        <View style={[
          styles.statusBadge,
          // *** FIX: Apply the explicitly determined background color string ***
          { backgroundColor: badgeBackgroundColor }
        ]}>
          <ThemedText style={styles.statusText}>
            {session.status || 'saved'} {/* Default to 'saved' if status missing */}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  // Show loading indicator while fetching
  if (loading) {
    return (
      <View style={[styles.centered, { flex: 1 }]}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <ThemedText style={{ marginTop: 10 }}>Loading sessions...</ThemedText>
      </View>
    );
  }

  // Main component structure using FlashList
  return (
    <View style={styles.container}>
      <FlashList
        data={sessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.id ?? Math.random().toString()} // Use ID as key, fallback if needed
        estimatedItemSize={120} // Adjust based on your average item height
        // Pull-to-refresh functionality
        onRefresh={loadSessions}
        refreshing={loading} // Show refresh indicator while loading
        // Component to show when the list is empty
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={{ opacity: 0.7 }}>No recent sessions found.</ThemedText>
            <ThemedText style={{ opacity: 0.7, marginTop: 4 }}>Start a new conversation!</ThemedText>
          </View>
        }
        // Add some padding to the content container
        contentContainerStyle={styles.listContentContainer}
      />
    </View>
  );
}

// Stylesheet for the component
const styles = StyleSheet.create({
  container: {
    flex: 1, // Take up available space
  },
  listContentContainer: {
    paddingVertical: 8, // Add vertical padding to the list itself
    paddingHorizontal: 8, // Add horizontal padding to prevent cards touching edge
  },
  sessionCard: {
    padding: 16,
    // backgroundColor: '#fff', // Set dynamically via theme
    borderRadius: 12,
    marginVertical: 6, // Vertical margin between cards
    // Using marginVertical instead of margin to avoid double horizontal margin with list padding
    // Shadow properties for depth (consider platform differences)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Elevation for Android shadow
  },
  sessionTitle: {
    // fontSize: 18, // Use ThemedText type prop instead
    // fontWeight: '600', // Use ThemedText type prop instead
    marginBottom: 4,
  },
  sessionInfo: {
    // fontSize: 14, // Use ThemedText type prop instead
    fontSize: 13, // Explicitly set smaller font size
    opacity: 0.7,
    marginBottom: 10, // Increased space below info
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1, // Add a separator line
    borderTopColor: '#eee', // Light separator color
    paddingTop: 8, // Space above stats text
  },
  statText: {
    // fontSize: 14, // Use ThemedText type prop instead
    fontSize: 13, // Explicitly set smaller font size
    opacity: 0.8,
  },
  statusBadge: {
    position: 'absolute', // Position badge relative to card
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12, // Pill shape
  },
  // completedBadge and savedBadge styles removed as color is set dynamically
  statusText: {
    color: '#fff', // White text for badge
    fontSize: 10, // Smaller text for badge
    fontWeight: '600', // Bold badge text
    textTransform: 'capitalize', // Capitalize status (e.g., 'Completed')
  },
  centered: { // Reusable style for centering content
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Add padding to centered content
  },
  // loading and empty styles replaced by 'centered'
});
