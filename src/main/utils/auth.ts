import { ExternalAPIManager } from "../services/external_api_manager";

/**
 * Centralized authentication utility
 */
export class AuthUtils {
  private static apiManager: ExternalAPIManager | null = null;
  private static isAuthenticated = false;

  public static setAuthManager(apiManager: ExternalAPIManager | null): void {
    this.apiManager = apiManager;
  }

  public static setAuthenticationState(authenticated: boolean): void {
    this.isAuthenticated = authenticated;
  }

  /**
   * Checks if the user is currently authenticated
   * @returns true if user is authenticated and has a valid session
   */
  public static isUserAuthenticated(): boolean {
    return this.isAuthenticated && !!this.apiManager?.supabase.getCurrentUser();
  }

  /**
   * Logs authentication status for debugging
   * @param context Optional context string for logging
   */
  public static logAuthStatus(context?: string): void {
    const prefix = context ? `[${context}]` : '[Auth]';
    if (!this.isUserAuthenticated()) {
      console.log(`${prefix} User not authenticated`);
    }
  }

  /**
   * Gets the current user if authenticated
   * @returns Current user object or null
   */
  public static getCurrentUser() {
    if (!this.isUserAuthenticated()) {
      return null;
    }
    return this.apiManager?.supabase.getCurrentUser() || null;
  }
}