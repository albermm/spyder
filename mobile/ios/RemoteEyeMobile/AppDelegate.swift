import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging
import UserNotifications

// =============================================================================
// SETUP MODE FLAG
// =============================================================================
// Set to `true` to enable UI for initial device pairing.
// Set to `false` for headless background operation after pairing is complete.
//
// SETUP PROCESS:
// 1. Set isSetupMode = true, build and install the app
// 2. Complete pairing on the PairingScreen (credentials saved to AsyncStorage)
// 3. Verify device appears online on dashboard
// 4. Set isSetupMode = false, rebuild and reinstall
// 5. App now runs headlessly with stored credentials
// =============================================================================
private let isSetupMode = true

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var bridge: RCTBridge?  // Store bridge reference to prevent deallocation

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // --- Standard Firebase Initialization ---
    FirebaseApp.configure()

    // Set up push notifications
    UNUserNotificationCenter.current().delegate = self
    Messaging.messaging().delegate = self

    // Request notification permissions
    let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(
      options: authOptions,
      completionHandler: { _, _ in }
    )
    application.registerForRemoteNotifications()

    // --- React Native Bridge Initialization ---
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    if isSetupMode {
      // =======================================================================
      // SETUP MODE: Launch with UI for pairing
      // =======================================================================
      NSLog("[AppDelegate] Setup mode enabled. Launching with UI for pairing.")

      window = UIWindow(frame: UIScreen.main.bounds)
      factory.startReactNative(
        withModuleName: "RemoteEyeMobile",
        in: window,
        launchOptions: launchOptions
      )
    } else {
      // =======================================================================
      // HEADLESS MODE: Run JS in background without UI
      // =======================================================================
      // The app will use credentials stored during setup mode.
      // If not paired, JS will detect this and idle until next setup.
      NSLog("[AppDelegate] Headless mode. No UI will be presented.")

      // Create bridge manually to run JS without attaching to a view
      bridge = RCTBridge(delegate: delegate, launchOptions: launchOptions)
    }

    return true
  }

  // Handle APNs token registration
  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("Failed to register for remote notifications: \(error)")
  }

  // Handle silent push notifications (content-available)
  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // This is called for silent push notifications
    // The JS side will handle reconnecting to WebSocket
    print("Received silent push notification: \(userInfo)")

    // Post notification to React Native
    NotificationCenter.default.post(
      name: NSNotification.Name("SilentPushReceived"),
      object: nil,
      userInfo: userInfo
    )

    completionHandler(.newData)
  }

  // MARK: - UNUserNotificationCenterDelegate

  // Handle foreground notifications
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([[.banner, .sound]])
  }

  // Handle notification tap
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }

  // MARK: - MessagingDelegate

  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("FCM token: \(fcmToken ?? "nil")")

    // Send token to React Native
    let dataDict: [String: String] = ["token": fcmToken ?? ""]
    NotificationCenter.default.post(
      name: Notification.Name("FCMToken"),
      object: nil,
      userInfo: dataDict
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
