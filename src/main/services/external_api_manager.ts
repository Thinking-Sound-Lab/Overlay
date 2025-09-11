import { SupabaseService } from './supabase_service';
import { AnalyticsService } from './analytics_service';

export class ExternalAPIManager {
  private supabaseService: SupabaseService;
  private analyticsService: AnalyticsService;
  private isInitialized = false;

  constructor() {
    try {
      this.supabaseService = new SupabaseService();
      this.analyticsService = new AnalyticsService();
      

      this.isInitialized = true;
      console.log('ExternalAPIManager: Successfully initialized');
    } catch (error) {
      console.error('ExternalAPIManager: Initialization failed:', error);
      throw error;
    }
  }

  // Getters for services
  get supabase() {
    if (!this.isInitialized) {
      throw new Error('ExternalAPIManager not initialized');
    }
    return this.supabaseService;
  }

  get analytics() {
    if (!this.isInitialized) {
      throw new Error('ExternalAPIManager not initialized');
    }
    return this.analyticsService;
  }

  // Authentication methods
  async signInWithMagicLink(email: string) {
    return await this.supabaseService.signInWithMagicLink(email);
  }

  async signUpWithMagicLink(email: string, name: string) {
    return await this.supabaseService.signUpWithMagicLink(email, name);
  }

  async signInWithGoogle() {
    return await this.supabaseService.signInWithGoogle();
  }

  async signOut() {
    return await this.supabaseService.signOut();
  }

  getCurrentUser() {
    return this.supabaseService.getCurrentUser();
  }

  async deleteAccount() {
    return await this.supabaseService.deleteAccount();
  }

  async getUserProfile() {
    return await this.supabaseService.getUserProfile();
  }

  async createUserProfile() {
    return await this.supabaseService.createUserProfile();
  }

  // Cleanup method
  async shutdown() {
    console.log('ExternalAPIManager: Shutting down services...');
    try {
      await this.analyticsService.shutdown();
      console.log('ExternalAPIManager: Successfully shut down');
    } catch (error) {
      console.error('ExternalAPIManager: Shutdown error:', error);
    }
  }
}