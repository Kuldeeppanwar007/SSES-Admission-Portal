import Foundation
import CoreLocation
import UserNotifications

class LocationService: NSObject, CLLocationManagerDelegate {

    static let shared = LocationService()

    private let locationManager = CLLocationManager()
    private var isRunning    = false

    private let intervalSeconds: TimeInterval = 60
    private let timeoutSeconds:  TimeInterval = 20
    private let prefs = UserDefaults.standard

    private var lastSentTime: Date?
    private var timeoutTimer: Timer?

    override private init() {
        super.init()
        locationManager.delegate                        = self
        locationManager.desiredAccuracy                 = kCLLocationAccuracyBest
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.distanceFilter                  = kCLDistanceFilterNone
    }

    // MARK: - Public

    func start(token: String, refreshToken: String?, apiUrl: String) {
        prefs.set(token,  forKey: "token")
        prefs.set(apiUrl, forKey: "apiUrl")
        if let rt = refreshToken { prefs.set(rt, forKey: "refreshToken") }

        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()

        isRunning = true
    }

    func stop() {
        isRunning = false
        timeoutTimer?.invalidate()
        timeoutTimer = nil
        locationManager.stopUpdatingLocation()
        locationManager.stopMonitoringSignificantLocationChanges()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard isRunning, let location = locations.last else { return }

        // 1 min interval enforce
        if let last = lastSentTime, Date().timeIntervalSince(last) < intervalSeconds { return }

        // IST 7AM–9PM check
        var cal      = Calendar.current
        cal.timeZone = TimeZone(identifier: "Asia/Kolkata")!
        let hour     = cal.component(.hour, from: Date())
        guard hour >= 7 && hour < 21 else { return }

        timeoutTimer?.invalidate()
        timeoutTimer = nil
        lastSentTime = Date()

        guard let apiUrl = prefs.string(forKey: "apiUrl"),
              let token  = prefs.string(forKey: "token") else { return }

        if isMockLocation(location) {
            showMockLocationNotification()
            sendPing(status: "mock", location: nil, apiUrl: apiUrl, token: token)
        } else {
            dismissLocationOffNotification()
            dismissMockLocationNotification()
            sendPing(status: "ok", location: location, apiUrl: apiUrl, token: token)
        }

        // Agar agli baar interval + timeout ke andar update nahi aayi to unavailable ping
        scheduleTimeout(apiUrl: apiUrl, token: token)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard isRunning else { return }

        // Sirf kCLErrorDenied pe react karo — locationUnknown transient hota hai, ignore karo
        guard let clErr = error as? CLError, clErr.code == .denied else { return }

        var cal      = Calendar.current
        cal.timeZone = TimeZone(identifier: "Asia/Kolkata")!
        let hour     = cal.component(.hour, from: Date())
        guard hour >= 7 && hour < 21 else { return }

        guard let apiUrl = prefs.string(forKey: "apiUrl"),
              let token  = prefs.string(forKey: "token") else { return }

        showLocationOffNotification()
        sendPing(status: "unavailable", location: nil, apiUrl: apiUrl, token: token)
    }

    // MARK: - Timeout

    private func scheduleTimeout(apiUrl: String, token: String) {
        DispatchQueue.main.async {
            self.timeoutTimer?.invalidate()
            // interval + timeoutSeconds ke baad bhi update nahi aayi to unavailable
            self.timeoutTimer = Timer.scheduledTimer(
                withTimeInterval: self.intervalSeconds + self.timeoutSeconds,
                repeats: false
            ) { [weak self] _ in
                guard let self = self, self.isRunning else { return }
                self.showLocationOffNotification()
                self.sendPing(status: "unavailable", location: nil, apiUrl: apiUrl, token: token)
            }
        }
    }

    // MARK: - Mock GPS Detection

    private func isMockLocation(_ location: CLLocation) -> Bool {
        // iOS 15.4+ native flag — sirf isSimulatedBySoftware check karo
        // isProducedByAccessory = external GPS device (e.g. car GPS) — yeh mock nahi hai
        if #available(iOS 15.4, *) {
            if location.sourceInformation?.isSimulatedBySoftware == true { return true }
        }

        // Heuristic fallback for older iOS + 3rd party spoofers
        if location.horizontalAccuracy <= 0  { return true }  // invalid accuracy
        if location.speed > 340              { return true }  // speed of sound — impossible
        if location.altitude > 12000         { return true }  // above commercial flight ceiling
        if abs(location.timestamp.timeIntervalSinceNow) > 300 { return true } // 5 min purani location

        return false
    }

    // MARK: - HTTP

    private func sendPing(status: String, location: CLLocation?, apiUrl: String, token: String) {
        var body: [String: Any] = [
            "status":    status,
            "timestamp": Int64(Date().timeIntervalSince1970 * 1000)
        ]
        if let loc = location {
            body["lat"]      = loc.coordinate.latitude
            body["lng"]      = loc.coordinate.longitude
            body["accuracy"] = loc.horizontalAccuracy
        }
        postWithRefresh(apiUrl: apiUrl, token: token, body: body)
    }

    private func postWithRefresh(apiUrl: String, token: String, body: [String: Any]) {
        DispatchQueue.global(qos: .background).async {
            let code = self.doPost(urlStr: apiUrl + "/attendance/location", token: token, body: body)
            if code == 401 {
                if let newToken = self.refreshAccessToken(apiUrl: apiUrl) {
                    self.doPost(urlStr: apiUrl + "/attendance/location", token: newToken, body: body)
                }
            }
        }
    }

    @discardableResult
    private func doPost(urlStr: String, token: String, body: [String: Any]) -> Int {
        guard let url  = URL(string: urlStr),
              let data = try? JSONSerialization.data(withJSONObject: body) else { return -1 }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)",  forHTTPHeaderField: "Authorization")
        req.httpBody = data
        req.timeoutInterval = 15

        var statusCode = -1
        let sem = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            statusCode = (resp as? HTTPURLResponse)?.statusCode ?? -1
            sem.signal()
        }.resume()
        sem.wait()
        return statusCode
    }

    private func refreshAccessToken(apiUrl: String) -> String? {
        guard let refreshToken = prefs.string(forKey: "refreshToken"),
              let url = URL(string: apiUrl + "/auth/refresh") else { return nil }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["refreshToken": refreshToken])
        req.timeoutInterval = 15

        var result: String?
        let sem = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: req) { data, resp, _ in
            if (resp as? HTTPURLResponse)?.statusCode == 200,
               let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let newToken = json["token"] as? String {
                self.prefs.set(newToken, forKey: "token")
                if let newRefresh = json["refreshToken"] as? String {
                    self.prefs.set(newRefresh, forKey: "refreshToken")
                }
                result = newToken
            }
            sem.signal()
        }.resume()
        sem.wait()
        return result
    }

    // MARK: - Notifications

    private func showLocationOffNotification() {
        let content = UNMutableNotificationContent()
        content.title = "⚠️ Location Band Hai!"
        content.body  = "SSES Portal ke liye location on rakhen. Band rehne par attendance block ho sakti hai."
        content.sound = .default
        let req = UNNotificationRequest(identifier: "location_off", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    private func dismissLocationOffNotification() {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["location_off"])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["location_off"])
    }

    private func showMockLocationNotification() {
        let content = UNMutableNotificationContent()
        content.title = "⚠️ Fake Location Detected!"
        content.body  = "Mock location app band karo. Fake location use karne par attendance block ho jayegi."
        content.sound = .default
        let req = UNNotificationRequest(identifier: "mock_location", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    private func dismissMockLocationNotification() {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["mock_location"])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["mock_location"])
    }
}
