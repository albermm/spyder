# Spyder Remote Monitoring App - Audit Report & Background Wake Solution

**Date:** 2026-02-02
**Auditor:** Claude Code

---

## Executive Summary

This audit identified two critical issues in the Spyder remote monitoring app:

1. **Pairing Bug:** Case-sensitivity issue causing pairing failures
2. **Wake-up Reliability:** Silent push notifications are unreliable for waking terminated iOS apps

**Recommended Solution:** Hybrid approach combining location-based wake-up with silent push notifications for maximum reliability.

---

## ISSUE 1: Pairing Problems

### Current Flow

1. Mobile app → `requestPairingCode()` → Server `/api/auth/pair` (POST)
2. Server generates 6-character code using `0-9A-F` (uppercase)
3. Mobile app displays code or accepts manual entry
4. Mobile app → `registerDevice(code, name)` → Server `/api/auth/register` (POST)
5. Server validates code, creates device, returns tokens

### Bug Identified

**Location:** `mobile/src/services/AuthService.ts:52-60`

```typescript
async registerDevice(pairingCode: string, deviceName: string): Promise<AuthResponse> {
  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: deviceName,
      type: 'device',
      pairing_code: pairingCode,  // ❌ NOT converted to uppercase
    }),
  });
  // ...
}
```

**Problem:**
- Server generates codes in UPPERCASE (`0123456789ABCDEF`)
- Mobile app has `autoCapitalize="characters"` in UI (soft hint only)
- Mobile app sends code as-is without forcing uppercase
- Server doesn't normalize before validation
- Result: Lowercase letters cause validation failure

**Impact:** Medium severity - users can fail pairing if they manually type lowercase letters

### Fix Required

**Mobile App Side (`AuthService.ts:60`):**
```typescript
pairing_code: pairingCode.toUpperCase(),
```

**Server Side (`server/app/routes/auth.py:43`):**
```python
is_valid = await crud.validate_pairing_code(db, request.pairing_code.upper())
```

**Server Side (`server/app/routes/auth.py:67`):**
```python
await crud.use_pairing_code(db, request.pairing_code.upper(), device_id)
```

**Why Both Sides:**
- Defense in depth: handle case variations from any client
- Server normalization protects against direct API calls
- Mobile normalization ensures consistency

---

## ISSUE 2: Background Wake-Up (Critical)

### Current Implementation

#### Technologies Used
1. **Firebase FCM** with `content-available: 1` (silent push)
2. **Background Message Handler** (`messaging().setBackgroundMessageHandler`)
3. **Background Fetch** (`react-native-background-fetch`, 15-minute intervals)

#### Current Push Configuration

**Server:** `server/app/services/push_notification.py:68-93`
```python
message = messaging.Message(
    data={"type": "ping", "device_id": device_id, "action": "wake"},
    apns=messaging.APNSConfig(
        headers={
            "apns-priority": "5",  # Silent push priority
            "apns-push-type": "background",
        },
        payload=messaging.APNSPayload(
            aps=messaging.Aps(content_available=True),
        ),
    ),
    android=messaging.AndroidConfig(priority="high", ttl=60),
    token=fcm_token,
)
```

**Mobile:** `mobile/src/services/PushNotificationService.ts:59-62`
```typescript
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[Push] Background message received:', remoteMessage);
  await this.handleMessage(remoteMessage);
});
```

#### iOS Background Modes Enabled

From `mobile/ios/RemoteEyeMobile/Info.plist:48-56`:
- ✅ `audio`
- ✅ `fetch`
- ✅ `processing`
- ✅ `location`
- ✅ `remote-notification`
- ✅ `bluetooth-central`
- ✅ `nearby-interaction`
- ❌ `voip` (NOT enabled - would require CallKit)

### Critical Limitations Discovered

#### 1. Silent Push Notifications Are NOT Reliable

