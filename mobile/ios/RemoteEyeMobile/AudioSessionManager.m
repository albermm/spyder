#import "AudioSessionManager.h"
#import <AVFoundation/AVFoundation.h>

@implementation AudioSessionManager

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setCategory:(NSString *)category options:(NSDictionary *)options) {
  AVAudioSession *session = [AVAudioSession sharedInstance];
  NSError *error;

  NSString *categoryString = AVAudioSessionCategoryPlayAndRecord;
  if ([category isEqualToString:@"playAndRecord"]) {
    categoryString = AVAudioSessionCategoryPlayAndRecord;
  } else if ([category isEqualToString:@"record"]) {
    categoryString = AVAudioSessionCategoryRecord;
  }

  // Convert options dictionary to AVAudioSessionCategoryOptions
  AVAudioSessionCategoryOptions categoryOptions = 0;
  if ([options[@"mixWithOthers"] boolValue]) {
    categoryOptions |= AVAudioSessionCategoryOptionMixWithOthers;
  }
  if ([options[@"allowBluetooth"] boolValue]) {
    categoryOptions |= AVAudioSessionCategoryOptionAllowBluetooth;
  }
  if ([options[@"allowAirPlay"] boolValue]) {
    categoryOptions |= AVAudioSessionCategoryOptionAllowAirPlay;
  }
  if ([options[@"duckOthers"] boolValue]) {
    categoryOptions |= AVAudioSessionCategoryOptionDuckOthers;
  }

  [session setCategory:categoryString withOptions:categoryOptions error:&error];

  if (error) {
    NSLog(@"[AudioSessionManager] Error setting audio session category: %@", error.localizedDescription);
  } else {
    NSLog(@"[AudioSessionManager] Audio session category set to %@ with options", categoryString);
  }

  // Activate the audio session
  [session setActive:YES error:&error];
  if (error) {
    NSLog(@"[AudioSessionManager] Error activating audio session: %@", error.localizedDescription);
  } else {
    NSLog(@"[AudioSessionManager] Audio session activated.");
  }
}

@end
