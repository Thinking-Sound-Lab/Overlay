# GitHub Actions CI/CD Setup

## Overview
This project uses GitHub Actions for continuous integration and deployment. The setup provides:
- **PR Testing Only**: Fast feedback with tests and linting for pull requests
- **Main Branch Releases**: Full cross-platform builds + automated releases for main branch merges
- **Manual Releases**: Tag-triggered releases for hotfixes
- **Artifact Management**: 5-day retention with automatic cleanup of old artifacts
- **Cross-Platform Builds**: Windows and macOS builds using GitHub-hosted runners

## Workflow Architecture

### 1. PR Testing Workflow (`pr-test.yml`)
**Trigger**: Pull requests to main branch

**Jobs**:
- Lint code using ESLint
- Run unit tests with Jest
- Generate test coverage reports
- Upload test results and coverage as artifacts (5-day retention)

**Duration**: ~5-10 minutes
**Runner**: Ubuntu Latest with Node.js 22

### 2. Build and Release Workflow (`build-release.yml`)
**Trigger**: Push to main branch

**Jobs**:
1. **Artifact Cleanup**: Automatically deletes old build artifacts and artifacts older than 5 days
2. **Windows Build**: Builds `.exe` and `.msi` installers using `windows-latest` runner
3. **macOS Build**: Builds `.dmg` installer using `macos-14` (M1) runner
4. **Create Release**: Automatically creates GitHub release with all build artifacts

**Duration**: ~15-20 minutes
**Logic**: Quality already validated in PR, goes straight to deployment

### 3. Manual Release Workflow (`manual-release.yml`)
**Trigger**: Git tag push (e.g., `git tag v1.0.3 && git push origin v1.0.3`)

**Jobs**: Same as build-release workflow
**Use Case**: Manual releases, hotfixes, or specific version releases

## Environment Variables Setup

### Required Repository Secrets
Navigate to Repository Settings → Secrets and variables → Actions to configure:

#### API Keys
- `OPENAI_API_KEY` - OpenAI API key for speech processing
- `DEEPGRAM_API_KEY` - Deepgram API key for speech-to-text
- `BASETEN_API_KEY` - Baseten API key for AI services

#### Supabase Configuration
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Your Supabase anonymous key

