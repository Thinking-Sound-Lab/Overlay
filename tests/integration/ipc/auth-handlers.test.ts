// Integration tests for IPC authentication handlers
import { APIHandlers } from '../../../src/main/ipc/api_handlers';
import { createMockUser } from '../../helpers/test-utils';

// RobotJS has been removed from the project

// Mock dependencies
jest.mock('../../../src/main/services/external_api_manager');
jest.mock('../../../src/main/windows/window-manager');

describe('APIHandlers - Authentication Integration', () => {
  let apiHandlers: APIHandlers;
  let mockApiManager: any;
  let mockWindowManager: any;
  let mockSupabase: any;

  beforeEach(() => {
    // Create Jest mock functions for supabase service
    mockSupabase = {
      signInWithMagicLink: jest.fn(),
      signUpWithMagicLink: jest.fn(),
      signInWithGoogle: jest.fn(),
      signOut: jest.fn(),
      getCurrentUser: jest.fn(),
      deleteAccount: jest.fn(),
      getUserProfile: jest.fn(),
      setSessionWithTokens: jest.fn(),
    };

    // Create mock API manager with supabase service
    mockApiManager = {
      supabase: mockSupabase
    };

    // Create mock window manager
    mockWindowManager = {
      sendToMain: jest.fn(),
      sendToRecording: jest.fn(),
      sendToInformation: jest.fn(),
      showInformation: jest.fn(),
      hideInformation: jest.fn(),
    };

    // Initialize APIHandlers
    apiHandlers = new APIHandlers(mockApiManager, mockWindowManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Magic Link Authentication', () => {
    it('should handle sign in with magic link successfully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const credentials = { email: 'test@example.com' };
      const expectedResult = { success: true, message: 'Magic link sent' };

      mockSupabase.signInWithMagicLink.mockResolvedValue(expectedResult);

      // Access private method for testing
      const result = await (apiHandlers as any).handleSignInWithMagicLink(mockEvent, credentials);

      expect(mockSupabase.signInWithMagicLink).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual({
        success: true,
        data: expectedResult,
      });
    });

    it('should handle sign up with magic link successfully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const credentials = { email: 'test@example.com', name: 'Test User' };
      const expectedResult = { success: true, message: 'Magic link sent' };

      mockSupabase.signUpWithMagicLink.mockResolvedValue(expectedResult);

      const result = await (apiHandlers as any).handleSignUpWithMagicLink(mockEvent, credentials);

      expect(mockSupabase.signUpWithMagicLink).toHaveBeenCalledWith('test@example.com', 'Test User');
      expect(result).toEqual({
        success: true,
        data: expectedResult,
      });
    });

    it('should validate required email for magic link sign in', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const credentials = { email: '' };

      const result = await (apiHandlers as any).handleSignInWithMagicLink(mockEvent, credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email is required');
      expect(mockSupabase.signInWithMagicLink).not.toHaveBeenCalled();
    });

    it('should validate required fields for magic link sign up', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const credentials = { email: 'test@example.com', name: '' };

      const result = await (apiHandlers as any).handleSignUpWithMagicLink(mockEvent, credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email and name are required');
      expect(mockSupabase.signUpWithMagicLink).not.toHaveBeenCalled();
    });
  });

  describe('Google OAuth Authentication', () => {
    it('should initiate Google OAuth and open external browser', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const mockOAuthUrl = 'https://accounts.google.com/oauth/authorize?...';
      
      mockSupabase.signInWithGoogle.mockResolvedValue({
        data: { url: mockOAuthUrl },
        error: null,
      });

      // Mock the dynamic import of electron shell
      const mockShell = { openExternal: jest.fn().mockResolvedValue(true) };
      jest.doMock('electron', () => ({ shell: mockShell }), { virtual: true });

      const result = await (apiHandlers as any).handleSignInWithGoogle(mockEvent);

      expect(mockSupabase.signInWithGoogle).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('Google OAuth initiated');
    });

    it('should handle Google OAuth URL generation failure', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      
      mockSupabase.signInWithGoogle.mockResolvedValue({
        data: { url: null },
        error: null,
      });

      const result = await (apiHandlers as any).handleSignInWithGoogle(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initiate Google OAuth');
    });

    it('should handle Google OAuth service error', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      
      mockSupabase.signInWithGoogle.mockRejectedValue(new Error('OAuth service unavailable'));

      const result = await (apiHandlers as any).handleSignInWithGoogle(mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth service unavailable');
    });
  });

  describe('User Management', () => {
    it('should get current user successfully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const mockUser = createMockUser();
      
      mockSupabase.getCurrentUser.mockReturnValue(mockUser);

      const result = await (apiHandlers as any).handleGetCurrentUser(mockEvent);

      expect(result.success).toBe(true);
      expect(result.data.data.user).toEqual(mockUser);
    });

    it('should handle sign out successfully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      
      mockSupabase.signOut.mockResolvedValue({ success: true });

      const result = await (apiHandlers as any).handleSignOut(mockEvent);

      expect(mockSupabase.signOut).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle delete account successfully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      
      mockSupabase.deleteAccount.mockResolvedValue({ success: true });

      const result = await (apiHandlers as any).handleDeleteAccount(mockEvent);

      expect(mockSupabase.deleteAccount).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should get user profile successfully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const mockProfile = { name: 'Test User', avatar_url: 'https://example.com/avatar.jpg' };
      
      mockSupabase.getUserProfile.mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const result = await (apiHandlers as any).handleGetUserProfile(mockEvent);

      expect(result.success).toBe(true);
      expect(result.data.data).toEqual(mockProfile);
    });
  });

  describe('Sender Validation', () => {
    it('should reject requests from invalid senders', async () => {
      const invalidEvent = { sender: null } as any;
      const credentials = { email: 'test@example.com' };

      const result = await (apiHandlers as any).handleSignInWithMagicLink(invalidEvent, credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(mockSupabase.signInWithMagicLink).not.toHaveBeenCalled();
    });

    it('should reject requests from senders without getURL method', async () => {
      const invalidEvent = { sender: { someOtherMethod: jest.fn() } } as any;
      const credentials = { email: 'test@example.com' };

      const result = await (apiHandlers as any).handleSignInWithMagicLink(invalidEvent, credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should accept requests from valid senders', async () => {
      const validEvent = { 
        sender: { 
          getURL: jest.fn(() => 'http://localhost'),
        } 
      } as any;
      const credentials = { email: 'test@example.com' };

      mockSupabase.signInWithMagicLink.mockResolvedValue({ success: true });

      const result = await (apiHandlers as any).handleSignInWithMagicLink(validEvent, credentials);

      expect(result.success).toBe(true);
      expect(mockSupabase.signInWithMagicLink).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const credentials = { email: 'test@example.com' };
      
      const serviceError = new Error('Database connection failed');
      mockSupabase.signInWithMagicLink.mockRejectedValue(serviceError);

      const result = await (apiHandlers as any).handleSignInWithMagicLink(mockEvent, credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle unknown errors', async () => {
      const mockEvent = { sender: { getURL: jest.fn(() => 'http://localhost') } } as any;
      const credentials = { email: 'test@example.com' };
      
      mockSupabase.signInWithMagicLink.mockRejectedValue('Unknown error');

      const result = await (apiHandlers as any).handleSignInWithMagicLink(mockEvent, credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});