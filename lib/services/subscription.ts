// lib/services/subscription.ts - Fixed TypeScript issues & account deletion support
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../../constants/Config';

const ENTITLEMENT_ID = 'premium_access';
const SUBSCRIPTION_CACHE_KEY = '@subscription_status';

export interface SubscriptionPackage {
  identifier: string;
  title: string;
  description: string;
  price: number;
  period: string;
  features?: string[];
  priceString?: string;
}

export interface SubscriptionDetails {
  isActive: boolean;
  expirationDate: string | null;
  purchaseDate: string | null;
  productIdentifier: string | null;
  isLifetime: boolean;
  willRenew: boolean;
}

export class SubscriptionService {
  static async initialize() {
    try {
      console.log('Initializing RevenueCat...');
      
      // Get the appropriate API key based on platform
      let apiKey;
      if (Platform.OS === 'ios') {
        apiKey = Config.REVENUECAT_IOS_API_KEY;
        console.log('Using iOS API key');
      } else if (Platform.OS === 'android') {
        apiKey = Config.REVENUECAT_ANDROID_API_KEY;
        console.log('Using Android API key');
      } else {
        console.log('Unsupported platform for RevenueCat');
        return;
      }
      
      if (!apiKey) {
        console.error('No RevenueCat API key found for platform:', Platform.OS);
        return;
      }

      // Configure RevenueCat with appropriate API key
      await Purchases.configure({ apiKey });
      console.log('RevenueCat initialized successfully');
      
      // Identify user if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        console.log('Identifying user with RevenueCat:', user.id);
        await this.identifyUser(user.id);
      }
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
    }
  }
  
  /**
   * Handles cancellation or cleanup of user subscriptions during account deletion
   * Note: This doesn't actually cancel App Store/Play Store subscriptions,
   * it just disassociates them from the user account in our system
   */
  static async cancelSubscription(userId: string): Promise<boolean> {
    try {
      console.log('Cleaning up subscription data for user:', userId);
      
      // 1. First try to clean up any RevenueCat associations
      try {
        // Check if user is identified with RevenueCat
        const userInfo = await AsyncStorage.getItem(`@revenuecat_user:${userId}`);
        
        if (userInfo) {
          console.log('Found RevenueCat user info, attempting to clean up');
          
          // Set anonymous ID for RevenueCat (this disassociates rather than deletes)
          await Purchases.logOut();
          
          // Clear local RevenueCat cache
          await AsyncStorage.removeItem(`@revenuecat_user:${userId}`);
          await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
        }
      } catch (revenueCatError) {
        console.error('Error cleaning up RevenueCat data:', revenueCatError);
        // Continue with other cleanup even if RevenueCat fails
      }
      
      // 2. Update Supabase subscription record
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            subscription: {
              active: false,
              tier: null,
              cancelled_at: new Date().toISOString(),
              expiration: null,
              product_id: null
            } 
          })
          .eq('id', userId);
          
        if (error) {
          console.error('Error updating subscription in database:', error);
          return false;
        }
      } catch (dbError) {
        console.error('Error updating subscription in database:', dbError);
        return false;
      }
      
      // 3. Clear any local subscription cache
      await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
      
      console.log('Subscription data cleanup completed successfully');
      return true;
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      return false;
    }
  }
  
  static async identifyUser(userId: string): Promise<boolean> {
    try {
      // According to RevenueCat docs, logIn returns an object containing customerInfo
      const response = await Purchases.logIn(userId);
      
      // Check if user has active entitlements for our premium access
      const hasActiveEntitlement = response?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]?.isActive ?? false;
      
      console.log('User identified with RevenueCat, subscription status:', hasActiveEntitlement);
      
      // Store RevenueCat user association
      await AsyncStorage.setItem(`@revenuecat_user:${userId}`, JSON.stringify({
        identified: true,
        timestamp: Date.now()
      }));
      
      return hasActiveEntitlement;
    } catch (error) {
      console.error('Error identifying user with RevenueCat:', error);
      return false;
    }
  }

  static async getPackages(): Promise<SubscriptionPackage[]> {
    try {
      console.log('Getting subscription packages...');
      
      try {
        // Try to get packages from RevenueCat first
        const offerings = await Purchases.getOfferings();
        
        // Fixed: proper null checking
        if (offerings.current && offerings.current.availablePackages && offerings.current.availablePackages.length > 0) {
          console.log('Found RevenueCat offerings:', offerings.current.identifier);
          
          return offerings.current.availablePackages.map(pkg => ({
            identifier: pkg.identifier,
            title: this.getFormattedPackageTitle(pkg.packageType),
            description: this.getDefaultDescription(pkg.packageType),
            price: pkg.product.price,
            period: pkg.packageType.toLowerCase(),
            features: this.getPackageFeatures(pkg.packageType),
            priceString: pkg.product.priceString
          }));
        }
      } catch (error) {
        console.warn('Error fetching RevenueCat offerings:', error);
      }
      
      // Fallback to mock packages
      console.log('Using mock subscription packages');
      return this.getMockPackages();
    } catch (error) {
      console.error('Error getting packages:', error);
      return this.getMockPackages();
    }
  }

  static async purchasePackage(packageId: string): Promise<boolean> {
    try {
      console.log('Purchasing package:', packageId);
      
      // Try to get the offerings from RevenueCat
      const offerings = await Purchases.getOfferings();
      
      // Fixed: proper null checking
      const packageToPurchase = offerings.current?.availablePackages?.find(
        pkg => pkg.identifier === packageId
      );

      if (!packageToPurchase) {
        console.log('Package not found in RevenueCat offerings, using mock for development');
        
        // For development/testing - simulate successful purchase of mock packages
        if (packageId.startsWith('mock_')) {
          console.log('Simulating purchase of mock package');
          await this.updateUserSubscriptionStatus(true, {
            isActive: true,
            productIdentifier: packageId,
            purchaseDate: new Date().toISOString(),
            expirationDate: this.getExpirationDate(packageId),
            willRenew: true,
            isLifetime: packageId === 'mock_lifetime'
          });
          return true;
        }
        
        throw new Error('Subscription package not found');
      }

      try {
        // Make the purchase through RevenueCat and handle timeout/hanging issue
        // Using a Promise.race to prevent hanging forever on iOS as reported in community thread
        const purchaseResult = await Promise.race([
          Purchases.purchasePackage(packageToPurchase),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Purchase timed out')), 30000)
          )
        ]);
        
        // Check entitlements directly from the purchase result
        // The response has a structure { customerInfo: CustomerInfo }
        const isSubscribed = purchaseResult?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]?.isActive ?? false;
        
        if (isSubscribed) {
          console.log('Purchase successful, updating subscription status');
          // Update the subscription status in our backend
          await this.updateUserSubscriptionStatus(true, {
            isActive: true,
            productIdentifier: packageToPurchase.product.identifier,
            purchaseDate: new Date().toISOString(),
            expirationDate: null,
            willRenew: true, 
            isLifetime: false
          });
        }
        
        return isSubscribed;
      } catch (purchaseError: any) {
        console.error('Error during purchase:', purchaseError);
        
        // Handle the problem identified in the PDF - where purchase succeeds but call hangs
        if (purchaseError.message === 'Purchase timed out') {
          console.log('Purchase may have completed but timed out - checking status');
          
          // Verify if purchase went through by checking current entitlements
          try {
            // Wait a moment for purchase to register
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check customer info directly
            const customerInfo = await Purchases.getCustomerInfo();
            const isActive = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]?.isActive ?? false;
            
            if (isActive) {
              console.log('Purchase was successful despite timeout');
              await this.updateUserSubscriptionStatus(true, {
                isActive: true,
                productIdentifier: packageToPurchase.product.identifier,
                purchaseDate: new Date().toISOString(),
                expirationDate: null,
                willRenew: true,
                isLifetime: false
              });
              return true;
            }
          } catch (verifyError) {
            console.error('Error verifying purchase after timeout:', verifyError);
          }
        }
        
        // Check if user canceled the purchase (don't throw in this case)
        if (purchaseError.userCancelled) {
          return false;
        }
        
        throw purchaseError;
      }
    } catch (error: any) {
      console.error('Error purchasing package:', error);
      
      // Check if user canceled the purchase (don't throw in this case)
      if (error.userCancelled) {
        return false;
      }
      
      throw error;
    }
  }

  static async restorePurchases(): Promise<boolean> {
    try {
      console.log('Restoring purchases...');
      // Get the customer info directly from restorePurchases
      const customerInfo = await Purchases.restorePurchases();
      
      // Access entitlement safely with optional chaining
      // In this case, the response IS the CustomerInfo object, not containing it
      const isSubscribed = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]?.isActive ?? false;
      
      if (isSubscribed) {
        console.log('Purchases restored successfully');
        // Update the subscription status in our backend
        const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
        
        if (entitlement) {
          await this.updateUserSubscriptionStatus(true, {
            isActive: true,
            productIdentifier: entitlement.productIdentifier,
            purchaseDate: entitlement.latestPurchaseDate || null,
            expirationDate: entitlement.expirationDate || null,
            willRenew: entitlement.willRenew,
            isLifetime: entitlement.periodType === "LIFETIME"
          });
        }
      } else {
        console.log('No active subscriptions found during restore');
      }
      
      return isSubscribed;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  }

  static async checkSubscriptionStatus(customerInfo?: CustomerInfo): Promise<boolean> {
    try {
      console.log('Checking subscription status...');
      
      // Try to use cache for faster response
      const cachedStatusStr = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
      if (cachedStatusStr) {
        try {
          const cachedStatus = JSON.parse(cachedStatusStr);
          const cacheAge = Date.now() - cachedStatus.timestamp;
          
          // Use cache if it's less than 5 minutes old
          if (cacheAge < 300000) {
            console.log('Using cached subscription status:', cachedStatus.status);
            return cachedStatus.status;
          }
        } catch (parseError) {
          console.error('Error parsing cached status:', parseError);
        }
      }
      
      // If no valid cache, check with RevenueCat
      let info: CustomerInfo;
      
      if (customerInfo) {
        info = customerInfo;
      } else {
        // getCustomerInfo returns the CustomerInfo object directly
        info = await Purchases.getCustomerInfo();
      }
      
      // Fixed: Safe property access with optional chaining
      const isActive = info?.entitlements?.active?.[ENTITLEMENT_ID]?.isActive ?? false;
      
      console.log('Subscription status from RevenueCat:', isActive);
      
      // Update cache
      await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        status: isActive
      }));
      
      return isActive;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      
      // If there's an error, try to use cached value if available
      try {
        const cachedStatusStr = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
        if (cachedStatusStr) {
          const cachedStatus = JSON.parse(cachedStatusStr);
          console.log('Using cached status due to error:', cachedStatus.status);
          return cachedStatus.status;
        }
      } catch (cacheError) {
        console.error('Error reading cached status:', cacheError);
      }
      
      return false;
    }
  }

  static async getSubscriptionDetails(): Promise<SubscriptionDetails> {
    try {
      console.log('Getting subscription details...');
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      
      if (!entitlement) {
        console.log('No active entitlement found');
        return {
          isActive: false,
          expirationDate: null,
          purchaseDate: null,
          productIdentifier: null,
          isLifetime: false,
          willRenew: false
        };
      }
      
      console.log('Found active entitlement:', entitlement.identifier);
      
      // Fixed: Access entitlement properties correctly
      return {
        isActive: entitlement.isActive,
        expirationDate: entitlement.expirationDate || null,
        // Fixed: Use proper property names based on SDK
        purchaseDate: entitlement.latestPurchaseDate || null,
        productIdentifier: entitlement.productIdentifier,
        isLifetime: entitlement.periodType === "LIFETIME",
        willRenew: entitlement.willRenew
      };
    } catch (error) {
      console.error('Error getting subscription details:', error);
      return {
        isActive: false,
        expirationDate: null, 
        purchaseDate: null,
        productIdentifier: null,
        isLifetime: false,
        willRenew: false
      };
    }
  }

  static async updateUserSubscriptionStatus(
    isSubscribed: boolean, 
    details?: SubscriptionDetails
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user logged in, skipping subscription status update');
        return;
      }
      
      console.log('Updating user subscription status:', isSubscribed);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription: {
            active: isSubscribed,
            tier: 'premium',
            updated_at: new Date().toISOString(),
            expiration: details?.expirationDate || null,
            product_id: details?.productIdentifier || null
          } 
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error updating subscription in database:', error);
      } else {
        console.log('Subscription status updated in database');
      }
    } catch (error) {
      console.error('Error updating subscription status:', error);
    }
  }

  // Helper methods for mocks and formatting
  private static getFormattedPackageTitle(packageType: string): string {
    switch (packageType) {
      case 'MONTHLY':
        return 'Monthly Premium';
      case 'ANNUAL':
      case 'YEARLY':
        return 'Annual Premium';
      case 'LIFETIME':
        return 'Lifetime Access';
      default:
        return `${packageType} Premium`;
    }
  }

  private static getDefaultDescription(packageType: string): string {
    switch (packageType) {
      case 'MONTHLY':
        return 'Unlimited conversations with monthly billing';
      case 'ANNUAL':
      case 'YEARLY':
        return 'Save 33% with annual billing';
      case 'LIFETIME':
        return 'One-time purchase for lifetime access';
      default:
        return 'Unlock all premium features';
    }
  }

  private static getPackageFeatures(packageType: string): string[] {
    const baseFeatures = [
      'Unlimited conversations',
      'Advanced language models',
      'No ads',
      'Priority support'
    ];
    
    switch (packageType) {
      case 'ANNUAL':
      case 'YEARLY':
        return [
          'All monthly features',
          '33% discount compared to monthly',
          'Advanced language customization',
          'Premium support'
        ];
      case 'LIFETIME':
        return [
          'All premium features',
          'One-time payment',
          'Free upgrades forever',
          'VIP support'
        ];
      default:
        return baseFeatures;
    }
  }

  private static getMockPackages(): SubscriptionPackage[] {
    return [
      {
        identifier: 'mock_monthly',
        title: 'Monthly Premium',
        description: 'Unlimited conversations with monthly billing',
        price: 14.99,
        period: 'month',
        features: [
          'Unlimited conversations',
          'Advanced language models',
          'No ads',
          'Priority support'
        ]
      },
      {
        identifier: 'mock_yearly',
        title: 'Annual Premium',
        description: 'Save 33% with annual billing',
        price: 119.99,
        period: 'year',
        features: [
          'All monthly features',
          '33% discount compared to monthly',
          'Advanced language customization',
          'Premium support'
        ]
      }
    ];
  }

  private static getExpirationDate(packageId: string): string {
    const now = new Date();
    if (packageId === 'mock_monthly') {
      now.setMonth(now.getMonth() + 1);
    } else if (packageId === 'mock_yearly') {
      now.setFullYear(now.getFullYear() + 1);
    } else if (packageId === 'mock_lifetime') {
      // Far future date
      now.setFullYear(now.getFullYear() + 100);
    }
    return now.toISOString();
  }
}