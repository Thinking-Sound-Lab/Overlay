import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

/*
 * WINDOWS BUILD CONFIGURATION - UNSIGNED BUILDS
 *
 * Current setup is configured for unsigned testing/development builds.
 *
 * IMPORTANT: For production deployment:
 * 1. Uncomment certificate configuration in MakerSquirrel below
 * 2. Set environment variables: WINDOWS_CERTIFICATE_FILE, WINDOWS_CERTIFICATE_PASSWORD
 * 3. Change verifyUpdateCodeSignature to true in package.json
 * 4. Test with actual code signing certificate
 *
 * Unsigned build limitations:
 * - Windows SmartScreen warnings for users
 * - May be flagged by antivirus software
 * - Not suitable for commercial distribution
 * - Users must click "More info" -> "Run anyway" to install
 */

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Overlay",
    executableName: "Overlay",
    icon: "./assets/icon", // Base name, will look for .ico on Windows, .icns on macOS
    appBundleId: "com.overlay.app",
    appCategoryType: "public.app-category.productivity",
    
    win32metadata: {
      CompanyName: "Overlay",
      FileDescription: "AI-powered dictation app",
      OriginalFilename: "Overlay.exe",
      ProductName: "Overlay",
      InternalName: "Overlay",
    },

    // macOS Code Signing & Notarization (commented out for unsigned testing builds)
    // For production: uncomment these lines and configure with your Apple Developer credentials
    osxSign: {
      //   identity: process.env.APPLE_IDENTITY, // "Developer ID Application: Your Name (TEAM_ID)"
      //   hardenedRuntime: true,
      //   entitlements: 'entitlements.plist',
      //   'entitlements-inherit': 'entitlements.plist',
      //   'signature-flags': 'library'
    },
    // osxNotarize: {
    //   tool: 'notarytool',
    //   appleId: process.env.APPLE_ID,
    //   appleIdPassword: process.env.APPLE_APP_PASSWORD, // App-specific password
    //   teamId: process.env.APPLE_TEAM_ID
    // }
  },
  rebuildConfig: {},
  makers: [
    // Windows installer using Squirrel.Windows
    // Currently configured for unsigned builds (testing/development)
    new MakerSquirrel(
      {
        name: "overlay",
        authors: "Abhishekucs",
        description:
          "AI-powered dictation app that transcribes speech and inserts text into any application",
        setupIcon: "./assets/icon.ico",
        iconUrl: "https://overlay.app/icon.ico", // Update with your actual domain

        // Code signing configuration (commented out for unsigned testing builds)
        // For production: uncomment these lines and set WINDOWS_CERTIFICATE_FILE and WINDOWS_CERTIFICATE_PASSWORD environment variables
        // certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
        // certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,

        remoteReleases: process.env.WINDOWS_UPDATE_SERVER_URL,
        setupExe: "OverlaySetup.exe",
      },
      ["win32"]
    ),

    // macOS DMG installer
    // Currently configured for unsigned builds (testing/development)
    new MakerDMG(
      {
        name: "Overlay",
        title: "Overlay",
        // icon: "./assets/icon.icns",
        // background: "./assets/dmg-background.png",
        contents: [
          { x: 448, y: 344, type: "link", path: "/Applications" },
          {
            x: 192,
            y: 344,
            type: "file",
            path: "./out/Overlay-darwin-arm64/Overlay.app",
          },
        ],
        additionalDMGOptions: {
          window: {
            position: { x: 400, y: 100 },
            size: { width: 660, height: 500 },
          },
        },

        // Code signing for DMG (commented out for unsigned testing builds)
        // For production: uncomment and configure with APPLE_IDENTITY environment variable
        // codeSign: {
        //   identity: process.env.APPLE_IDENTITY,
        //   'signing-flags': 'library'
        // }
      },
      ["darwin"]
    ),

    new MakerZIP({}, ["darwin"]), // Keep ZIP as backup/alternative for macOS
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/renderer/main_window/index.html",
            js: "./src/renderer/main_window/renderer.tsx",
            name: "main_window",
            preload: {
              js: "./src/preload/preload.ts",
            },
          },
          {
            html: "./src/renderer/recording_window/index.html",
            js: "./src/renderer/recording_window/renderer.tsx",
            name: "recording_window",
            preload: {
              js: "./src/preload/preload.ts",
            },
          },
          {
            html: "./src/renderer/information_window/information.html",
            js: "./src/renderer/information_window/information.tsx",
            name: "information_window",
            preload: {
              js: "./src/preload/preload.ts",
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
