#import <React/RCTBridgeModule.h>

/// Objective-C bridge macro to expose VPNManagerModule to React Native.
/// The Swift implementation handles all logic; this file simply registers
/// the module and its methods with the RN bridge.
@interface RCT_EXTERN_MODULE(VPNManagerModule, NSObject)

RCT_EXTERN_METHOD(startVPN:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopVPN:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getVPNStatus:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getBlockedCount:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getRecentBlocked:
                  (RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
