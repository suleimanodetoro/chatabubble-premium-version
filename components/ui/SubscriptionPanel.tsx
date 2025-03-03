// components/ui/SubscriptionPanel.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Alert, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { SubscriptionService, SubscriptionPackage } from '@/lib/services/subscription';
import { useAppStore } from '@/hooks/useAppStore';
import Purchases from 'react-native-purchases';

interface SubscriptionPanelProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function SubscriptionPanel({ onClose, isModal = false }: SubscriptionPanelProps) {
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
      setLoading(true);
      
      // Get subscription status first
      const isActive = await SubscriptionService.checkSubscriptionStatus();
      setIsSubscribed(isActive);
      
      // Load subscription offerings from RevenueCat
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current?.availablePackages?.length > 0) {
          console.log('RevenueCat offerings found:', offerings.current.availablePackages.length);
          
          // Map RevenueCat offerings to our format
          const revenueCatPackages = offerings.current.availablePackages.map(pkg => ({
            identifier: pkg.identifier,
            title: formatPackageTitle(pkg.packageType),
            description: formatPackageDescription(pkg.packageType),
            price: pkg.product.price,
            period: formatPeriod(pkg.packageType),
            priceString: pkg.product.priceString
          }));
          
          setPackages(revenueCatPackages);
        } else {
          console.log('No RevenueCat offerings found, using fallback');
          // Fallback to mock packages if no offerings available
          const fallbackPackages = await SubscriptionService.getPackages();
          setPackages(fallbackPackages);
        }
      } catch (offeringsError) {
        console.error('Error fetching offerings:', offeringsError);
        // Fallback to mock packages
        const fallbackPackages = await SubscriptionService.getPackages();
        setPackages(fallbackPackages);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
      Alert.alert('Error', 'Failed to load subscription information');
      
      // Attempt to load fallback packages even if main load fails
      try {
        const fallbackPackages = await SubscriptionService.getPackages();
        setPackages(fallbackPackages);
      } catch {
        // If even this fails, use empty array
        setPackages([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPackageTitle = (packageType: string): string => {
    switch (packageType) {
      case 'ANNUAL':
      case 'YEARLY':
        return 'Annual Premium';
      case 'MONTHLY':
        return 'Monthly Premium';
      default:
        return `Premium (${packageType})`;
    }
  };

  const formatPackageDescription = (packageType: string): string => {
    switch (packageType) {
      case 'ANNUAL':
      case 'YEARLY':
        return 'Save 33% with our annual subscription';
      case 'MONTHLY':
        return 'Full access with monthly billing';
      case 'LIFETIME':
        return 'One-time purchase for permanent access';
      default:
        return 'Unlock premium features';
    }
  };

  const formatPeriod = (packageType: string): string => {
    switch (packageType) {
      case 'ANNUAL':
      case 'YEARLY':
        return 'year';
      case 'MONTHLY':
        return 'month';
      case 'LIFETIME':
        return 'lifetime';
      default:
        return packageType.toLowerCase();
    }
  };

  const handlePurchase = async (pkg: SubscriptionPackage) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to subscribe');
      return;
    }

    setPurchasing(true);
    try {
      // First, get the offerings again to ensure we have the latest
      const offerings = await Purchases.getOfferings();
      
      // Find the package in the offerings that matches our identifier
      const packageToPurchase = offerings.current?.availablePackages.find(
        offering => offering.identifier === pkg.identifier
      );
      
      if (!packageToPurchase) {
        console.error('Package not found in offerings:', pkg.identifier);
        const fallbackSuccess = await SubscriptionService.purchasePackage(pkg.identifier);
        if (fallbackSuccess) {
          setIsSubscribed(true);
          Alert.alert('Success', 'Thank you for subscribing!');
        }
        return;
      }
      
      // Purchase the package directly using Purchases SDK
      console.log('Purchasing package:', packageToPurchase.identifier);
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      // Check if the purchase was successful by checking entitlements
      const isPremium = customerInfo.entitlements.active['premium_access']?.isActive ?? false;
      
      if (isPremium) {
        setIsSubscribed(true);
        Alert.alert('Success', 'Thank you for subscribing!');
        // Update global app state if needed
        if (useAppStore.getState().setIsPremium) {
          useAppStore.getState().setIsPremium(true);
        }
      } else {
        console.warn('Purchase completed but premium entitlement not active');
      }
    } catch (error: any) {
      // Don't show error if user cancelled
      if (error.userCancelled) {
        console.log('Purchase cancelled by user');
      } else {
        console.error('Purchase error:', error);
        Alert.alert('Error', error.message || 'Failed to complete purchase');
      }
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
      console.error('Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, isModal && styles.modalContainer]}>
      <ThemedText style={styles.title}>
        {isSubscribed ? 'Premium Subscription' : 'Upgrade to Premium'}
      </ThemedText>
      
      {isSubscribed ? (
        <ThemedView style={styles.subscribedContent}>
          <ThemedText style={styles.subscribedText}>
            You're currently subscribed to Premium!
          </ThemedText>
          <ThemedText style={styles.benefitsText}>
            Enjoy all premium features:
          </ThemedText>
          <View style={styles.benefitsList}>
            <ThemedText style={styles.benefitItem}>• Unlimited conversations</ThemedText>
            <ThemedText style={styles.benefitItem}>• Advanced language models</ThemedText>
            <ThemedText style={styles.benefitItem}>• No ads</ThemedText>
            <ThemedText style={styles.benefitItem}>• Priority support</ThemedText>
          </View>
        </ThemedView>
      ) : (
        <>
          <ThemedText style={styles.subtitle}>
            Unlock all premium features
          </ThemedText>
          
          <View style={styles.packageList}>
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
                  {pkg.priceString || `$${pkg.price.toFixed(2)}`} / {pkg.period}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={styles.benefitsHeader}>Premium benefits:</ThemedText>
          <View style={styles.benefitsList}>
            <ThemedText style={styles.benefitItem}>• Unlimited conversations</ThemedText>
            <ThemedText style={styles.benefitItem}>• Advanced language models</ThemedText>
            <ThemedText style={styles.benefitItem}>• No ads</ThemedText>
            <ThemedText style={styles.benefitItem}>• Priority support</ThemedText>
          </View>
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

      {isModal && (
        <Pressable style={styles.closeButton} onPress={onClose}>
          <ThemedText style={styles.closeButtonText}>Close</ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginVertical: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  packageList: {
    marginBottom: 20,
  },
  packageCard: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    color: '#28a745',
    fontWeight: '600',
  },
  benefitsHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  benefitsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  benefitsList: {
    marginBottom: 20,
  },
  benefitItem: {
    fontSize: 15,
    marginBottom: 6,
    color: '#555',
  },
  restoreButton: {
    padding: 15,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  closeButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#555',
  },
});