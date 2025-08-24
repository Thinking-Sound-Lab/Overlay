import { SupabaseService } from './supabase_service';
import { AnalyticsService } from './analytics_service';
import { User } from '@supabase/supabase-js';

export class ExternalAPIManager {
  private supabaseService: SupabaseService;
  private analyticsService: AnalyticsService;
  private isInitialized = false;

  constructor() {
    try {
      this.supabaseService = new SupabaseService();
      this.analyticsService = new AnalyticsService();
      
      // Set up auth state change listener to sync with analytics
      this.supabaseService.setAuthStateChangeListener((user: User | null) => {
        if (user) {
          this.analyticsService.identify(user.id, {
            email: user.email,
            created_at: user.created_at,
            app_metadata: user.app_metadata,
            user_metadata: user.user_metadata
          });
        }
      });

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
  async signIn(email: string, password: string) {
    return await this.supabaseService.signIn(email, password);
  }

  async signUp(email: string, password: string, name?: string) {
    return await this.supabaseService.signUp(email, password, name);
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