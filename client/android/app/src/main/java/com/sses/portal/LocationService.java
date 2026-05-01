package com.sses.portal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Handler;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class LocationService extends Service {

    private static final String CHANNEL_ID       = "location_tracking";
    private static final String ALERT_CHANNEL_ID = "location_alert";
    private static final int    NOTIF_ID         = 101;
    private static final int    ALERT_NOTIF_ID   = 102;
    private static final int    MOCK_NOTIF_ID    = 103;
    private static final long   INTERVAL_MS          = 60 * 1000L;   // fallback
    private static final long   INTERVAL_MOVING      = 5  * 60 * 1000L; // 5 min — moving
    private static final long   INTERVAL_STOPPED     = 15 * 60 * 1000L; // 15 min — stopped
    private static final long   TIMEOUT_MS           = 20_000L; // 20s timeout
    private static final String PREFS                = "sses_prefs";
    private static final float  MAX_ACCURACY_M       = 200f;
    private static final int    MAX_ACCURACY_RETRIES = 3;
    private static final long   ACCURACY_RETRY_MS    = 10_000L;
    private static final float  STOPPED_THRESHOLD_M  = 200f; // 200m se kam move = stopped
    private static final int    MAX_QUEUE_SIZE        = 20;
    private static final String QUEUE_KEY             = "pending_pings";
    private int     accuracyRetryCount = 0;
    private double  lastSentLat        = Double.NaN;
    private double  lastSentLng        = Double.NaN;

    private Handler                     bgHandler;
    private HandlerThread               handlerThread;
    private Runnable                    locationRunnable;
    private FusedLocationProviderClient fusedClient;
    private LocationCallback            locationCallback;
    private CancellationTokenSource     activeCts;
    private boolean                     isRunning = false;
    private long                        lastSentTime = 0;
    private boolean                     mockNotifShown = false;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient   = LocationServices.getFusedLocationProviderClient(this);
        handlerThread = new HandlerThread("LocationBgThread");
        handlerThread.start();
        bgHandler = new Handler(handlerThread.getLooper());
        createNotificationChannels();
        setupContinuousLocation();
    }

    // Continuous high-accuracy location updates — GPS warm rehega
    private void setupContinuousLocation() {
        LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 30_000L)
            .setMinUpdateIntervalMillis(15_000L)   // min 15s between updates
            .setMaxUpdateDelayMillis(60_000L)
            .setWaitForAccurateLocation(true)
            .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                // GPS warm — sirf store karo, send nahi karo (scheduleNext send karega)
                // Yeh sirf GPS cache warm rakhta hai
            }
        };

        try {
            fusedClient.requestLocationUpdates(req, locationCallback,
                android.os.Looper.getMainLooper());
        } catch (SecurityException e) { e.printStackTrace(); }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String token        = intent.getStringExtra("token");
            String refreshToken = intent.getStringExtra("refreshToken");
            String apiUrl       = intent.getStringExtra("apiUrl");
            if (token != null && apiUrl != null) {
                SharedPreferences.Editor ed = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
                ed.putString("token", token);
                ed.putString("apiUrl", apiUrl);
                if (refreshToken != null) ed.putString("refreshToken", refreshToken);
                ed.apply();
            }
        }
        startForeground(NOTIF_ID, buildForegroundNotification());
        if (!isRunning) { isRunning = true; scheduleNext(0); }
        return START_STICKY;
    }

    private void scheduleNext(long delayMs) {
        locationRunnable = () -> {
            long startTime = System.currentTimeMillis();
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            String token  = prefs.getString("token",  null);
            String apiUrl = prefs.getString("apiUrl", null);
            long   nextInterval = prefs.getLong("next_interval", INTERVAL_MOVING);

            java.util.TimeZone ist = java.util.TimeZone.getTimeZone("Asia/Kolkata");
            java.util.Calendar cal = java.util.Calendar.getInstance(ist);
            int hour = cal.get(java.util.Calendar.HOUR_OF_DAY);

            int dayOfWeek = cal.get(java.util.Calendar.DAY_OF_WEEK);
            boolean isSunday = (dayOfWeek == java.util.Calendar.SUNDAY);
            if (!isSunday && hour >= 7 && hour < 19) {
                fetchAndSendLocation(token, apiUrl, startTime, nextInterval);
            } else {
                scheduleNext(INTERVAL_MOVING);
            }
        };
        bgHandler.postDelayed(locationRunnable, delayMs);
    }

    // ─── Token Refresh ────────────────────────────────────────────────────────

    /** Calls /auth/refresh with stored refreshToken, saves new accessToken.
     *  Returns new accessToken on success, null on failure. */
    private String refreshAccessToken(String apiUrl) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String refreshToken = prefs.getString("refreshToken", null);
        if (refreshToken == null || apiUrl == null) return null;

        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiUrl + "/auth/refresh");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);

            // Send refreshToken in body (Android can't use httpOnly cookies)
            JSONObject body = new JSONObject();
            body.put("refreshToken", refreshToken);
            byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            OutputStream os = conn.getOutputStream();
            os.write(data); os.flush(); os.close();

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                JSONObject resp = new JSONObject(sb.toString());
                String newAccessToken  = resp.getString("token");
                String newRefreshToken = resp.optString("refreshToken", refreshToken);

                // Save updated tokens
                prefs.edit()
                    .putString("token", newAccessToken)
                    .putString("refreshToken", newRefreshToken)
                    .apply();

                return newAccessToken;
            }
            // Refresh token bhi expire — user ko re-login karna hoga
            if (code == 401) stopSelf();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    // ─── Location Fetch ───────────────────────────────────────────────────────

    private void fetchAndSendLocation(String token, String apiUrl, long startTime, long adaptiveInterval) {
        if (token == null || apiUrl == null) {
            scheduleNext(adaptiveInterval);
            return;
        }

        if (activeCts != null) activeCts.cancel();
        activeCts = new CancellationTokenSource();
        CancellationTokenSource cts = activeCts;

        // Timeout — agar GPS fix nahi mila to unavailable ping bhejo
        bgHandler.postDelayed(() -> {
            if (!cts.getToken().isCancellationRequested()) {
                cts.cancel();
                sendUnavailablePing(token, apiUrl);
                long elapsed = System.currentTimeMillis() - startTime;
                scheduleNext(Math.max(0, adaptiveInterval - elapsed));
            }
        }, TIMEOUT_MS);

        try {
            fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                .addOnSuccessListener(location -> {
                    if (cts.getToken().isCancellationRequested()) return;
                    cts.cancel();

                    long elapsed = System.currentTimeMillis() - startTime;
                    long nextDelay = Math.max(0, adaptiveInterval - elapsed);

                    if (location == null) {
                        sendUnavailablePing(token, apiUrl);
                        accuracyRetryCount = 0;
                        scheduleNext(nextDelay);
                    } else if (isSuspiciousLocation(location)) {
                        // Mock ya suspicious location detected
                        showMockLocationNotification();
                        sendMockPing(token, apiUrl);
                        accuracyRetryCount = 0;
                        scheduleNext(nextDelay);
                    } else if (location.hasAccuracy() && location.getAccuracy() > MAX_ACCURACY_M
                               && accuracyRetryCount < MAX_ACCURACY_RETRIES) {
                        // GPS fix weak hai — thoda wait karke retry karo
                        accuracyRetryCount++;
                        scheduleNext(ACCURACY_RETRY_MS);
                    } else {
                        dismissLocationOffNotification();
                        dismissMockLocationNotification();
                        accuracyRetryCount = 0;
                        sendLocation(location, token, apiUrl);
                        scheduleNext(nextDelay);
                    }
                })
                .addOnFailureListener(e -> {
                    e.printStackTrace();
                    sendUnavailablePing(token, apiUrl);
                    long elapsed = System.currentTimeMillis() - startTime;
                    scheduleNext(Math.max(0, adaptiveInterval - elapsed));
                });
        } catch (SecurityException e) {
            e.printStackTrace();
            sendUnavailablePing(token, apiUrl);
            scheduleNext(adaptiveInterval);
        }
    }

    // ─── HTTP Helpers ─────────────────────────────────────────────────────────

    /** Generic POST — offline queue support + 401 retry */
    private void postWithRefresh(String apiUrl, JSONObject body) {
        new Thread(() -> {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            String token = prefs.getString("token", null);
            if (token == null) { queuePing(body); return; }

            // Pehle pending queue flush karo
            flushQueue(apiUrl, token);

            int code = doPost(apiUrl + "/attendance/location", token, body);
            if (code == 401) {
                String newToken = refreshAccessToken(apiUrl);
                if (newToken != null) code = doPost(apiUrl + "/attendance/location", newToken, body);
            }
            // Network fail — queue me daalo
            if (code == -1) queuePing(body);
        }).start();
    }

    /** Pending pings queue me add karo (max 20) */
    private void queuePing(JSONObject body) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            JSONArray queue = new JSONArray(prefs.getString(QUEUE_KEY, "[]"));
            if (queue.length() >= MAX_QUEUE_SIZE) queue.remove(0); // purana hata do
            queue.put(body);
            prefs.edit().putString(QUEUE_KEY, queue.toString()).apply();
        } catch (Exception e) { e.printStackTrace(); }
    }

    /** Queue me stored pings server pe bhejo */
    private void flushQueue(String apiUrl, String token) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            String raw = prefs.getString(QUEUE_KEY, "[]");
            JSONArray queue = new JSONArray(raw);
            if (queue.length() == 0) return;

            JSONArray remaining = new JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject ping = queue.getJSONObject(i);
                int code = doPost(apiUrl + "/attendance/location", token, ping);
                if (code == -1) remaining.put(ping); // still failed — rakhna hoga
            }
            prefs.edit().putString(QUEUE_KEY, remaining.toString()).apply();
        } catch (Exception e) { e.printStackTrace(); }
    }

    /** Returns HTTP response code, -1 on exception */
    private int doPost(String urlStr, String token, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);

            byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            OutputStream os = conn.getOutputStream();
            os.write(data); os.flush(); os.close();

            return conn.getResponseCode();
        } catch (Exception e) {
            e.printStackTrace();
            return -1;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // Extra mock checks — isFromMockProvider ke alawa
    private boolean isSuspiciousLocation(Location loc) {
        if (loc.isFromMockProvider()) return true;
        // Perfect zero accuracy — real GPS kabhi exactly 0 nahi hota
        if (loc.hasAccuracy() && loc.getAccuracy() == 0f) return true;
        // Unrealistic speed — 200 km/h se zyada field me impossible
        if (loc.hasSpeed() && loc.getSpeed() > 55f) return true;
        // Unrealistic altitude — India me 5000m+ ya negative
        if (loc.hasAltitude() && (loc.getAltitude() > 5000 || loc.getAltitude() < -100)) return true;
        return false;
    }

    private void sendLocation(Location location, String token, String apiUrl) {
        try {
            // Adaptive interval — last sent location se distance check karo
            float[] results = new float[1];
            long nextInterval = INTERVAL_MOVING; // default moving
            if (!Double.isNaN(lastSentLat)) {
                android.location.Location.distanceBetween(lastSentLat, lastSentLng,
                    location.getLatitude(), location.getLongitude(), results);
                nextInterval = results[0] < STOPPED_THRESHOLD_M ? INTERVAL_STOPPED : INTERVAL_MOVING;
            }
            lastSentLat = location.getLatitude();
            lastSentLng = location.getLongitude();

            // Store next interval in prefs so scheduleNext can use it after postWithRefresh
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putLong("next_interval", nextInterval).apply();

            JSONObject body = new JSONObject();
            body.put("lat",       location.getLatitude());
            body.put("lng",       location.getLongitude());
            body.put("accuracy",  location.hasAccuracy() ? location.getAccuracy() : -1);
            body.put("status",    "ok");
            body.put("timestamp", System.currentTimeMillis());
            postWithRefresh(apiUrl, body);
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void sendUnavailablePing(String token, String apiUrl) {
        try {
            JSONObject body = new JSONObject();
            body.put("status",    "unavailable");
            body.put("timestamp", System.currentTimeMillis());
            postWithRefresh(apiUrl, body);
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void sendMockPing(String token, String apiUrl) {
        try {
            JSONObject body = new JSONObject();
            body.put("status",    "mock");
            body.put("timestamp", System.currentTimeMillis());
            postWithRefresh(apiUrl, body);
        } catch (Exception e) { e.printStackTrace(); }
    }

    // ─── Notifications ────────────────────────────────────────────────────────

    private void dismissLocationOffNotification() {
        getSystemService(NotificationManager.class).cancel(ALERT_NOTIF_ID);
    }

    private void showMockLocationNotification() {
        if (mockNotifShown) return;
        mockNotifShown = true;
        Notification notif = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle("⚠️ Fake Location Detected!")
            .setContentText("Mock location app band karo. Fake location use karne par attendance block ho jayegi.")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .build();
        getSystemService(NotificationManager.class).notify(MOCK_NOTIF_ID, notif);
    }

    private void dismissMockLocationNotification() {
        mockNotifShown = false;
        getSystemService(NotificationManager.class).cancel(MOCK_NOTIF_ID);
    }

    private Notification buildForegroundNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SSES Portal")
            .setContentText("Location tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    private void createNotificationChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);

        // Delete old alert channel to force recreate with new sound settings
        nm.deleteNotificationChannel(ALERT_CHANNEL_ID);

        NotificationChannel trackingCh = new NotificationChannel(
            CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_LOW);
        trackingCh.setDescription("Background location tracking for attendance");
        nm.createNotificationChannel(trackingCh);

        NotificationChannel alertCh = new NotificationChannel(
            ALERT_CHANNEL_ID, "Location Alert", NotificationManager.IMPORTANCE_HIGH);
        alertCh.setDescription("Alert when location is disabled");
        alertCh.enableVibration(true);
        alertCh.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        alertCh.setSound(
            android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION),
            new android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        nm.createNotificationChannel(alertCh);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        if (bgHandler != null && locationRunnable != null)
            bgHandler.removeCallbacks(locationRunnable);
        if (activeCts != null) activeCts.cancel();
        if (locationCallback != null) fusedClient.removeLocationUpdates(locationCallback);
        if (handlerThread != null) handlerThread.quitSafely();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App swipe se band ho — service restart karo
        Intent restart = new Intent(getApplicationContext(), LocationService.class);
        restart.setPackage(getPackageName());
        startForegroundService(restart);
        super.onTaskRemoved(rootIntent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
