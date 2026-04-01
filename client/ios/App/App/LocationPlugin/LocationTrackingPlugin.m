#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LocationTrackingPlugin, "LocationTracking",
    CAP_PLUGIN_METHOD(startTracking, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopTracking, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkBatteryOptimization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestBatteryOptimization, CAPPluginReturnPromise);
)
