# Testing Guide for Overlay Application

## Overview

This document describes the comprehensive testing strategy implemented for the Overlay Electron application, following 2025 best practices using modern testing tools.

## Testing Architecture

### 📊 Testing Pyramid Structure

```
         🔺 E2E Tests (Playwright)
       🔺🔺🔺 Integration Tests (Jest)
   🔺🔺🔺🔺🔺🔺 Unit Tests (Jest + Testing Library)
```

**Unit Tests (Base Layer)**
- Individual functions, services, utilities
- Fast execution, isolated testing
- High coverage, immediate feedback

**Integration Tests (Middle Layer)**
- Service interactions, IPC communication
- Cross-component functionality
- Business workflow validation

**E2E Tests (Top Layer)**
- Complete user workflows
- Real browser environment
- Critical path validation

## 🧰 Testing Tools & Frameworks

### Core Testing Stack
- **Jest 30.1.3** - Modern JavaScript testing framework
- **Playwright 1.55.0** - End-to-end testing with Electron support
- **Testing Library** - Component testing utilities
- **TypeScript** - Type-safe test development

### Electron-Specific Testing
- **Multi-environment setup** - Separate Node.js and JSDOM environments
- **IPC testing** - Main ↔ Renderer process communication
- **Protocol handling** - Custom `overlay://` URL testing
- **Single-instance testing** - Windows-specific behavior validation

## 📁 Directory Structure

```
tests/
├── unit/                    # Unit tests
│   ├── services/           # Service layer tests
│   ├── utils/              # Utility function tests
│   └── components/         # React component tests
├── integration/            # Integration tests
│   ├── ipc/               # IPC communication tests
│   └── workflows/         # Multi-service workflow tests
├── e2e/                   # End-to-end tests
│   ├── auth/              # Authentication flow tests
│   ├── recording/         # Recording workflow tests
│   └── settings/          # Settings management tests
├── fixtures/              # Test data and fixtures
├── helpers/              # Test utilities and helpers
└── setup/                # Test environment setup
    ├── main.setup.ts     # Main process test setup
    ├── renderer.setup.ts # Renderer process test setup
    ├── global.setup.ts   # Global E2E setup
    └── global.teardown.ts # Global E2E teardown
```

## 🚀 Available Test Commands

### Basic Commands
```bash
npm test                    # Run all unit and integration tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
```

### Specific Test Types
```bash
npm run test:unit           # Run only unit tests
npm run test:integration    # Run only integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:e2e:headed    # Run E2E tests with visible browser
npm run test:e2e:debug     # Run E2E tests in debug mode
```

### CI/CD Commands
```bash
npm run test:all           # Run all tests (unit + integration + E2E)
npm run test:ci            # Run tests optimized for CI environment
```

## 🧪 Test Examples

### Unit Test Example
```typescript
// tests/unit/services/microphone-service.test.ts
describe('MicrophoneService', () => {
  it('should return available audio input devices', async () => {
    const mockDevices = [createMockAudioDevice({ deviceId: 'device1' })];
    mockEnumerateDevices.mockResolvedValue(mockDevices);

    const result = await microphoneService.getAvailableDevices();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      deviceId: 'device1',
      kind: 'audioinput',
    }));
  });
});
```

### Integration Test Example
```typescript
// tests/integration/ipc/auth-handlers.test.ts
describe('APIHandlers - Authentication Integration', () => {
  it('should handle sign in with magic link successfully', async () => {
    const mockEvent = { sender: { getURL: jest.fn() } };
    const credentials = { email: 'test@example.com' };
    
    mockApiManager.supabase.signInWithMagicLink.mockResolvedValue({ success: true });

    const result = await apiHandlers.handleSignInWithMagicLink(mockEvent, credentials);

    expect(result.success).toBe(true);
  });
});
```

### E2E Test Example
```typescript
// tests/e2e/auth/protocol-handling.test.ts
test('should prevent multiple instances when handling OAuth protocol', async () => {
  const electronApp1 = await electron.launch({ args: [mainPath] });
  
  // Attempt to launch second instance should fail
  const electronApp2Promise = electron.launch({ 
    args: [mainPath, 'overlay://callback#access_token=test'],
    timeout: 5000 
  });
  
  await expect(electronApp2Promise).rejects.toThrow('timeout');
});
```

