# Portal Terminal - Distribution Guide

## 📦 Distribution Package Specifications

### Platform Targets

#### macOS Distribution
- **Format**: Universal .dmg installer
- **Architecture**: Universal binary (Intel + Apple Silicon)
- **Minimum Version**: macOS 10.15 (Catalina)
- **File Size**: ~50MB
- **Signing**: Developer ID Application certificate
- **Notarization**: Apple notarization required
- **Features**:
  - Custom DMG background with branding
  - Drag-to-Applications folder setup
  - Auto-updater integration
  - Keychain integration for API keys
  - Launch Services registration

#### Windows Distribution
- **Format**: NSIS installer (.exe)
- **Architecture**: x64 (with x86 compatibility layer)
- **Minimum Version**: Windows 10 version 1903
- **File Size**: ~45MB
- **Signing**: Code signing certificate required
- **Features**:
  - Start Menu integration
  - Desktop shortcut option
  - Auto-updater integration
  - Windows Terminal integration
  - PATH environment variable setup
  - Uninstaller included

#### Linux Distribution
- **Format**: AppImage (portable) + .deb/.rpm packages
- **Architecture**: x64 (AppImage universal)
- **Minimum Version**: Ubuntu 18.04 LTS equivalent
- **File Size**: ~48MB (AppImage)
- **Features**:
  - Portable AppImage for universal compatibility
  - .deb package for Debian/Ubuntu
  - .rpm package for RHEL/Fedora
  - Desktop file integration
  - Auto-updater support

## 🔧 Build Configuration

### Electron Builder Configuration

```json
{
  "productName": "Portal Terminal",
  "appId": "com.portalapps.terminal",
  "directories": {
    "output": "dist-packages",
    "assets": "build-assets"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*",
    "!node_modules/**/test/**/*",
    "!node_modules/**/*.md",
    "package.json"
  ],
  "mac": {
    "category": "public.app-category.developer-tools",
    "icon": "build-assets/icon.icns",
    "target": [
      {
        "target": "dmg",
        "arch": ["universal"]
      }
    ],
    "hardenedRuntime": true,
    "entitlements": "build-assets/entitlements.mac.plist",
    "entitlementsInherit": "build-assets/entitlements.mac.plist",
    "notarize": {
      "teamId": "YOUR_TEAM_ID"
    }
  },
  "dmg": {
    "background": "build-assets/dmg-background.png",
    "iconSize": 100,
    "contents": [
      {
        "x": 380,
        "y": 280,
        "type": "link",
        "path": "/Applications"
      },
      {
        "x": 110,
        "y": 280,
        "type": "file",
        "path": "Portal Terminal.app"
      }
    ],
    "window": {
      "width": 540,
      "height": 400
    }
  },
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "build-assets/icon.ico",
    "publisherName": "Portal Apps",
    "verifyUpdateCodeSignature": false
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": "always",
    "createStartMenuShortcut": true,
    "shortcutName": "Portal Terminal",
    "include": "build-assets/installer.nsh",
    "artifactName": "Portal-Terminal-Setup-${version}.${ext}"
  },
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      },
      {
        "target": "deb",
        "arch": ["x64"]
      },
      {
        "target": "rpm",
        "arch": ["x64"]
      }
    ],
    "icon": "build-assets/icon.png",
    "category": "Development",
    "description": "AI-powered terminal for modern developers",
    "desktop": {
      "Name": "Portal Terminal",
      "Comment": "AI-powered terminal application",
      "Categories": "Development;System;ConsoleOnly;",
      "StartupNotify": "true"
    }
  },
  "appImage": {
    "artifactName": "Portal-Terminal-${version}.${ext}"
  },
  "deb": {
    "packageCategory": "devel",
    "priority": "optional",
    "afterInstall": "build-assets/deb-postinst.sh"
  },
  "rpm": {
    "packageCategory": "Development/Tools",
    "afterInstall": "build-assets/rpm-postinst.sh"
  },
  "publish": {
    "provider": "github",
    "owner": "portal-terminal",
    "repo": "portal-terminal",
    "private": true
  }
}
```

### Required Build Assets

#### Icons
- `build-assets/icon.icns` - macOS icon (512x512 with multiple resolutions)
- `build-assets/icon.ico` - Windows icon (256x256 with multiple resolutions)
- `build-assets/icon.png` - Linux icon (512x512 PNG)
- `build-assets/icon@2x.png` - High-DPI version (1024x1024)

#### macOS Specific
- `build-assets/entitlements.mac.plist` - Required entitlements
- `build-assets/dmg-background.png` - DMG installer background (540x400)

#### Windows Specific
- `build-assets/installer.nsh` - Custom NSIS installer script
- `build-assets/banner.bmp` - Installer banner (493x58)
- `build-assets/sidebar.bmp` - Installer sidebar (493x312)

#### Linux Specific
- `build-assets/deb-postinst.sh` - Post-installation script for .deb
- `build-assets/rpm-postinst.sh` - Post-installation script for .rpm

## 🚀 Build Process

### Pre-Build Checklist
- [ ] All source code built and tested
- [ ] Version numbers updated in package.json
- [ ] Icons and assets in place
- [ ] Certificates configured for signing
- [ ] Environment variables set for notarization
- [ ] Release notes prepared

### Build Commands