**Sources:**
- [Silent Push Notifications in iOS: Opportunities, Not Guarantees](https://mohsinkhan845.medium.com/silent-push-notifications-in-ios-opportunities-not-guarantees-2f18f645b5d5)
- [Silent Push Notification Throttling - Apple Developer Forums](https://developer.apple.com/forums/thread/22080)

**Key Findings:**

| State | Reliability | Notes |
|-------|-------------|-------|
| **Foreground** | ✅ High | Always delivered |
| **Background** | ⚠️ Moderate | Throttled to ~1-2 per hour |
| **Terminated** | ❌ Very Low | Often not delivered at all |

**Throttling Behavior:**
- Apple throttles silent pushes based on battery, network, time of day
- Sending 10+ pushes in 15 seconds → only first 3 delivered, then blocked
- iOS progressively increases throttling over time
- No reliable wake-up "on demand" from terminated state

**Quote from Apple Developer Forums:**
> "Wake up of apps using content-available pushes are heavily throttled, with users able to expect 1-2 wakeup per hour as a best case scenario."

#### 2. VoIP Push (PushKit) - NOT Suitable for This Use Case

**Sources:**
- [Responding to VoIP Notifications from PushKit - Apple Developer](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit)
- [iOS 13 PushKit VoIP restrictions - Apple Developer Forums](https://developer.apple.com/forums/thread/117939)

**Why VoIP Push is Tempting:**
- ✅ ALWAYS wakes app from terminated state (most reliable)
- ✅ No throttling by iOS
- ✅ High priority delivery

**Why It Won't Work for Monitoring:**
- ❌ **MUST** report incoming call to CallKit within seconds
- ❌ **MUST** show native iOS call UI
- ❌ Failure to report call → app terminates immediately
- ❌ Repeated failures → iOS blocks all VoIP pushes permanently
- ❌ App Store rejection risk for misuse

**iOS 13+ Enforcement (2019-present):**
```swift
// Required on EVERY VoIP push or app terminates:
provider.reportNewIncomingCall(with: uuid, update: callUpdate) { error in
    if error != nil {
        // App will be terminated by iOS
    }
}
```

**Verdict:** VoIP push is restricted to actual VoIP calling apps. Cannot be used for general monitoring/wake-up.

---

## PROPOSED SOLUTION: Hybrid Location + Silent Push

### Overview

Use **Significant Location Change** monitoring as the primary wake-up mechanism, with silent push as a secondary "best effort" trigger.

### Why This Works

**Sources:**
- [Handling location updates in the background - Apple Developer](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [Seamless Device Location Monitoring in iOS](https://medium.com/programming-passion/seamless-device-location-monitoring-in-ios-part-1-96375b31dbb5)
- [Understanding Significant Location in iOS](https://medium.com/swiftfy/understanding-significant-location-in-ios-a-developers-guide-463162753a10)

#### Significant Location Change Benefits

| Feature | Capability |
|---------|-----------|
| **Wake from Terminated** | ✅ YES - iOS automatically relaunches app |
| **Self-Recovering** | ✅ YES - survives suspension, termination, device restart |
| **Battery Efficient** | ✅ YES - uses cellular towers, not GPS |
| **User Permission** | ✅ Already requested ("always" location) |
| **Reliability** | ✅ HIGH - iOS system-level service |

**How It Works:**
1. App registers for significant location changes
2. iOS monitors using cellular tower changes (~500m threshold)
3. When user moves significantly, iOS wakes/relaunches app
4. App runs background code, reconnects WebSocket
5. No developer action needed - fully automatic

**Quote from Apple Documentation:**
> "The only way to have your app relaunched automatically is to use region monitoring or significant-change location service."

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Wake-up Strategy                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PRIMARY: Significant Location Changes                  │
│  ✅ Wakes app from terminated state                     │
│  ✅ Self-recovering after device restart                │
│  ✅ Triggers on ~500m movement                          │
│  → Reconnect WebSocket                                  │
│  → Send status update                                   │
│  → Process pending commands                             │
│                                                          │
│  SECONDARY: Silent Push Notifications                   │
│  ⚠️  Best effort only (throttled)                       │
│  ⚠️  Works well when app is backgrounded               │
│  ⚠️  May not work when terminated                       │
│  → Attempt immediate wake-up                            │
│  → Reconnect WebSocket if possible                      │
│                                                          │
│  TERTIARY: Background Fetch                             │
│  ⚠️  iOS controls timing (15+ minutes)                  │
│  ⚠️  Not reliable for on-demand wake                    │
│  → Periodic keep-alive                                  │
│  → Health check                                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Trade-offs

#### Pros
- ✅ Most reliable wake-up from terminated state
- ✅ Battery efficient (uses cellular towers)
- ✅ Already has location permissions
- ✅ App Store compliant
- ✅ Self-recovering after restarts

#### Cons
- ⚠️ Requires device movement (~500m threshold)
- ⚠️ Won't wake for stationary monitoring scenarios
- ⚠️ Less predictable timing than ideal on-demand wake
- ⚠️ May trigger more frequently than needed if user is mobile

### Alternative Considered: Audio Background Mode

**Current Status:** Already enabled in `Info.plist`

**Could Work By:**
- Playing silent audio in background
- Keeps app "active" indefinitely
- Maintains WebSocket connection

**Why NOT Recommended:**
- ❌ Drains battery significantly
- ❌ Shows "audio playing" indicator in Control Center
- ❌ App Store may reject for abusing audio background mode
- ❌ User confusion ("why is app always playing audio?")

---

## IMPLEMENTATION PLAN

### Phase 1: Fix Pairing Bug (Quick Win)

**Priority:** HIGH
**Effort:** 30 minutes
**Files to Modify:** 2

#### Mobile App Changes

**File:** `mobile/src/services/AuthService.ts`

```typescript
async registerDevice(pairingCode: string, deviceName: string): Promise<AuthResponse> {
  const serverUrl = getServerUrl();
  const response = await fetch(`${serverUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: deviceName,
      type: 'device',
      pairing_code: pairingCode.toUpperCase(), // ✅ FIX: Force uppercase
    }),
  });
  // ...
}
```

#### Server Changes

**File:** `server/app/routes/auth.py`

```python
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Register a new device or controller."""
    if request.type == ClientType.DEVICE:
        if not request.pairing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_INPUT", "message": "Pairing code required for device registration"},
            )

        # ✅ FIX: Normalize to uppercase before validation
        pairing_code = request.pairing_code.upper()

        # Validate pairing code
        is_valid = await crud.validate_pairing_code(db, pairing_code)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PAIRING_CODE_INVALID", "message": "Invalid or expired pairing code"},
            )

        # ... device creation code ...

        # Mark pairing code as used
        await crud.use_pairing_code(db, pairing_code, device_id)

        # ... rest of function ...
```

#### Testing

1. Generate pairing code in dashboard
2. Enter code in mobile app using lowercase letters
3. Verify registration succeeds
4. Verify device appears in dashboard

---

### Phase 2: Implement Location-Based Wake-Up

**Priority:** HIGH
**Effort:** 4-6 hours
**Files to Create/Modify:** 3

#### Step 1: Create Location Wake Service

**New File:** `mobile/src/services/LocationWakeService.ts`

```typescript
/**
 * Location Wake Service
 * Uses significant location changes to wake app from terminated state
 */

import Geolocation from '@react-native-community/geolocation';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { socketService } from './SocketService';
import { authService } from './AuthService';
import { statusService } from './StatusService';

class LocationWakeService {
  private isMonitoring: boolean = false;
  private watchId: number | null = null;

  /**
   * Start monitoring significant location changes.
   * This will wake the app from terminated state when user moves ~500m.
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('[LocationWake] Already monitoring');
      return;
    }

    try {
      // Request location permissions (should already be granted)
      const granted = await this.checkPermissions();
      if (!granted) {
        console.error('[LocationWake] Location permissions not granted');
        return;
      }

      // Start significant location change monitoring
      // This is battery-efficient and wakes app from terminated state
      this.watchId = Geolocation.watchPosition(
        (position) => this.handleLocationChange(position),
        (error) => console.error('[LocationWake] Error:', error),
        {
          enableHighAccuracy: false, // Use cell towers, not GPS
          distanceFilter: 500, // Minimum 500m between updates
          useSignificantChanges: true, // iOS: use significant changes API
        }
      );

      this.isMonitoring = true;
      console.log('[LocationWake] Monitoring started');
    } catch (error) {
      console.error('[LocationWake] Failed to start monitoring:', error);
    }
  }

  /**
   * Handle location change event.
   * This gets called when iOS wakes/relaunches the app.
   */
  private async handleLocationChange(position: any): Promise<void> {
    console.log('[LocationWake] Location changed, waking app...');
    console.log('[LocationWake] Position:', position.coords);

    try {
      // Re-initialize auth if needed
      const isAuthenticated = await authService.initialize();
      if (!isAuthenticated) {
        console.log('[LocationWake] Not authenticated, skipping');
        return;
      }

      // Reconnect WebSocket using self-healing method
      await socketService.connectWithAutoRefresh();

      if (socketService.isConnected()) {
        console.log('[LocationWake] WebSocket reconnected');

        // Send status update to server
        await statusService.sendStatus();

        // Send heartbeat
        socketService.sendHeartbeat();
      } else {
        console.log('[LocationWake] WebSocket reconnection pending');
      }
    } catch (error) {
      console.error('[LocationWake] Wake-up failed:', error);
    }
  }

  /**
   * Check location permissions.
   */
  private async checkPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        (error) => {
          console.error('[LocationWake] Permission denied:', error);
          resolve(false);
        }
      );
    });
  }

  /**
   * Stop monitoring location changes.
   */
  stopMonitoring(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isMonitoring = false;
      console.log('[LocationWake] Monitoring stopped');
    }
  }

  /**
   * Check if monitoring is active.
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

export const locationWakeService = new LocationWakeService();
```

#### Step 2: Integrate into App Initialization

**File:** `mobile/App.tsx` (modify `startBackgroundServices` function)

```typescript
const startBackgroundServices = async () => {
  if (servicesInitialized.current) {
    console.log('[App] Services already initialized.');
    return;
  }

  console.log('[App] Starting background services...');

  const token = authService.getToken();
  const deviceId = authService.getDeviceId();

  if (!token || !deviceId) {
    console.error('[App] Cannot start services: missing credentials.');
    return;
  }

  try {
    // Connect to WebSocket with self-healing (token refresh handled by SocketService)
    await socketService.connectWithAutoRefresh();

    // Initialize command handler to process incoming commands
    commandHandler.initialize();

    // Initialize push notification service
    await pushNotificationService.initialize();

    // Initialize background fetch service (keeps app alive periodically)
    await backgroundService.initialize();
    await backgroundService.start();

    // ✅ NEW: Start location-based wake-up monitoring
    await locationWakeService.startMonitoring();

    servicesInitialized.current = true;
    console.log('[App] Background services started successfully.');
  } catch (error) {
    console.error('[App] Failed to start background services:', error);
  }
};
```

#### Step 3: Update Service Exports

**File:** `mobile/src/services/index.ts`

```typescript
export { authService } from './AuthService';
export { socketService } from './SocketService';
export { pushNotificationService } from './PushNotificationService';
export { backgroundService } from './BackgroundService';
export { commandHandler } from './CommandHandler';
export { locationService } from './LocationService';
export { statusService } from './StatusService';
export { audioService } from './AudioService';
export { cameraService } from './CameraService';
export { locationWakeService } from './LocationWakeService'; // ✅ NEW
```

#### Step 4: Update iOS Info.plist (if needed)

**File:** `mobile/ios/RemoteEyeMobile/Info.plist`

Verify `location` is in `UIBackgroundModes` (already present at line 53).

#### Step 5: Update iOS Location Permissions

**File:** `mobile/ios/RemoteEyeMobile/Info.plist`

Ensure "Always" permission is properly described:

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>RemoteEye needs continuous location access to maintain remote monitoring connection even when the app is not in use.</string>
```

---

### Phase 3: Optimize Silent Push as Secondary Trigger

**Priority:** MEDIUM
**Effort:** 2 hours

#### Update Push Priority Configuration

**File:** `server/app/services/push_notification.py:76-85`

```python
# Current configuration is already correct for silent push
# Just add better logging and error handling

apns=messaging.APNSConfig(
    headers={
        "apns-priority": "5",  # Silent push priority (correct)
        "apns-push-type": "background",  # Background type (correct)
    },
    payload=messaging.APNSPayload(
        aps=messaging.Aps(
            content_available=True,  # Silent notification (correct)
            # Don't add alert/badge/sound - keep it silent
        ),
    ),
),
```

**Note:** Current configuration is already optimal. Silent pushes will work as a "best effort" secondary wake mechanism.

#### Document Expectations

Add logging to clarify when silent push is expected to work:

**File:** `server/app/services/push_notification.py:48-62`

```python
async def send_silent_ping(
    self,
    fcm_token: str,
    device_id: str,
) -> bool:
    """
    Send a silent push notification to wake up the device.

    NOTE: Silent pushes are NOT guaranteed on iOS:
    - Throttled to ~1-2 per hour when backgrounded
    - May not be delivered when app is terminated
    - Location-based wake is the primary mechanism
    - This is a "best effort" immediate wake attempt

    Args:
        fcm_token: The device's FCM token
        device_id: The device ID for logging

    Returns:
        True if sent successfully (not guarantee of delivery)
    """
    # ... existing implementation ...
```

---

## TESTING STRATEGY

### Test 1: Pairing Case Sensitivity

**Scenario:** User enters lowercase pairing code

1. Generate pairing code in dashboard (e.g., "A1B2C3")
2. Enter "a1b2c3" (lowercase) in mobile app
3. Expected: Registration succeeds
4. Expected: Device appears in dashboard

### Test 2: Location Wake from Background

**Scenario:** App is backgrounded, user moves

1. Pair device and start monitoring
2. Background the app (Home button)
3. Move device ~500m (drive/walk)
4. Expected: iOS wakes app
5. Expected: WebSocket reconnects
6. Expected: Status update sent to server
7. Verify in server logs: device comes online

### Test 3: Location Wake from Terminated

**Scenario:** App is force-quit, user moves

1. Pair device and start monitoring
2. Force-quit app (swipe up in app switcher)
3. Move device ~500m
4. Expected: iOS relaunches app in background
5. Expected: WebSocket reconnects
6. Expected: Status update sent
7. Verify: Device shows online in dashboard

### Test 4: Silent Push (Best Effort)

**Scenario:** Dashboard sends wake command

1. Background the app
2. Send wake-up ping from dashboard
3. Expected (if not throttled): App wakes within seconds
4. Expected: WebSocket reconnects
5. Note: May fail if iOS has throttled silent pushes

### Test 5: Stationary Monitoring Limitation

**Scenario:** Device stays in one place

1. Pair device and start monitoring
2. Force-quit app
3. Device remains stationary
4. Expected: App does NOT wake (no location change)
5. Workaround: Silent push may work (throttled)
6. Recommendation: Inform user to keep app backgrounded, not terminated

---

## USER DOCUMENTATION UPDATES NEEDED

### For Dashboard Users

**Topic:** "Understanding Wake-Up Reliability"

```markdown
## How Remote Monitoring Works

Your iOS device uses multiple methods to stay connected:

### Primary: Location-Based Wake-Up ✅ Most Reliable
- iOS automatically wakes the app when you move ~500 meters
- Works even if app is force-quit or phone restarts
- Battery efficient (uses cell towers, not GPS)
- **Limitation:** Requires device movement

### Secondary: Silent Push Notifications ⚠️ Best Effort
- Dashboard can send wake-up commands
- Works well when app is backgrounded
- May be delayed or dropped when app is force-quit
- iOS limits these to ~1-2 per hour

### Best Practices
- Keep app backgrounded (not force-quit) for instant wake-up
- If force-quit, app will wake when you move locations
- Enable "Always Allow" location permissions
```

### For Mobile App Users

**In-App Message after Pairing:**

```
🌍 Location-Based Monitoring Active

This app uses your location to maintain remote
monitoring even when closed. The app will:

✅ Wake automatically when you move
✅ Reconnect to the server
✅ Stay battery efficient

For best results, background the app instead
of force-quitting it.

Location data is only used to wake the app,
not for tracking.
```

---

## TIMELINE & EFFORT ESTIMATE

| Phase | Task | Effort | Priority |
|-------|------|--------|----------|
| 1 | Fix pairing case sensitivity | 30 min | HIGH |
| 1 | Test pairing with lowercase | 15 min | HIGH |
| 2 | Create LocationWakeService | 2 hours | HIGH |
| 2 | Integrate into App.tsx | 30 min | HIGH |
| 2 | Test location wake (background) | 1 hour | HIGH |
| 2 | Test location wake (terminated) | 1 hour | HIGH |
| 3 | Update push notification docs | 30 min | MEDIUM |
| 3 | Add logging for wake events | 30 min | MEDIUM |
| 4 | Write user documentation | 1 hour | MEDIUM |
| 4 | Add in-app explanation | 30 min | MEDIUM |

**Total Effort:** 8-10 hours
**Critical Path:** Phase 1 + Phase 2 = ~5 hours

---

## RISKS & MITIGATION

### Risk 1: Location Permission Denial

**Risk:** User denies "Always Allow" location

**Impact:** Location wake won't work

**Mitigation:**
- Clear in-app explanation of why it's needed
- Fallback to silent push (throttled)
- Fallback to background fetch (15+ min)
- Show warning if permission not granted

### Risk 2: Stationary Device Won't Wake

**Risk:** User's phone stays in one place for days

**Impact:** No location changes → no wake-up

**Mitigation:**
- Document this limitation clearly
- Recommend keeping app backgrounded
- Silent push may still work (best effort)
- Background fetch as fallback

### Risk 3: iOS Changes in Future

**Risk:** Apple modifies significant location behavior

**Impact:** Solution stops working

**Mitigation:**
- Monitor iOS release notes
- Test on beta iOS versions
- Keep silent push as fallback
- Consider additional wake strategies if needed

---

## ALTERNATIVE SOLUTIONS (Rejected)

### Alternative 1: VoIP Push with Fake Calls

**Approach:** Use VoIP push, show fake incoming call UI

**Why Rejected:**
- ❌ Violates Apple guidelines
- ❌ App Store rejection risk
- ❌ Poor user experience (fake calls)
- ❌ iOS will terminate app if no real call
- ❌ Not sustainable long-term

### Alternative 2: Continuous Audio Background Mode

**Approach:** Play silent audio to keep app alive

**Why Rejected:**
- ❌ Drains battery significantly
- ❌ Shows "audio playing" indicator
- ❌ App Store may reject
- ❌ User confusion
- ❌ Not battery efficient

### Alternative 3: Increase Silent Push Frequency

**Approach:** Send pushes every minute hoping some get through

**Why Rejected:**
- ❌ iOS will throttle even more aggressively
- ❌ May block pushes entirely
- ❌ Wastes server resources
- ❌ Doesn't solve terminated state issue

---

## CONCLUSION

The proposed hybrid solution using **Significant Location Changes** as primary wake mechanism with **Silent Push** as secondary provides:

✅ **Reliability:** Works from terminated state (location-based)
✅ **Battery Efficiency:** Uses cell towers, not constant GPS
✅ **App Store Compliance:** No policy violations
✅ **User Experience:** Automatic, no fake UI elements
✅ **Maintainability:** Uses standard iOS APIs

**Trade-off accepted:** Requires device movement for wake-up from terminated state. This is acceptable for a mobile monitoring app where the device is expected to move with the user.

---

## REFERENCES

### Pairing Issue
- Code review: `mobile/src/services/AuthService.ts`
- Code review: `server/app/routes/auth.py`
- Code review: `server/app/db/crud.py`

### iOS Silent Push Limitations
- [Silent Push Notifications in iOS: Opportunities, Not Guarantees](https://mohsinkhan845.medium.com/silent-push-notifications-in-ios-opportunities-not-guarantees-2f18f645b5d5)
- [Silent Push Notification Throttling - Apple Developer Forums](https://developer.apple.com/forums/thread/22080)

### VoIP Push Requirements
- [Responding to VoIP Notifications from PushKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit)
- [iOS 13 PushKit VoIP restrictions - Apple Developer Forums](https://developer.apple.com/forums/thread/117939)
- [Implementing VoIP push notifications using PushKit - Medium](https://medium.com/mindful-engineering/voice-over-internet-protocol-voip-801ee15c3722)

### Location-Based Wake-Up
- [Handling location updates in the background - Apple Developer](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [Seamless Device Location Monitoring in iOS](https://medium.com/programming-passion/seamless-device-location-monitoring-in-ios-part-1-96375b31dbb5)
- [Understanding Significant Location in iOS](https://medium.com/swiftfy/understanding-significant-location-in-ios-a-developers-guide-463162753a10)

### iOS Background Modes
- [Configuring background execution modes - Apple Developer](https://developer.apple.com/documentation/xcode/configuring-background-execution-modes)
- [Mastering iOS Background Modes and Tasks - Medium](https://mohsinkhan845.medium.com/mastering-ios-background-modes-and-tasks-a-comprehensive-guide-322116db13fd)

---

**End of Report**
