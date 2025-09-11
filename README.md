# Overlay - AI-Powered Dictation App

A cross-platform desktop application built with Electron that captures spoken thoughts, transcribes them using AI, and automatically inserts text into any application. Features intelligent speech-to-text, optional AI refinement, and seamless system integration.

## ✨ Features

### Core Functionality
- **Global Hotkey Activation**: `Option+Space` (macOS) or `Ctrl+Windows+Space` (Windows) to start/stop recording
- **Always-Visible Recording UI**: Pill-shaped interface at the bottom of screen showing recording status
- **AI Transcription**: Multiple providers (Deepgram, OpenAI Whisper) for accurate speech-to-text
- **AI Text Refinement**: Optional GPT-4 powered text improvement and grammar correction
- **Cross-Platform Text Insertion**: Custom text insertion service (replaces RobotJS for better reliability)

### Advanced Features  
- **Multi-Window Architecture**: Specialized windows for main UI, recording status, and notifications
- **Dictionary Replacements**: Custom word/phrase replacements and shortcuts
- **Language Selection**: Choose transcription language or auto-detect
- **User Authentication**: Secure login with magic links or Google OAuth
- **Cloud Sync**: Save transcripts and settings to cloud (Supabase backend)
- **Usage Analytics**: Optional PostHog integration for app improvement

### Output Modes
- **Auto-insert**: Automatically types text into active application
- **Copy to clipboard**: Places text in system clipboard  
- **Both**: Performs auto-insert and clipboard copy

### User Experience
- **Onboarding Flow**: Guided setup for new users with permissions and preferences
- **System Tray Integration**: Quick access to settings and controls
- **Subscription Tiers**: Free and Pro tiers with feature differentiation
- **Privacy Focused**: Transparent about data usage and storage

## 🚀 Installation

