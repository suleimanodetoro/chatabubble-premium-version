// components/SessionHistory.tsx
import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ThemedText } from './ThemedText';
import { Session } from '@/types';
import { SyncService } from '@/lib/services/sync';
import { useAppStore } from '@/hooks/useAppStore';
import { router } from 'expo-router';

export function SessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAppStore(state => state.user);
  
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await SyncService.fetchSavedSessions(user.id);
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSession = ({ item: session }: { item: Session }) => (
    <Pressable 
      style={styles.sessionCard}
      onPress={() => router.push({
        pathname: '/(chat)/[id]',
        params: { id: session.id }
      })}
    >
      <ThemedText style={styles.sessionTitle}>
        {session.scenario?.title || 'Unnamed Session'}
      </ThemedText>
      <ThemedText style={styles.sessionInfo}>
        {session.targetLanguage.name} • {
          new Date(session.startTime).toLocaleDateString()
        }
      </ThemedText>
      <View style={styles.statsRow}>
        <ThemedText style={styles.statText}>
          Messages: {session.messages.length}
        </ThemedText>
        <ThemedText style={styles.statText}>
          Duration: {Math.round(session.metrics?.duration! / 60000)}m
        </ThemedText>
      </View>
      <View style={[
        styles.statusBadge,
        session.status === 'completed' ? styles.completedBadge : styles.savedBadge
      ]}>
        <ThemedText style={styles.statusText}>
          {session.status}
        </ThemedText>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ThemedText>Loading sessions...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={sessions}
        renderItem={renderSession}
        estimatedItemSize={100}
        onRefresh={loadSessions}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText>No sessions found</ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sessionCard: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionInfo: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statText: {
    fontSize: 14,
    opacity: 0.8,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadge: {
    backgroundColor: '#4CAF50',
  },
  savedBadge: {
    backgroundColor: '#2196F3',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: 20,
    alignItems: 'center',
  },
});