```bash
# Install electron-builder
npm install -g electron-builder

# Build for current platform
npm run build
npm run package

# Build for specific platforms
electron-builder --mac --universal
electron-builder --win --x64
electron-builder --linux --x64

# Build for all platforms (requires proper setup)
electron-builder --mac --win --linux

# Build with publishing (for releases)
electron-builder --publish=always
```

### Platform-Specific Build Requirements

#### macOS Build Environment
- **Platform**: macOS 10.15+ (for universal builds)
- **Xcode**: Latest version installed
- **Certificates**: Developer ID Application certificate in Keychain
- **Environment Variables**:
  ```bash
  export APPLE_ID="your-apple-id@email.com"
  export APPLE_ID_PASSWORD="app-specific-password"
  export APPLE_TEAM_ID="your-team-id"
  ```

#### Windows Build Environment
- **Platform**: Windows 10/11 or macOS with Wine
- **Code Signing**: Certificate file or Azure Key Vault
- **Environment Variables**:
  ```bash
  export WIN_CSC_LINK="path/to/certificate.p12"
  export WIN_CSC_KEY_PASSWORD="certificate-password"
  ```

#### Linux Build Environment
- **Platform**: Ubuntu 18.04+ (or Docker container)
- **Dependencies**: `rpm`, `fakeroot`, `dpkg`
- **AppImage Tools**: Automatically downloaded by electron-builder

## 📋 Quality Assurance

### Automated Testing
- **Unit Tests**: Run full test suite before building
- **E2E Tests**: Playwright tests on built packages
- **Performance Tests**: Verify startup times and memory usage
- **Security Scans**: Check for vulnerabilities in dependencies

### Manual Testing Checklist

#### macOS Testing
- [ ] DMG opens correctly with proper layout
- [ ] Drag-to-Applications works
- [ ] App launches from Applications folder
- [ ] All features work (AI, MCP, terminal)
- [ ] Performance meets targets
- [ ] Gatekeeper accepts the app (proper signing)
- [ ] Auto-updater works (if enabled)

#### Windows Testing
- [ ] Installer runs with proper UI
- [ ] Installation completes successfully
- [ ] Start Menu shortcuts work
- [ ] App launches and functions correctly
- [ ] Windows Defender accepts the app
- [ ] Uninstaller removes all components
- [ ] Auto-updater works (if enabled)

#### Linux Testing
- [ ] AppImage runs without installation
- [ ] .deb package installs correctly on Ubuntu
- [ ] .rpm package installs correctly on Fedora
- [ ] Desktop integration works
- [ ] All dependencies are bundled
- [ ] Permissions are correct

### Security Considerations
- **Code Signing**: All binaries must be signed
- **Dependency Audit**: Regular security audits
- **Sandboxing**: Platform-appropriate sandboxing
- **Network Security**: HTTPS-only communications
- **API Key Security**: Secure storage of user credentials

## 📊 Distribution Metrics

### File Size Targets
- **macOS DMG**: <60MB
- **Windows EXE**: <55MB
- **Linux AppImage**: <65MB
- **Total Download**: <180MB for all platforms

### Performance Targets
- **Installation Time**: <2 minutes
- **First Launch**: <3 seconds after installation
- **Update Size**: <20MB for incremental updates
- **Startup Performance**: Maintain <2s startup time

### Quality Metrics
- **Install Success Rate**: >99.5%
- **First Launch Success**: >98%
- **Crash-Free Rate**: >99% for first 7 days
- **Update Success**: >95% automatic update success

## 🔄 Release Process

### Beta Release Process
1. **Build Verification**: All automated tests pass
2. **Manual QA**: Complete testing checklist
3. **Package Signing**: Sign all platform packages
4. **Checksum Generation**: Create verification checksums
5. **Beta Distribution**: Upload to private repository
6. **Tester Notification**: Send download links to beta testers
7. **Monitoring**: Track downloads and initial feedback

### Production Release Process
1. **Final QA**: Complete beta feedback integration
2. **Version Tagging**: Create release tag in Git
3. **Production Build**: Build all platform packages
4. **Security Scan**: Final security verification
5. **Store Submission**: Submit to app stores (if applicable)
6. **Website Upload**: Update download links
7. **Release Announcement**: Public launch communication

---

## 🎯 Beta Distribution Strategy

### Immediate Actions for Beta Launch
1. **Setup Build Environment**: Configure all platform build tools
2. **Create Build Assets**: Design icons, backgrounds, installer assets
3. **Test Build Process**: Verify builds work on all target platforms
4. **Setup Distribution**: Create private repository for beta packages
5. **Document Installation**: Create platform-specific install guides

### Beta Package Features
- **Beta Branding**: Clear beta designation in UI
- **Crash Reporting**: Built-in crash reporting for feedback
- **Usage Analytics**: Anonymous usage tracking (with consent)
- **Easy Feedback**: One-click feedback submission
- **Auto-Expiration**: Beta expires after testing period

### Success Metrics
- **Download Success**: 100% of testers can download and install
- **Installation Success**: >95% successful installations
- **Launch Success**: >90% successful first launches
- **Feature Access**: All testers can access all features
- **Performance**: Meets all performance targets on tester hardware

This distribution guide ensures Portal Terminal beta packages are professional, secure, and provide an excellent first impression to beta testers while gathering the data needed for a successful public launch.