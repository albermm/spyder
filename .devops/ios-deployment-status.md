# iOS Deployment Status

**Date**: 2026-02-02
**Status**: Ready for Build & Upload

## App Configuration

- **Bundle ID**: `com.albertomartin.config`
- **Display Name**: Confyg
- **Version**: 1.0
- **Build**: 1
- **Platform**: iOS
- **Min iOS Version**: TBD (check Xcode)

## Pre-Deployment Checklist ✅

- [x] CocoaPods dependencies installed
- [x] Xcode workspace configured
- [x] GoogleService-Info.plist present (Firebase)
- [x] All required permissions configured (Camera, Microphone, Location)
- [x] Background modes enabled
- [x] Production server URL configured (`https://spyder-server.onrender.com`)

## Deployment Steps

### 1. Configure Signing in Xcode

Xcode is now open. Follow these steps:

1. **Select Target**
   - Click on "RemoteEyeMobile" project in navigator
   - Select "RemoteEyeMobile" target

2. **Configure Signing & Capabilities**
   - Click "Signing & Capabilities" tab
   - Enable "Automatically manage signing"
   - Select your Team (Apple Developer account)
   - Verify Bundle Identifier: `com.albertomartin.config`

3. **Verify Background Modes**
   - Ensure these are enabled:
     - ☑ Audio, AirPlay, and Picture in Picture
     - ☑ Background fetch
     - ☑ Background processing
     - ☑ Location updates
     - ☑ Remote notifications
     - ☑ Bluetooth LE accessories
     - ☑ Nearby Interaction

### 2. Build for Release

1. **Select Build Target**
   - Top toolbar: Select "Any iOS Device (arm64)"
   - DO NOT select a simulator

2. **Clean Build Folder**
   - Menu: Product → Clean Build Folder (⌘⇧K)

3. **Archive the App**
   - Menu: Product → Archive
   - Wait for build to complete (2-5 minutes)

### 3. Upload to App Store Connect

1. **Organizer Opens Automatically**
   - Window → Organizer (if not already open)
   - Select your archive from the list

2. **Distribute App**
   - Click "Distribute App" button
   - Select "App Store Connect"
   - Click "Upload"
   - Follow the prompts

3. **Complete Upload**
   - Wait for processing (5-10 minutes)
   - You'll receive email when ready

### 4. Configure App Store Connect

1. **Go to App Store Connect**
   - Visit: https://appstoreconnect.apple.com
   - Sign in with Apple ID

2. **Create App (If Not Already Created)**
   - My Apps → + (plus icon)
   - New App
   - Platform: iOS
   - Name: Confyg (or your chosen name)
   - Primary Language: English
   - Bundle ID: Select `com.albertomartin.config`
   - SKU: confyg-ios-001

3. **Add App Information**
   - App Privacy: https://appstoreconnect.apple.com/apps/{app-id}/appstore/privacy
   - Provide privacy policy URL
   - Answer privacy questions

4. **Add Screenshots**
   Required sizes:
   - 6.7" Display (iPhone 15 Pro Max): 1290 x 2796 px
   - 6.5" Display (iPhone 11 Pro Max): 1284 x 2778 px
   - 5.5" Display (iPhone 8 Plus): 1242 x 2208 px

   You need at least 1 screenshot per size, up to 10 total.

5. **Add App Description**
   - Name: Confyg
   - Subtitle: (Optional, 30 characters max)
   - Description: Describe your app (4000 characters max)
   - Keywords: monitoring,remote,security,camera (100 chars max)
   - Support URL: Your support website
   - Marketing URL: (Optional)
   - Privacy Policy URL: Required

6. **Set Pricing**
   - Pricing and Availability
   - Select countries/regions
   - Set price (Free or Paid)

### 5. TestFlight (Recommended Before App Store)

1. **Configure TestFlight**
   - App Store Connect → TestFlight tab
   - Select your build (appears after processing)

2. **Add Internal Testers**
   - TestFlight → Internal Testing
   - Add team members
   - They can test immediately

3. **Add External Testers** (Optional)
   - TestFlight → External Testing
   - Submit for Beta App Review
   - Add external testers
   - Collect feedback

### 6. Submit for App Store Review

1. **Select Build**
   - App Store tab
   - Version Information
   - Select uploaded build

2. **Complete Information**
   - What's New in This Version
   - Copyright
   - Age Rating
   - Content Rights

3. **Submit for Review**
   - Click "Submit for Review"
   - Answer questionnaire
   - Confirm submission

## Expected Timeline

| Step | Time |
|------|------|
| Archive in Xcode | 2-5 minutes |
| Upload to App Store Connect | 5-10 minutes |
| Processing in App Store Connect | 10-30 minutes |
| TestFlight availability | Immediate after processing |
| Beta App Review (external testers) | 1-2 days |
| App Store Review | 1-3 days |
| App goes live | After approval |

## Troubleshooting

### Build Fails

**Missing Signing Certificate**
- Xcode → Preferences → Accounts
- Select Apple ID
- Download Manual Profiles
- Try archiving again

**Code Signing Error**
- Clean build folder (⌘⇧K)
- Delete DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Restart Xcode
- Try again

### Upload Fails

**Invalid Binary**
- Check version and build numbers are incremented
- Ensure all required icons are present
- Review Xcode organizer warnings

**Missing Entitlements**
- Verify all required capabilities are enabled
- Check Info.plist usage descriptions

### App Rejected

**Common Reasons:**
- Incomplete functionality
- Privacy issues (missing usage descriptions)
- Guideline violations
- Broken features

**Solution:**
- Read rejection carefully
- Fix issues
- Increment build number
- Re-upload
- Resubmit

## Post-Approval

After app is approved:

1. **Monitor Reviews**
   - Check App Store Connect for user reviews
   - Respond to user feedback

2. **Track Analytics**
   - App Store Connect → Analytics
   - Monitor downloads, crashes, usage

3. **Plan Updates**
   - Regular updates improve visibility
   - Increment version number for updates
   - Increment build number for each upload

## Version Management

For future updates:

```bash
# Update version in Xcode:
# General tab → Identity
# Version: 1.0 → 1.1 (feature update)
# Version: 1.0 → 1.0.1 (bug fix)

# Always increment build number:
# Build: 1 → 2 → 3 → ...
```

## Resources

- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com)
- [TestFlight](https://developer.apple.com/testflight/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## Support

For issues:
- Apple Developer Support: https://developer.apple.com/support
- App Store Connect Help: In dashboard, click "?" icon

---

**Last Updated**: 2026-02-02
**Next Steps**: Complete signing configuration in Xcode, then archive