## 🎯 Key Testing Areas

### 1. Windows Protocol Handling (Critical!)
Tests for the recent Windows single-instance fix:
- ✅ Single-instance lock functionality
- ✅ Protocol URL processing in existing instance  
- ✅ Window focus and restoration
- ✅ Malformed URL handling

### 2. Authentication Flows
- Magic link authentication
- Google OAuth integration
- Session management
- Error handling

### 3. Core Services
- Microphone device management
- Speech-to-text processing
- Audio recording workflows
- Settings persistence

### 4. IPC Communication
- Main ↔ Renderer messaging
- Authentication state synchronization
- Error propagation
- Event handling

## 📈 Coverage Goals

### Target Coverage Metrics
- **Unit Tests**: >80% line coverage
- **Integration Tests**: >60% workflow coverage
- **E2E Tests**: 100% critical path coverage

### Coverage Reports
```bash
npm run test:coverage       # Generate coverage report
open coverage/index.html    # View detailed coverage report
```

## 🔧 Mock Strategy

### External Services
All external services are mocked for reliable, fast testing:
- ✅ Supabase (Authentication & Database)
- ✅ OpenAI (AI Enhancement)
- ✅ Deepgram (Speech Recognition)
- ✅ PostHog (Analytics)
- ✅ Electron APIs

### Test Utilities
Comprehensive helper functions available:
- `createMockUser()` - Mock user objects
- `createMockTranscript()` - Mock transcript data
- `createMockSettings()` - Mock app settings
- `createMockAudioDevice()` - Mock audio devices
- `MockMediaStream` - Mock media streams

## 🚨 Critical Test Scenarios

### Windows-Specific Tests
1. **Protocol Redirect Handling**
   - Prevents multiple app instances
   - Focuses existing window
   - Processes OAuth tokens correctly

2. **OAuth Flow Validation**
   - Google OAuth initiation
   - Magic link processing
   - Token extraction and validation
   - Error state handling

3. **Service Integration**
   - Microphone permission handling
   - STT service lifecycle
   - Settings synchronization
   - Window management

## 🔍 Debugging Tests

### Common Issues and Solutions

**Jest Configuration Errors**
```bash
# Install missing environments
npm install --save-dev jest-environment-jsdom
```

**TypeScript Compilation Errors**
```bash
# Check tsconfig.json compatibility
# Ensure proper module resolution
```

**Electron Testing Issues**
```bash
# Use correct Playwright Electron APIs
# Ensure proper app lifecycle management
```

### Debug Commands
```bash
npm run test:e2e:debug     # Debug E2E tests
npm test -- --verbose      # Verbose test output
npm test -- --detectOpenHandles  # Find resource leaks
```

## 📚 Best Practices

### Test Writing Guidelines
1. **Follow AAA Pattern** - Arrange, Act, Assert
2. **Use descriptive test names** - Clearly state what is being tested
3. **Mock external dependencies** - Keep tests isolated and fast
4. **Test error conditions** - Don't just test happy paths
5. **Keep tests focused** - One concept per test

### Performance Optimization
1. **Parallel execution** - Jest runs tests in parallel by default
2. **Smart mocking** - Mock heavy operations
3. **Resource cleanup** - Properly close connections and handles
4. **Selective testing** - Use test patterns for focused runs

## 🏗️ CI/CD Integration

### GitHub Actions Setup
```yaml
- name: Run Tests
  run: |
    npm run test:coverage
    npm run test:e2e
```

### Cross-Platform Testing
Tests are designed to work across:
- ✅ macOS (Darwin)
- ✅ Windows 10/11
- ✅ Linux (Ubuntu)

## 📊 Test Results and Reporting

### HTML Reports
- **Jest Coverage**: `coverage/index.html`
- **Playwright Results**: `test-results/index.html`

### CI Integration
- JUnit XML reports for CI systems
- JSON output for custom reporting
- Coverage data for code quality tools

---

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Your First Test**
   ```bash
   npm test -- --testPathPatterns=microphone-service.test.ts
   ```

3. **Run E2E Tests**
   ```bash
   npm run test:e2e:headed
   ```

4. **Check Coverage**
   ```bash
   npm run test:coverage
   ```

The testing infrastructure is now fully implemented and ready for development! 🎉