// Jest setup for renderer process tests
import '@testing-library/jest-dom';

// Mock the Electron API in renderer context
Object.defineProperty(window, 'electronAPI', {
  value: {
    // IPC methods
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    
    // Auth methods
    signInWithMagicLink: jest.fn(),
    signUpWithMagicLink: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
    getCurrentUser: jest.fn(),
    deleteAccount: jest.fn(),
    getUserProfile: jest.fn(),
    completeOnboarding: jest.fn(),
    
    // Database methods
    saveTranscript: jest.fn(),
    getTranscripts: jest.fn(),
    saveUserSettings: jest.fn(),
    getUserSettings: jest.fn(),
    getUserStats: jest.fn(),
    
    // Analytics methods
    trackEvent: jest.fn(),
    identifyUser: jest.fn(),
    trackUserSignUp: jest.fn(),
    trackUserSignIn: jest.fn(),
    trackUserSignOut: jest.fn(),
    trackRecordingStarted: jest.fn(),
    trackRecordingStopped: jest.fn(),
    trackTranscriptionCompleted: jest.fn(),
    trackAppLaunched: jest.fn(),
    
    // Microphone methods
    getMicrophoneDevices: jest.fn(),
    validateMicrophoneDevice: jest.fn(),
    getMicrophoneConstraints: jest.fn(),
    getCurrentDeviceConstraints: jest.fn(),
    setCurrentDevice: jest.fn(),
    requestMicrophonePermissions: jest.fn(),
    checkMicrophonePermissions: jest.fn(),
    
    // Window control
    closeWindow: jest.fn(),
    minimizeWindow: jest.fn(),
    maximizeWindow: jest.fn(),
    getMaximizedState: jest.fn(),
    
    // Other methods
    openExternalLink: jest.fn(),
    onAuthenticationComplete: jest.fn(),
    refreshAuthState: jest.fn(),
    expandRecordingWindow: jest.fn(),
    compactRecordingWindow: jest.fn(),
    checkAccessibilityPermission: jest.fn(),
    requestAccessibilityPermission: jest.fn(),
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    installUpdate: jest.fn(),
  },
  writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {
    // Mock constructor
  }
  disconnect() {
    // Mock disconnect
  }
  observe() {
    // Mock observe
  }
  unobserve() {
    // Mock unobserve
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {
    // Mock constructor
  }
  disconnect() {
    // Mock disconnect
  }
  observe() {
    // Mock observe
  }
  unobserve() {
    // Mock unobserve
  }
};

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock match media
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('')),
  },
  writable: true,
});

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{
        stop: jest.fn()
      }]
    })),
    enumerateDevices: jest.fn(() => Promise.resolve([
      {
        deviceId: 'default',
        kind: 'audioinput',
        label: 'Default Microphone',
        groupId: 'default'
      }
    ])),
  },
  writable: true,
});

// Console setup for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string') {
    if (
      message.includes('Warning: ReactDOM.render is no longer supported') ||
      message.includes('Warning: React.createFactory() is deprecated') ||
      message.includes('Warning: componentWillReceiveProps has been renamed')
    ) {
      return;
    }
  }
  originalConsoleError(...args);
};

// Set test timeout
jest.setTimeout(10000);