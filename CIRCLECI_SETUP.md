# CircleCI Setup Instructions

## Overview
This project has been migrated from GitHub Actions to CircleCI for CI/CD pipeline management. The new setup provides:
- **PR Testing Only**: Fast feedback with tests only for pull requests
- **Main Branch Releases**: Full build + test + release pipeline for main branch merges
- **Native Artifact Storage**: 5-day TTL with automatic cleanup
- **Cross-Platform Builds**: Windows and macOS builds using appropriate executors

## Setup Steps

### 1. CircleCI Project Setup
1. Go to [CircleCI](https://circleci.com/) and sign in with your GitHub account
2. Click "Set Up Project" for your repository
3. Choose "Use Existing Config" since we have `.circleci/config.yml`
4. Click "Set Up Project"

### 2. Environment Variables Configuration
Set the following environment variables in your CircleCI project settings:

#### Required API Keys
- `OPENAI_API_KEY` - OpenAI API key for speech processing
- `DEEPGRAM_API_KEY` - Deepgram API key for speech-to-text
- `BASETEN_API_KEY` - Baseten API key for AI services

#### Supabase Configuration
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Your Supabase anonymous key

#### Analytics
- `REACT_APP_POSTHOG_KEY` - PostHog analytics key
- `REACT_APP_POSTHOG_HOST` - PostHog host URL

#### GitHub Integration
- `GITHUB_TOKEN` - GitHub personal access token with repo permissions for creating releases

#### Code Signing (Optional - for production)
- `WINDOWS_CERTIFICATE_FILE` - Windows code signing certificate
- `WINDOWS_CERTIFICATE_PASSWORD` - Windows certificate password
- `APPLE_ID` - Apple ID for macOS code signing
- `APPLE_APP_PASSWORD` - Apple app-specific password
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_IDENTITY` - Apple signing identity
- `APPLE_PROVISIONING_PROFILE` - Apple provisioning profile

### 3. Workflow Behavior

#### Pull Request Workflow
- **Trigger**: Any PR to any branch
- **Jobs**: Test and lint (ESLint, unit tests, e2e tests, coverage)
- **Duration**: ~5-10 minutes
- **Artifacts**: Test coverage reports only

#### Main Branch Workflow  
- **Trigger**: Push to main branch
- **Jobs**: Test → Build (Windows + macOS) → Create GitHub Release
- **Duration**: ~20-30 minutes
- **Artifacts**: 
  - Windows: `.exe` and `.msi` installers
  - macOS: `.dmg` installer
  - Stored with 5-day TTL, automatically cleaned up

#### Manual Release Workflow
- **Trigger**: Git tag push (e.g., `git tag v1.0.2 && git push origin v1.0.2`)
- **Jobs**: Same as main branch workflow
- **Use Case**: Manual releases or hotfixes

### 4. Artifact Management

#### Storage
- Uses CircleCI's native artifact storage
- Automatic cleanup after 5 days
- No external dependencies (removed Supabase Storage)

#### Access
- Artifacts available in CircleCI web interface
- GitHub releases created automatically with downloadable assets
- Direct download links in release notes

### 5. Resource Usage

#### Executors
- **Linux**: Large container for testing and release creation
- **macOS**: M1 medium for macOS builds
- **Windows**: Large Windows machine for Windows builds

#### Caching
- `node_modules` cached by `package-lock.json` checksum
- Electron binaries cached in `~/.cache/electron`
- Significantly faster subsequent builds

### 6. Monitoring and Debugging

#### Build Status
- Check CircleCI dashboard for pipeline status
- GitHub status checks on PRs
- Email notifications on failures

#### Debugging Failed Builds
- SSH into failed builds via CircleCI interface
- Detailed logs for each step
- Artifact inspection in web interface

### 7. Migration Benefits

#### Performance
- Faster PR feedback (tests only)
- Better caching mechanisms
- Parallel job execution

#### Cost Optimization
- No builds on PRs (just tests)
- Reduced resource usage
- Native artifact storage (no external costs)

#### Maintenance
- Simplified pipeline (no Supabase integration)
- Automatic artifact cleanup
- Better error reporting and debugging tools

## Troubleshooting

### Common Issues

#### Build Failures
1. Check environment variables are set correctly
2. Verify all required secrets are configured
3. Check executor resource limits

#### Release Issues
1. Ensure `GITHUB_TOKEN` has correct permissions
2. Verify repository access for CircleCI
3. Check if release tag already exists

#### Dependency Issues
1. Clear cache in CircleCI settings
2. Verify `package-lock.json` is up to date
3. Check for platform-specific dependency conflicts

### Support
- CircleCI Documentation: https://circleci.com/docs/
- Project Issues: Create GitHub issue with `ci/cd` label
- CircleCI Status: https://status.circleci.com/