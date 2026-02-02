# iOS App Deployment Checklist

Quick checklist for deploying the RemoteEye iOS app to the App Store.

## Pre-Deployment

- [ ] Apple Developer Account enrolled ($99/year)
- [ ] App Store Connect access configured
- [ ] Xcode installed with latest version
- [ ] Valid signing certificates and provisioning profiles
- [ ] Firebase Cloud Messaging configured with APNs
- [ ] `GoogleService-Info.plist` added to project
- [ ] Server is deployed and accessible at production URL
- [ ] Production server URL is correct in `mobile/src/config/index.ts`

## App Store Connect Setup

- [ ] Create new app in App Store Connect
  - Name: Confyg (or your chosen name)
  - Bundle ID: `com.yourcompany.confyg` (must match Xcode)
  - Primary Language: English
  - SKU: confyg-ios-001

## Xcode Configuration

- [ ] Open `mobile/ios/RemoteEyeMobile.xcworkspace` in Xcode
- [ ] Set **Bundle Identifier** (General tab)
- [ ] Set **Version** to `1.0.0`
- [ ] Set **Build** to `1`
- [ ] Select your **Team** in Signing & Capabilities
- [ ] Enable **Automatically manage signing**
- [ ] Verify all **Background Modes** are enabled:
  - [ ] Audio, AirPlay, and Picture in Picture
  - [ ] Background fetch
  - [ ] Background processing
  - [ ] Location updates
  - [ ] Remote notifications
  - [ ] Bluetooth LE accessories
  - [ ] Nearby Interaction
- [ ] Verify all **Usage Descriptions** are present:
  - [ ] Camera
  - [ ] Microphone
  - [ ] Location (Always and When In Use)

## Build Configuration

- [ ] Select target device: **Any iOS Device (arm64)**
- [ ] Product → Scheme → Edit Scheme
- [ ] Set **Build Configuration** to **Release**
- [ ] Product → Clean Build Folder (⌘+Shift+K)
- [ ] Product → Archive
- [ ] Wait for archive to complete successfully

## App Store Upload

- [ ] In Organizer, select your archive
- [ ] Click **Distribute App**
- [ ] Choose **App Store Connect**
- [ ] Select **Upload**
- [ ] Wait for upload to complete
- [ ] Verify no errors or warnings

## App Store Connect - App Information

- [ ] Add **App Icon** (1024x1024 PNG)
- [ ] Add **Screenshots** for required devices:
  - [ ] 6.7" iPhone (1290 x 2796)
  - [ ] 6.5" iPhone (1284 x 2778)
  - [ ] 5.5" iPhone (1242 x 2208)
- [ ] Write **Description** (up to 4000 characters)
- [ ] Add **Keywords** (comma-separated, max 100 characters)
- [ ] Set **Support URL**
- [ ] Set **Marketing URL** (optional)
- [ ] Add **Privacy Policy URL** (required)

## Version Information

- [ ] Select uploaded build
- [ ] Add **What's New in This Version** (Release notes)
- [ ] Set **Copyright** (e.g., "2025 Your Company Name")
- [ ] Choose **Primary Category** (e.g., Utilities)
- [ ] Choose **Secondary Category** (optional)

## App Review Information

- [ ] Add **Contact Information**:
  - [ ] First Name
  - [ ] Last Name
  - [ ] Phone Number
  - [ ] Email Address
- [ ] Add **Demo Account** (if login required):
  - [ ] Username
  - [ ] Password
  - [ ] Notes for reviewer
- [ ] Add **Notes** for review team (explain app functionality)
- [ ] Add **Attachment** (optional screenshots/videos showing functionality)

## Export Compliance

- [ ] Answer encryption questions:
  - Does your app use encryption? **YES**
  - Does your app qualify for encryption exemption? **YES** (typically for HTTPS only)
  - If exempt, what exemption? **Uses standard encryption (HTTPS)**

## Content Rights

- [ ] Review **Content Rights** declaration
- [ ] Confirm you have rights to all content
- [ ] Review **Age Rating** questionnaire
- [ ] Submit responses

## Final Checks

- [ ] Review all information for accuracy
- [ ] Check all links are working
- [ ] Verify screenshots are correct orientation
- [ ] Verify app category is appropriate
- [ ] Review pricing (Free or Paid)

## Submit for Review

- [ ] Click **Submit for Review**
- [ ] Confirm submission
- [ ] Wait for review (typically 1-3 days)

## Post-Submission

- [ ] Monitor **App Review Status** in App Store Connect
- [ ] Respond promptly to any review questions
- [ ] Once approved, app will go live automatically (or on scheduled date)

---

## TestFlight Beta Testing (Optional but Recommended)

Before submitting to App Store:

- [ ] After upload, go to **TestFlight** tab in App Store Connect
- [ ] Add **Internal Testers** (your team, up to 100)
- [ ] Configure **Test Information**:
  - [ ] Beta App Description
  - [ ] Beta App Review Information
  - [ ] Test Information
- [ ] Click **Start Testing**
- [ ] Add **External Testers** (up to 10,000)
- [ ] Submit for **Beta App Review** (required for external testing)
- [ ] Collect feedback from testers
- [ ] Fix any issues found
- [ ] Upload new build if needed (increment build number)

---

## Common Issues & Solutions

### Build Failed

**Problem**: Archive fails to build
- Clean build folder (⌘+Shift+K)
- Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Update CocoaPods: `cd ios && pod install`
- Check for certificate/provisioning profile issues

### Upload Failed

**Problem**: Upload to App Store Connect fails
- Verify bundle ID matches App Store Connect
- Check version and build numbers are incremented
- Ensure all required icons are present
- Review Xcode organizer for warnings

### App Rejected

**Common reasons**:
- Missing functionality described in metadata
- Broken features or crashes
- Privacy issues (missing usage descriptions)
- Guideline violations

**Solution**:
- Review rejection reason carefully
- Fix issues
- Increment build number
- Re-upload and resubmit

### Background Modes Not Working

**Problem**: App doesn't work in background
- Verify all required background modes are enabled
- Check Info.plist has correct UIBackgroundModes
- Test background fetch is configured
- Verify push notifications are set up correctly

---

## Quick Commands

```bash
# Clean and rebuild
cd mobile/ios
pod install
cd ..
npx react-native run-ios --configuration Release

# View device logs
xcrun simctl spawn booted log stream --predicate 'process == "RemoteEyeMobile"'

# Archive from command line
xcodebuild -workspace ios/RemoteEyeMobile.xcworkspace \
  -scheme RemoteEyeMobile \
  -configuration Release \
  -archivePath ~/Desktop/RemoteEyeMobile.xcarchive \
  archive
```

---

## Resources

- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com)
- [TestFlight](https://developer.apple.com/testflight/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## Version History Template

Keep track of releases:

| Version | Build | Date | Status | Notes |
|---------|-------|------|--------|-------|
| 1.0.0 | 1 | 2025-02-02 | In Review | Initial release |
| 1.0.1 | 2 | TBD | - | Bug fixes |
| 1.1.0 | 3 | TBD | - | New features |
