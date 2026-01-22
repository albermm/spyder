#import "BackgroundTaskManager.h"
#import <UIKit/UIKit.h>

@implementation BackgroundTaskManager

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(startBackgroundTask:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  UIApplication *app = [UIApplication sharedApplication];
  UIBackgroundTaskIdentifier bgTaskId = [app beginBackgroundTaskWithExpirationHandler:^{
    // Clean up before the task expires
    [app endBackgroundTask:bgTaskId];
    bgTaskId = UIBackgroundTaskInvalid;
    // Optionally reject the promise if the task expires immediately
    // reject(@"background_task_expired", @"Background task expired", nil);
  }];

  NSLog(@"[BackgroundTaskManager] Started background task with ID: %lu", (unsigned long)bgTaskId);
  resolve(@(bgTaskId));
}

RCT_EXPORT_METHOD(endBackgroundTask:(nonnull NSNumber *)bgTaskId) {
  UIApplication *app = [UIApplication sharedApplication];
  NSLog(@"[BackgroundTaskManager] Ending background task with ID: %@", bgTaskId);
  [app endBackgroundTask:[bgTaskId unsignedIntegerValue]];
}

@end