### Download Pre-built Releases
1. Visit [Releases](https://github.com/Thinking-Sound-Lab/Overlay/releases)
2. Download the installer for your platform:
   - **Windows**: `.exe` installer
   - **macOS**: `.dmg` installer
3. Run the installer and follow setup instructions

### System Requirements
- **macOS**: 10.15+ (Catalina or later)
- **Windows**: Windows 10/11
- **Microphone access**: Required for speech recording
- **Internet connection**: Required for AI transcription services

## ⚙️ Development Setup

### Prerequisites
- Node.js 18+
- npm (comes with Node.js)
- Git

### Local Development
```bash
# Clone repository
git clone https://github.com/Thinking-Sound-Lab/Overlay.git
cd overlay

# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test
npm run test:e2e

# Build for production
npm run make
```

### Environment Configuration
Create `.env.development` file:
```env
# Required API Keys
OPENAI_API_KEY=your-openai-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
BASETEN_API_KEY=your-baseten-api-key

# Supabase Configuration
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key

# Analytics (Optional)
REACT_APP_POSTHOG_KEY=your-posthog-key
REACT_APP_POSTHOG_HOST=your-posthog-host
```

## 🏗️ Architecture

### Electron Multi-Process Design
- **Main Process**: System integration, services, window management
- **Renderer Process**: React UI running in Chromium
- **Preload Scripts**: Secure IPC bridge between main and renderer

### Core Services
- **STTService**: Speech-to-text with multiple provider support
- **TextInsertionService**: Cross-platform text automation
- **MicrophoneService**: Audio capture and device management
- **WindowManager**: Multi-window coordination
- **DataLoaderService**: Cache-first data loading with Supabase
- **TranslationService**: AI-powered text refinement

### Data Architecture
- **Database**: Supabase (PostgreSQL) for user data and transcripts
- **Caching**: In-memory cache-first strategy for performance
- **Authentication**: Supabase Auth with magic links and Google OAuth

## 🔧 Configuration

### API Keys Setup
1. **OpenAI**: Get key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Deepgram**: Register at [Deepgram](https://deepgram.com/) for speech-to-text
3. **Baseten**: Sign up at [Baseten](https://baseten.co/) for additional AI services

### Permissions Setup
#### macOS
- **Microphone**: System Preferences > Security & Privacy > Microphone
- **Accessibility**: System Preferences > Security & Privacy > Privacy > Accessibility (for text insertion)

#### Windows  
- **Microphone**: Settings > Privacy > Microphone
- **Run as Administrator**: May be required for text insertion in some apps

## 📱 Usage

### Quick Start
1. Launch Overlay - recording pill appears at bottom of screen
2. Complete onboarding flow (authentication, language selection, permissions)
3. Hold `Option+Space` (macOS) or `Ctrl+Windows+Space` (Windows)
4. Speak while holding the hotkey
5. Release to stop - text is transcribed and inserted automatically

### Advanced Features
- **Dictionary**: Add custom word replacements in settings
- **Language Selection**: Choose transcription language for accuracy
- **AI Refinement**: Enable for improved grammar and formatting
- **Transcript History**: View and manage past transcriptions
- **Export Data**: Download your transcripts and settings

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage

# All tests (CI command)
npm run test:ci
```

### Test Structure
- **Unit Tests**: Jest for main and renderer processes
- **E2E Tests**: Playwright for full application testing
- **Integration Tests**: Service and API integration testing

## 🔄 CI/CD Pipeline

### CircleCI Integration
- **Pull Requests**: Fast testing and linting workflow (ESLint, unit tests, e2e tests)
- **Main Branch**: Full pipeline (test + lint → build → release)
- **Automatic Releases**: GitHub releases created on main branch merges
- **Cross-Platform Builds**: Windows and macOS distributables

### Build Commands
```bash
# Platform-specific builds
npm run make:win     # Windows
npm run make:mac     # macOS

# Linting and quality
npm run lint
```

## 🛠️ Development Commands

All available npm scripts:
```bash
# Development
npm start                 # Start development server
npm run oauth-server     # OAuth callback server

# Building
npm run make             # Build for current platform
npm run make:win         # Windows build
npm run make:mac         # macOS build
npm run package          # Package without distribution

# Testing
npm test                 # Unit tests
npm run test:e2e         # End-to-end tests
npm run test:coverage    # Coverage report
npm run lint             # ESLint
```

## 🐛 Troubleshooting

### Common Issues

#### Recording Not Working
- Check microphone permissions in system settings
- Verify microphone access in app settings
- Test microphone with built-in tester

#### Text Insertion Failing
- **macOS**: Grant Accessibility permissions in System Preferences
- **Windows**: Try running as administrator
- Check if target application allows programmatic text input

#### Hotkey Not Responding
- Ensure no other apps use the same hotkey combination
- Try alternative hotkey combinations in settings
- Restart app after changing hotkey settings

#### API Errors
- Verify API keys are correct and have sufficient credits
- Check internet connection
- Ensure API keys have access to required models

### Performance Tips
- Close unused applications to free system resources
- Use wired internet connection for best transcription speed
- Keep app updated for latest performance improvements

## 🤝 Contributing

### Getting Started
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes following project conventions
4. Add tests for new functionality
5. Run test suite: `npm run test:ci`
6. Submit pull request

### Development Guidelines
- Follow TypeScript strict mode
- Use existing code patterns and architecture
- Add JSDoc comments for complex functions
- Ensure all tests pass before submitting PR

### Code Style
- ESLint configuration enforced
- Prettier formatting applied
- No comments unless absolutely necessary (clean code principle)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Bug Reports**: [GitHub Issues](https://github.com/Thinking-Sound-Lab/Overlay/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/Thinking-Sound-Lab/Overlay/discussions)
- **Documentation**: Check [CIRCLECI_SETUP.md](CIRCLECI_SETUP.md) for CI/CD setup

## 🏢 Privacy & Security

- **Local Processing**: Speech data processed through secure APIs only
- **Data Encryption**: All user data encrypted in transit and at rest
- **Minimal Data Collection**: Only necessary data collected for functionality
- **User Control**: Full control over data retention and deletion

---

**⚠️ Important**: This application requires microphone access and system-level permissions for text insertion. Please review your organization's security policies before installation.