#### Analytics
- `REACT_APP_POSTHOG_KEY` - PostHog analytics key
- `REACT_APP_POSTHOG_HOST` - PostHog host URL (usually https://app.posthog.com)

#### GitHub Integration
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions (no setup required)

#### Optional: Code Signing (for production)
- `WINDOWS_CERTIFICATE_FILE` - Windows code signing certificate
- `WINDOWS_CERTIFICATE_PASSWORD` - Windows certificate password
- `APPLE_ID` - Apple ID for macOS code signing
- `APPLE_APP_PASSWORD` - Apple app-specific password
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_IDENTITY` - Apple signing identity
- `APPLE_PROVISIONING_PROFILE` - Apple provisioning profile

## Artifact Management Strategy

### Retention Policy
- **Build Artifacts**: 5-day maximum retention
- **Test Artifacts**: 5-day retention for debugging

### Automatic Cleanup
Each build workflow includes an artifact cleanup job that:
1. Deletes all artifacts older than 5 days
2. Deletes previous build artifacts (windows-builds, macos-builds) before creating new ones
3. Preserves other artifacts (test results, coverage) until they expire naturally

### Storage Optimization
- Automatic cleanup prevents storage bloat
- Only keeps the most recent builds available
- GitHub release assets persist beyond artifact retention

## Build Outputs

### Windows Builds
- **Target**: Windows x64 and x86 (ia32)
- **Format**: Squirrel installer (`.exe` and `.msi`)
- **Location**: `out/make/squirrel.windows/`
- **Naming**: `Overlay-Setup-{version}.exe`

### macOS Builds
- **Target**: Universal (Intel + Apple Silicon)
- **Format**: DMG installer
- **Location**: `out/make/`
- **Naming**: `Overlay-{version}.dmg`

## Workflow Triggers and Behavior

### Pull Request Flow
1. Developer creates PR
2. `pr-test.yml` runs automatically
3. Must pass all tests and linting before merge
4. No builds are created (testing only)

### Main Branch Flow
1. PR merged to main
2. `build-release.yml` runs automatically
3. Builds for Windows and macOS in parallel
4. Creates GitHub release with version from `package.json`
5. Release includes download links and installation notes

### Manual Release Flow
1. Create and push tag: `git tag v1.0.3 && git push origin v1.0.3`
2. `manual-release.yml` runs automatically
3. Same build process as main branch
4. Useful for hotfixes or specific version releases

## Runner Configuration

### Ubuntu (Testing & Release)
- **Image**: `ubuntu-latest`
- **Node.js**: 22.x
- **Use Case**: Testing, linting, release creation
- **Caching**: npm cache with `package-lock.json` checksum

### Windows (Build)
- **Image**: `windows-latest`
- **Node.js**: 22.x
- **Use Case**: Windows installer builds
- **Timeout**: 30 minutes
- **Build Tools**: Electron Forge with Squirrel

### macOS (Build)
- **Image**: `macos-14` (M1-based)
- **Node.js**: 22.x
- **Use Case**: macOS DMG builds
- **Timeout**: 30 minutes
- **Build Tools**: Electron Forge with DMG maker

## Monitoring and Debugging

### Build Status
- Check GitHub Actions tab in repository
- Status checks appear on PRs automatically
- Email notifications on workflow failures

### Debugging Failed Builds
1. Go to Actions tab → Failed workflow
2. Click on failed job to see detailed logs
3. Download artifacts for inspection if needed
4. Check environment variables and secrets configuration

### Common Debug Steps
- Verify all required secrets are set
- Check Node.js version compatibility
- Verify package-lock.json is up to date
- Check for platform-specific dependency issues

## Migration Benefits from CircleCI

### Performance Improvements
- **Faster PR feedback**: Tests only, no unnecessary builds
- **Better caching**: Native GitHub Actions cache system
- **Parallel execution**: Windows and macOS builds run simultaneously

### Cost Optimization
- **No external service costs**: Uses GitHub's included compute minutes
- **Efficient storage**: 5-day retention with automatic cleanup
- **No third-party integrations**: Everything within GitHub ecosystem

### Operational Benefits
- **Native GitHub integration**: No external service setup required
- **Better debugging**: Direct integration with GitHub UI
- **Simplified maintenance**: Single platform for code and CI/CD
- **Improved security**: Secrets managed within GitHub

## Troubleshooting

### Common Issues

#### Build Failures
1. **Dependency issues**: Clear runner cache or update package-lock.json
2. **Environment variables**: Verify all required secrets are configured
3. **Timeout issues**: Check if build is taking longer than 30-minute limit

#### Release Issues
1. **Duplicate releases**: GitHub Actions skips if release version already exists
2. **Missing artifacts**: Check that both Windows and macOS builds completed successfully
3. **Permission errors**: Verify repository has Actions enabled

#### Artifact Issues
1. **Missing artifacts**: Check artifact retention period and cleanup logic
2. **Storage limits**: GitHub provides generous limits but monitor usage
3. **Download problems**: Artifacts auto-expire after 5 days

### Getting Help
- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **Electron Forge Documentation**: https://www.electronforge.io/
- **Repository Issues**: Create issue with `ci/cd` label for project-specific problems

## Security Best Practices

### Secrets Management
- Never commit secrets to repository
- Use repository secrets for sensitive data
- Rotate API keys regularly
- Use least-privilege access for tokens

### Build Security
- Pin action versions (e.g., `@v4` not `@latest`)
- Review dependency updates for security issues
- Enable Dependabot for automated security updates
- Use trusted, official actions when possible

## Maintenance Tasks

### Regular Maintenance
- **Monthly**: Review and rotate API keys
- **Quarterly**: Update action versions in workflows
- **As needed**: Update Node.js version when LTS changes
- **Monitor**: GitHub Actions usage and storage limits

### Version Updates
When updating the app version in `package.json`:
1. Commit version change to main branch
2. Workflow automatically creates release with new version
3. No manual intervention required for standard releases