// lib/services/subscription.ts
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const ENTITLEMENT_ID = 'premium_access';

export interface SubscriptionPackage {
  identifier: string;
  title: string;
  description: string;
  price: number;
  period: string;
}

export class SubscriptionService {
  static async initialize() {
    if (Platform.OS === 'android') {
      await Purchases.configure({ apiKey: 'YOUR_GOOGLE_API_KEY' });
    } else if (Platform.OS === 'ios') {
      await Purchases.configure({ apiKey: 'YOUR_APPLE_API_KEY' });
    }
  }

  static async getPackages(): Promise<SubscriptionPackage[]> {
    try {
      const offerings = await Purchases.getOfferings();
      
      if (!offerings.current) {
        throw new Error('No offerings available');
      }

      return offerings.current.availablePackages.map(pkg => ({
        identifier: pkg.identifier,
        title: pkg.packageType,
        description: pkg.presentedData.description || '',
        price: pkg.product.price,
        period: pkg.packageType
      }));
    } catch (error) {
      console.error('Error fetching packages:', error);
      throw error;
    }
  }

  static async purchasePackage(packageId: string): Promise<boolean> {
    try {
      const offerings = await Purchases.getOfferings();
      const package_ = offerings.current?.availablePackages.find(
        pkg => pkg.identifier === packageId
      );

      if (!package_) {
        throw new Error('Package not found');
      }

      const { customerInfo } = await Purchases.purchasePackage(package_);
      return this.checkSubscriptionStatus(customerInfo);
    } catch (error) {
      console.error('Error purchasing package:', error);
      throw error;
    }
  }

  static async restorePurchases(): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      return this.checkSubscriptionStatus(customerInfo);
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  }

  static async checkSubscriptionStatus(customerInfo?: CustomerInfo): Promise<boolean> {
    try {
      const info = customerInfo || (await Purchases.getCustomerInfo());
      return info.entitlements.active[ENTITLEMENT_ID]?.isActive ?? false;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  static async getCurrentPeriodEnd(): Promise<string | null> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active[ENTITLEMENT_ID]?.expirationDate || null;
    } catch (error) {
      console.error('Error getting period end:', error);
      return null;
    }
  }
}