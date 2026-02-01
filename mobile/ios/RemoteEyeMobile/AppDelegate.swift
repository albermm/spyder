import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import TSBackgroundFetch

// =============================================================================
// AUTO MODE: No more manual flag switching!
// =============================================================================
// The app now auto-detects its mode based on stored credentials:
// - No credentials → Shows pairing UI
// - Has credentials → Shows minimal status UI, runs services in background
//
// Just build ONCE and install. The JS side handles everything.
// =============================================================================

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

    // --- Register Background Fetch ---
    // Required for react-native-background-fetch to work
    TSBackgroundFetch.sharedInstance().didFinishLaunching()

    // --- React Native Bridge Initialization ---
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // =======================================================================
    // AUTO MODE: Always launch React Native, let JS handle the UI
    // =======================================================================
    // JS will check for stored credentials and show:
    // - PairingScreen if not paired
    // - Minimal status screen if already paired
    NSLog("[AppDelegate] Launching in auto mode. JS will detect pairing state.")

    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "RemoteEyeMobile",
      in: window,
      launchOptions: launchOptions
    )

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
