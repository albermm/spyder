import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // --- Standard Firebase Initialization (Keep this) ---
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

    // --- React Native Bridge Initialization (Modified) ---
    // We initialize the bridge to run the JS code, but we don't attach it to a view.
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // --- CRITICAL: Do NOT create a UIWindow or RCTRootView ---
    // By not creating a window or calling startReactNative with a window,
    // the app launches without ever presenting a user interface.
    // The React Native bridge will still be initialized and JS code will run.

    // Create a bridge manually to run JS in headless mode
    let bridge = RCTBridge(delegate: delegate, launchOptions: launchOptions)

    // Store reference to prevent deallocation
    _ = bridge

    // The app will now launch, run the JS code in the background, and that's it.
    NSLog("[AppDelegate] Headless app launched. No UI will be presented.")

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
