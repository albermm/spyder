#import "AudioSessionManager.h"
#import <AVFoundation/AVFoundation.h>

@implementation AudioSessionManager

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setCategory:(NSString *)category options:(NSDictionary *)options) {
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *error;

    NSString *categoryString = AVAudioSessionCategoryPlayAndRecord;
    if ([category isEqualToString:@"playAndRecord"]) {
      categoryString = AVAudioSessionCategoryPlayAndRecord;
    } else if ([category isEqualToString:@"record"]) {
      categoryString = AVAudioSessionCategoryRecord;
    }

    // Options for background audio recording
    AVAudioSessionCategoryOptions categoryOptions = AVAudioSessionCategoryOptionDefaultToSpeaker;

    if ([options[@"allowBluetooth"] boolValue]) {
      categoryOptions |= AVAudioSessionCategoryOptionAllowBluetooth;
      categoryOptions |= AVAudioSessionCategoryOptionAllowBluetoothA2DP;
    }
    if ([options[@"allowAirPlay"] boolValue]) {
      categoryOptions |= AVAudioSessionCategoryOptionAllowAirPlay;
    }
    // Note: NOT using mixWithOthers - we want exclusive audio for background recording

    [session setCategory:categoryString
                    mode:AVAudioSessionModeDefault
                 options:categoryOptions
                   error:&error];

    if (error) {
      NSLog(@"[AudioSessionManager] Error setting audio session category: %@", error.localizedDescription);
    } else {
      NSLog(@"[AudioSessionManager] Audio session category set to %@ for background recording", categoryString);
    }

    // Activate the audio session
    [session setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
    if (error) {
      NSLog(@"[AudioSessionManager] Error activating audio session: %@", error.localizedDescription);
    } else {
      NSLog(@"[AudioSessionManager] Audio session activated for background use.");
    }
  });
}

RCT_EXPORT_METHOD(activateForBackground) {
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *error;

    // Re-activate session when going to background
    [session setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
    if (error) {
      NSLog(@"[AudioSessionManager] Error re-activating for background: %@", error.localizedDescription);
    } else {
      NSLog(@"[AudioSessionManager] Audio session re-activated for background.");
    }
  });
}

@end
