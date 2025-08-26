# Windows Deployment Guide for Overlay

## Overview
This guide explains how to build, package, and distribute the Overlay Electron app for Windows using Squirrel.Windows installer and auto-update system.

## Prerequisites

### Development Environment
- Node.js 18+ and npm
- Git for version control
- Windows machine or Windows VM for testing (optional but recommended)
- **Windows icon file**: Create `assets/icon.ico` (256x256px recommended) from existing `assets/icon.png`

### For Production Builds
- **Code Signing Certificate**: Required for auto-updates and Windows Defender compatibility
- **Update Server**: Static hosting or custom server for distributing updates

## Build Commands

### Development
```bash
npm start                    # Start development server
```

### Windows-Specific Builds
```bash
npm run make:win            # Build for all Windows architectures (x64 + ia32)
npm run make:win64          # Build for Windows x64 only  
npm run make:win32          # Build for Windows ia32 only
npm run package:win         # Package without creating installer
```

### Publishing
```bash
npm run publish:win         # Build and publish Windows release
```

## Environment Configuration

### Required Environment Variables
Copy `.env.windows.example` to `.env.windows` and configure:

```bash
# Code Signing (Required for production)
WINDOWS_CERTIFICATE_FILE=path/to/certificate.pfx
WINDOWS_CERTIFICATE_PASSWORD=your_password

# Update Server (Required for auto-updates)
WINDOWS_UPDATE_SERVER_URL=https://your-domain.com/updates/win32
UPDATE_CHANNEL=latest
```

## Code Signing

### Why Code Signing is Required
- **Auto-updates**: Squirrel.Windows requires signed binaries for security
- **Windows Defender**: Prevents false positive malware detection
- **User trust**: Displays publisher information during installation

### Obtaining a Certificate
1. **Commercial Certificate**: Purchase from DigiCert, GlobalSign, or similar CA
2. **EV Certificate**: Extended Validation (recommended for immediate trust)
3. **Self-signed**: For testing only (not recommended for distribution)

### Certificate Setup
```bash
# Option 1: File-based certificate
WINDOWS_CERTIFICATE_FILE=./certs/overlay.pfx
WINDOWS_CERTIFICATE_PASSWORD=your_secure_password

# Option 2: Windows Certificate Store (CI/CD)
CSC_LINK="path/to/certificate.p12"
CSC_KEY_PASSWORD="password"
```

## Auto-Update System

### How It Works
1. **Squirrel.Windows** creates three files:
   - `OverlaySetup.exe` - Main installer
   - `overlay-1.0.0-full.nupkg` - Full application package
   - `RELEASES` - Update manifest file

2. **Update Server** hosts these files at configured URL
3. **electron-updater** checks for updates by reading RELEASES file
4. **Delta updates** download only changed files for efficiency

### Update Server Requirements

#### Static Hosting (Simplest)
Upload build artifacts to any static host:
```
https://your-cdn.com/updates/win32/
├── RELEASES
├── overlay-1.0.0-full.nupkg
├── overlay-1.0.1-delta.nupkg
└── overlay-1.0.1-full.nupkg
```

#### GitHub Releases (Automated)
Configure GitHub Actions with electron-forge publisher:
```javascript
// forge.config.ts
publishers: [
  new GitHubPublisher({
    repository: {
      owner: 'your-username',
      name: 'overlay'
    },
    draft: true
  })
]
```

#### Custom Server
Implement Squirrel-compatible API:
- `GET /RELEASES` - Returns update manifest
- `GET /<package>.nupkg` - Returns package files

## Build Output

### Generated Files
```
out/make/squirrel.windows/x64/
├── OverlaySetup.exe           # Main installer (distribute this)
├── overlay-1.0.0-full.nupkg  # Full package (for update server)
└── RELEASES                   # Update manifest (for update server)
```

### Installation Process
1. User downloads and runs `OverlaySetup.exe`
2. Squirrel installs app to `%LocalAppData%/overlay/`
3. Desktop shortcut and Start Menu entry created
4. App launches automatically after installation

## Distribution Strategies

### Option 1: Direct Download
- Host `OverlaySetup.exe` on your website
- Simple but requires manual update notifications

### Option 2: Auto-Updating Distribution  
- Host installer + update files on CDN/server
- Users get automatic updates via Squirrel
- Recommended for production apps

### Option 3: Microsoft Store
- Convert Squirrel output to MSIX package
- Distribute through Microsoft Store
- Requires Microsoft Partner Center account

## Testing

### Local Testing
```bash
# Build Windows installer
npm run make:win

# Test installer on Windows machine
./out/make/squirrel.windows/x64/OverlaySetup.exe
```

### Update Testing
1. Build version 1.0.0 and install
2. Build version 1.0.1 with higher version number
3. Host update files on local server
4. Verify auto-update downloads and installs correctly

### Cross-Platform Building
While you can build Windows installers on macOS/Linux, testing requires Windows:
- Use Windows VM or dual-boot for testing
- Consider GitHub Actions for automated Windows builds
- Wine is required for some Windows-specific operations on non-Windows systems

## Troubleshooting

### Common Issues

#### "App not signed" warnings
- **Solution**: Obtain and configure code signing certificate
- **Temporary**: Users can bypass by clicking "More info" → "Run anyway"

#### Auto-updates not working
- **Check**: Certificate configuration and update server URL
- **Verify**: RELEASES file is accessible and properly formatted
- **Debug**: Enable logging with `DEBUG=electron-updater`

#### Build fails on non-Windows systems
- **Install**: Wine for Windows-specific operations
- **Alternative**: Use GitHub Actions or Windows CI for builds

#### Antivirus false positives
- **Solution**: Code signing certificate (especially EV certificates)
- **Report**: Submit binaries to antivirus vendors for whitelisting

## Security Considerations

### Certificate Security
- Store certificates securely (Azure Key Vault, AWS KMS, etc.)
- Use time-stamping to extend certificate validity
- Rotate certificates before expiration

### Update Security
- Always use HTTPS for update servers
- Verify update signatures before installation
- Implement rollback mechanism for failed updates

### User Data
- Follow Windows data protection guidelines
- Store user data in appropriate directories (%AppData%)
- Implement proper uninstall cleanup

## Production Checklist

### Before Release
- [ ] Code signing certificate configured and tested
- [ ] Update server deployed and accessible
- [ ] Version number incremented in package.json
- [ ] RELEASES file properly formatted and hosted
- [ ] Installation and uninstallation tested
- [ ] Auto-update cycle tested end-to-end
- [ ] Antivirus scanning completed
- [ ] User acceptance testing on clean Windows machines

### Post-Release Monitoring
- Monitor update server logs for download patterns
- Track installation success/failure rates
- Monitor user feedback for installation issues
- Keep certificates up to date

## Additional Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Squirrel.Windows Documentation](https://github.com/Squirrel/Squirrel.Windows)
- [electron-updater Documentation](https://www.electron.build/auto-update)
- [Code Signing Guide](https://www.electron.build/code-signing)