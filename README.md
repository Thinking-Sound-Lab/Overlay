# Overlay - AI-Powered Dictation App

A cross-platform desktop application (Electron) that allows users to quickly capture spoken thoughts, transcribe them into text using AI, and automatically insert the transcribed text into the currently active text field in any application.

## Features

- **Global Hotkey Activation**: Hold `option + space` key (macOS) or `Ctrl+Shift+Space` (Windows/Linux) to start recording, release to stop
- **Always-Visible Recording UI**: Pill-shaped interface at the bottom of the screen that's always present
- **AI Transcription**: Uses OpenAI Whisper API for accurate speech-to-text conversion
- **AI Refinement**: Optional GPT-4 powered text improvement for better grammar and formatting
- **Multiple Output Modes**:
  - Auto-insert into active application
  - Copy to clipboard
  - Both (insert + clipboard)
- **System Tray Integration**: Access settings and controls from the system tray
- **Multi-language Support**: Auto-detect or specify language for transcription
- **Privacy Focused**: Clear about data usage and local storage

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key (for transcription functionality)

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd overlay
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. Build for production:

```bash
npm run make
```

## Configuration

### OpenAI API Setup

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Open the app settings
3. Enter your API key in the "OpenAI API Key" field
4. Save settings

### Hotkey Configuration

The app supports several global hotkey combinations:

- `Cmd+Shift+Space` / `Ctrl+Shift+Space` (default)
- `Cmd+Shift+R` / `Ctrl+Shift+R`
- `Cmd+Shift+D` / `Ctrl+Shift+D`

### Output Mode

Choose how transcribed text is handled:

- **Auto-insert**: Automatically types text into the active application
- **Clipboard**: Copies text to system clipboard
- **Both**: Performs both actions

## Usage

### Basic Workflow

1. App runs in background with tray icon.
2. **Pill-shaped recording UI is always visible** at the bottom of the screen.
3. **Hold** the activation hotkey (e.g., `F1` key on macOS).
4. Recording UI shows "Recording..." and starts listening.
5. **Keep holding** while speaking.
6. **Release the hotkey** to stop recording.
7. App transcribes audio.
8. If enabled, app refines transcription with AI.
9. App outputs text per user settings (auto-insert / clipboard).
10. UI returns to "Ready to record" state.

### System Tray

Right-click the system tray icon to:

- Show Settings
- Start Recording
- Quit Application

### Settings Window

Access comprehensive configuration options:

- Hotkey preferences
- Output mode selection
- Language settings
- AI refinement options
- Microphone testing

## Development

### Project Structure

```
src/
├── main/           # Main process (Electron)
├── renderer/       # Renderer process (React UI)
├── preload/        # Preload scripts for IPC
└── shared/         # Shared types and utilities
```

### Key Technologies

- **Electron**: Cross-platform desktop app framework
- **React**: UI framework for the renderer process
- **TypeScript**: Type-safe JavaScript development
- **OpenAI API**: Speech-to-text and text refinement
- **RobotJS**: System automation for text insertion

### Building

```bash
# Development
npm start

# Production build
npm run make

# Package for distribution
npm run package
```

## Troubleshooting

### Microphone Access

- **macOS**: Ensure microphone access is granted in System Preferences > Security & Privacy > Microphone
- **Windows**: Check microphone permissions in Windows Settings > Privacy > Microphone
- **Linux**: Verify microphone permissions and PulseAudio configuration

### Global Hotkey Issues

- Ensure no other applications are using the same hotkey combination
- On macOS, check System Preferences > Keyboard > Shortcuts for conflicts
- Restart the app after changing hotkey settings

### OpenAI API Errors

- Verify your API key is correct and has sufficient credits
- Check internet connectivity
- Ensure the API key has access to Whisper and GPT-4 models

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Note**: This app requires microphone access and may need system-level permissions for text insertion functionality. Please review the privacy policy and ensure compliance with your organization's security policies.
