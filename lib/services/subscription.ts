// lib/services/subscription.ts
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
  
  static async identifyUser(userId: string): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      const isSubscribed = this.checkSubscriptionStatus(customerInfo);
      console.log('User identified with RevenueCat, subscription status:', isSubscribed);
      return isSubscribed;
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
        
        if (offerings.current?.availablePackages?.length > 0) {
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
      const packageToPurchase = offerings.current?.availablePackages.find(
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

      // Make the purchase through RevenueCat
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      const isSubscribed = this.checkSubscriptionStatus(customerInfo);
      
      if (isSubscribed) {
        console.log('Purchase successful, updating subscription status');
        // Update the subscription status in our backend
        await this.updateUserSubscriptionStatus(true, await this.getSubscriptionDetails());
      }
      
      return isSubscribed;
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
      const { customerInfo } = await Purchases.restorePurchases();
      const isSubscribed = this.checkSubscriptionStatus(customerInfo);
      
      if (isSubscribed) {
        console.log('Purchases restored successfully');
        // Update the subscription status in our backend
        await this.updateUserSubscriptionStatus(true, await this.getSubscriptionDetails());
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
      const cachedStatus = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
      if (cachedStatus) {
        const { timestamp, status } = JSON.parse(cachedStatus);
        const cacheAge = Date.now() - timestamp;
        
        // Use cache if it's less than 5 minutes old
        if (cacheAge < 300000) {
          console.log('Using cached subscription status:', status);
          return status;
        }
      }
      
      // If no valid cache, check with RevenueCat
      const info = customerInfo || (await Purchases.getCustomerInfo());
      const isActive = info.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false;
      
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
        const cachedStatus = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
        if (cachedStatus) {
          const { status } = JSON.parse(cachedStatus);
          console.log('Using cached status due to error:', status);
          return status;
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
      
      return {
        isActive: entitlement.isActive,
        expirationDate: entitlement.expirationDate,
        purchaseDate: entitlement.purchaseDate,
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