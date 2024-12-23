// app/(tabs)/subscription.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { SubscriptionService, SubscriptionPackage } from '@/lib/services/subscription';
import { useAppStore } from '@/hooks/useAppStore';

export default function SubscriptionScreen() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const [packages, status] = await Promise.all([
        SubscriptionService.getPackages(),
        SubscriptionService.checkSubscriptionStatus()
      ]);
      setPackages(packages);
      setIsSubscribed(status);
    } catch (error) {
      Alert.alert('Error', 'Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: SubscriptionPackage) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to subscribe');
      return;
    }

    setPurchasing(true);
    try {
      const success = await SubscriptionService.purchasePackage(pkg.identifier);
      if (success) {
        setIsSubscribed(true);
        Alert.alert('Success', 'Thank you for subscribing!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const restored = await SubscriptionService.restorePurchases();
      if (restored) {
        setIsSubscribed(true);
        Alert.alert('Success', 'Your subscription has been restored!');
      } else {
        Alert.alert('Notice', 'No active subscriptions found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={styles.title}>
          {isSubscribed ? 'Current Subscription' : 'Choose Your Plan'}
        </ThemedText>
        
        {isSubscribed ? (
          <ThemedView style={styles.subscribedContent}>
            <ThemedText style={styles.subscribedText}>
              You're currently subscribed to Premium!
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                style={styles.packageCard}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasing}
              >
                <ThemedText style={styles.packageTitle}>{pkg.title}</ThemedText>
                <ThemedText style={styles.packageDescription}>
                  {pkg.description}
                </ThemedText>
                <ThemedText style={styles.packagePrice}>
                  ${pkg.price.toFixed(2)} / {pkg.period}
                </ThemedText>
              </Pressable>
            ))}
          </>
        )}

        <Pressable
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={loading}
        >
          <ThemedText style={styles.restoreButtonText}>
            Restore Purchases
          </ThemedText>
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  packageCard: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 15,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  packageDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  subscribedContent: {
    padding: 20,
    alignItems: 'center',
  },
  subscribedText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  restoreButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
});