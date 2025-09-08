# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm start` - Start development server
- `npm run make` - Build production distributables for current platform  
- `npm run make:win` / `npm run make:mac` - Platform-specific builds
- `npm run lint` - Run ESLint
- `npm test` - Run Jest unit tests
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:coverage` - Run tests with coverage report

## Architecture Overview

### Electron Multi-Process Architecture
Overlay is an Electron application with distinct processes:
- **Main Process** (`src/main/`): Node.js process managing system integration, windows, services
- **Renderer Process** (`src/renderer/`): React UI running in Chromium
- **Preload Scripts** (`src/preload/`): Bridge between main/renderer with secure IPC

### Multi-Window System
Three specialized windows managed by `WindowManager`:
1. **Main Window**: Primary React UI (settings, transcripts, onboarding)
2. **Recording Window**: Always-visible pill at bottom of screen for recording state
3. **Information Window**: Temporary notifications and processing status

### Core Service Architecture
**Service Coordination**:
- `ExternalAPIManager`: Coordinates Supabase (auth/database) + PostHog (analytics)
- `DataLoaderService`: Cache-first data loading (see Data Architecture below)
- `APIHandlers`: IPC bridge connecting renderer requests to main process services

**Specialized Services**:
- `STTService`: Speech-to-text pipeline (Deepgram/OpenAI integration)
- `MicrophoneService`: Cross-platform audio capture and device management  
- `TextInsertionService`: System-level text automation (replaces RobotJS)
- `SystemAudioManager`: Audio muting during recording
- `WindowManager`: Multi-window coordination and messaging
- `TranslationService`: Optional AI-powered text refinement
- `CacheService`: In-memory caching layer

### Authentication & User Flow
**Authentication Methods**:
- Magic link via Supabase Auth (primary)
- Google OAuth with custom protocol handling (`overlay://callback`)

**Onboarding Flow** (`OnboardingFlow.tsx`):
1. **Auth**: Email/Google sign-in
2. **Language Selection**: Choose default language  
3. **Permissions**: System accessibility for text insertion
4. **Guide**: Usage instructions

**Critical Auth Timing**: Main process must initialize all services BEFORE creating main window to prevent auth state loading issues.

### IPC Communication Patterns
**Main → Renderer Events**:
```typescript
windowManager.sendToMain("auth-state-changed", userData)
windowManager.sendToMain("transcript-updated", transcript)
windowManager.sendToMain("statistics-updated", stats)
```

**Renderer → Main Requests**:
All go through preload script exposing `window.electronAPI`:
```typescript
// Renderer calls:
await window.electronAPI.auth.signInWithMagicLink(email)
await window.electronAPI.db.saveTranscript(transcript)

// Main process handles via APIHandlers class
```

### Global Hotkey System
Cross-platform hotkey registration:
- **macOS**: `option+space`
- **Windows**: `ctrl+cmd+space` (cmd maps to Windows key)
- **Linux**: No hotkey support

Hotkey triggers recording start/stop via main process.

# Data Architecture & Caching Strategy

## Core Principle: Database as Single Source of Truth

The application follows a **cache-first, database-authoritative** architecture:

### Caching Strategy Rules:
1. **Database is the single source of truth** - all data originates from DB
2. **Cache-first reads** - always check cache before hitting database
3. **Database-first writes** - always save to DB first, then update cache
4. **Cache serves performance** - cache is purely for speed, not data storage

### Implementation Pattern:
```
Read Flow:
1. Check cache first (cache hit = return immediately)
2. If cache miss → fetch from database  
3. Update cache with fresh data
4. Return data to user

Write Flow:  
1. Save to database first
2. If DB save succeeds → update cache
3. If DB save fails → don't update cache
```

### DataLoaderService Pattern:
- **ALL data operations** must go through DataLoaderService
- **NEVER bypass** DataLoaderService to access Supabase directly
- DataLoaderService handles cache-first logic automatically
- API handlers should call DataLoaderService, not Supabase directly

### Pagination Caching:
- Cache accumulates pages as user navigates
- Cache hit: serve from memory (no DB call)
- Cache miss: fetch from DB + expand cache
- Example: Page1→DB call, Page2→DB call, Back to Page1→cache hit ✅

### Critical: Always Follow This Pattern
When implementing any data fetching:
1. Check if DataLoaderService has the method you need
2. If not, add method to DataLoaderService (don't bypass it)
3. DataLoaderService method should implement cache-first logic
4. API handlers call DataLoaderService, never Supabase directly

## Technology Stack

### Core Technologies
- **Electron 37.x**: Cross-platform desktop app framework
- **React 19.x + TypeScript**: UI with strict typing
- **Tailwind CSS**: Utility-first styling with Radix UI components
- **Webpack**: Bundling via electron-forge

### Backend Integration
- **Supabase**: Authentication + PostgreSQL database
- **PostHog**: Analytics and user tracking
- **Deepgram/OpenAI**: Speech-to-text services

### System Integration
- **electron-updater**: Auto-updates via GitHub releases
- **Text Insertion**: Custom service replacing RobotJS for cross-platform text automation
- **Global Shortcuts**: Native Electron global hotkey registration

### Testing
- **Jest**: Unit testing for main/renderer processes
- **Playwright**: End-to-end testing
- **Testing Library**: React component testing

## Important Development Patterns

### Window Creation Timing
Always create main window AFTER initializing all services to prevent auth state race conditions:
```typescript
// Correct order in main process:
externalAPIManager = new ExternalAPIManager();
dataLoaderService = DataLoaderService.getInstance();
// ... other services
createMainWindow(); // AFTER services
```

### React Event Listener Setup
Add delays when sending initial auth state to ensure React components mount before IPC events:
```typescript
setTimeout(async () => {
  // Send auth state after React mounts
  sendAuthStateToRenderer(userData);
}, 500);
```

### Error Boundaries
Critical flows (auth, recording) should have timeout fallbacks to prevent infinite loading states.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.