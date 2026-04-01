import Foundation
import Capacitor

@objc(LocationTrackingPlugin)
public class LocationTrackingPlugin: CAPPlugin {

    @objc func startTracking(_ call: CAPPluginCall) {
        guard let token  = call.getString("token"),
              let apiUrl = call.getString("apiUrl") else {
            call.reject("token and apiUrl are required")
            return
        }
        let refreshToken = call.getString("refreshToken")

        DispatchQueue.main.async {
            LocationService.shared.start(token: token, refreshToken: refreshToken, apiUrl: apiUrl)
        }
        call.resolve()
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            LocationService.shared.stop()
        }
        call.resolve()
    }

    // iOS mein battery optimization Android jaisi nahi hoti — always granted return karo
    @objc func checkBatteryOptimization(_ call: CAPPluginCall) {
        call.resolve(["granted": true])
    }

    @objc func requestBatteryOptimization(_ call: CAPPluginCall) {
        call.resolve()
    }
}
