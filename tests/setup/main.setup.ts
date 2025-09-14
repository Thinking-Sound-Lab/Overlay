// Jest setup for main process tests
import 'jest';

// Mock the main index file to prevent Electron app initialization during tests
jest.mock('../../src/main/index', () => ({}));

// Mock Electron modules for main process tests
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    on: jest.fn(),
    setAsDefaultProtocolClient: jest.fn(),
    requestSingleInstanceLock: jest.fn(() => true),
    getVersion: jest.fn(() => '1.0.2'),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      executeJavaScript: jest.fn(),
      once: jest.fn(),
    },
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn(() => false),
    focus: jest.fn(),
  })),
  shell: {
    openExternal: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(),
  },
  globalShortcut: {
    register: jest.fn(),
    unregisterAll: jest.fn(),
  },
  Menu: {
    buildFromTemplate: jest.fn(),
  },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
  })),
  nativeImage: {
    createFromPath: jest.fn(() => ({
      resize: jest.fn(),
    })),
  },
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    clear: jest.fn(),
  }));
});

// Mock electron-updater
jest.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    setFeedURL: jest.fn(),
    on: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn(),
  },
}));

// Mock external services
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      onAuthStateChange: jest.fn(),
      signInWithOtp: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      setSession: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
  })),
}));

// Mock Deepgram SDK
jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    listen: {
      live: jest.fn(() => ({
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
      })),
      prerecorded: jest.fn(),
    },
  })),
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// Mock PostHog
jest.mock('posthog-node', () => ({
  PostHog: jest.fn(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    shutdown: jest.fn(),
  })),
}));

// Console setup for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out expected warnings/errors during tests
  const message = args[0];
  if (typeof message === 'string') {
    if (
      message.includes('Warning: ReactDOM.render is no longer supported') ||
      message.includes('Warning: React.createFactory() is deprecated')
    ) {
      return;
    }
  }
  originalConsoleError(...args);
};

// Set test timeout
jest.setTimeout(10000);