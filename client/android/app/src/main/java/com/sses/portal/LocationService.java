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
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class LocationService extends Service {

    private static final String CHANNEL_ID       = "location_tracking";
    private static final String ALERT_CHANNEL_ID = "location_alert";
    private static final int    NOTIF_ID         = 101;
    private static final int    ALERT_NOTIF_ID   = 102;
    private static final long   INTERVAL_MS      = 2 * 60 * 1000L;
    private static final long   TIMEOUT_MS       = 30_000L;
    private static final String PREFS            = "sses_prefs";

    private Handler               bgHandler;
    private HandlerThread         handlerThread;
    private Runnable              locationRunnable;
    private FusedLocationProviderClient fusedClient;
    private CancellationTokenSource activeCts;
    private boolean               isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient   = LocationServices.getFusedLocationProviderClient(this);
        handlerThread = new HandlerThread("LocationBgThread");
        handlerThread.start();
        bgHandler = new Handler(handlerThread.getLooper());
        createNotificationChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String token  = intent.getStringExtra("token");
            String apiUrl = intent.getStringExtra("apiUrl");
            if (token != null && apiUrl != null) {
                SharedPreferences.Editor ed = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
                ed.putString("token", token);
                ed.putString("apiUrl", apiUrl);
                ed.apply();
            }
        }
        startForeground(NOTIF_ID, buildForegroundNotification());
        if (!isRunning) { isRunning = true; scheduleNext(0); }
        return START_STICKY;
    }

    private void scheduleNext(long delayMs) {
        locationRunnable = () -> {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            String token  = prefs.getString("token",  null);
            String apiUrl = prefs.getString("apiUrl", null);

            // India time (IST = UTC+5:30)
            java.util.TimeZone ist = java.util.TimeZone.getTimeZone("Asia/Kolkata");
            java.util.Calendar cal = java.util.Calendar.getInstance(ist);
            int hour = cal.get(java.util.Calendar.HOUR_OF_DAY); // 0-23

            if (hour >= 7 && hour < 18) {
                // Working hours (7AM - 6PM IST) — fetch location
                fetchAndSendLocation(token, apiUrl);
            }
            // Outside working hours — skip silently, schedule next check
            scheduleNext(INTERVAL_MS);
        };
        bgHandler.postDelayed(locationRunnable, delayMs);
    }

    private void fetchAndSendLocation(String token, String apiUrl) {
        if (token == null || apiUrl == null) return;

        if (activeCts != null) activeCts.cancel();
        activeCts = new CancellationTokenSource();
        CancellationTokenSource cts = activeCts;

        // Timeout handler
        bgHandler.postDelayed(() -> {
            if (!cts.getToken().isCancellationRequested()) {
                cts.cancel();
                // Timeout = location unavailable
                showLocationOffNotification();
                sendUnavailablePing(token, apiUrl);
            }
        }, TIMEOUT_MS);

        try {
            fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                .addOnSuccessListener(location -> {
                    if (cts.getToken().isCancellationRequested()) return;
                    cts.cancel(); // cancel timeout handler

                    if (location == null) {
                        // Location truly unavailable (GPS off / permission denied)
                        showLocationOffNotification();
                        sendUnavailablePing(token, apiUrl);
                        return;
                    }
                    // Location OK — send regardless of accuracy (accuracy is just metadata)
                    dismissLocationOffNotification();
                    sendLocation(location, token, apiUrl);
                })
                .addOnFailureListener(e -> {
                    e.printStackTrace();
                    showLocationOffNotification();
                    sendUnavailablePing(token, apiUrl);
                });
        } catch (SecurityException e) {
            e.printStackTrace();
            showLocationOffNotification();
            sendUnavailablePing(token, apiUrl);
        }
    }

    // Option B — Show notification to user
    private void showLocationOffNotification() {
        Notification notif = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
            .setContentTitle("⚠️ Location Band Hai!")
            .setContentText("SSES Portal ke liye location on rakhen. Band rehne par attendance block ho sakti hai.")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .build();
        getSystemService(NotificationManager.class).notify(ALERT_NOTIF_ID, notif);
    }

    private void dismissLocationOffNotification() {
        getSystemService(NotificationManager.class).cancel(ALERT_NOTIF_ID);
    }

    // Option A — Send unavailable ping to backend (admin ko flag)
    private void sendUnavailablePing(String token, String apiUrl) {
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(apiUrl + "/attendance/location");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);

                JSONObject body = new JSONObject();
                body.put("status", "unavailable");
                body.put("timestamp", System.currentTimeMillis());

                byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(data.length);
                OutputStream os = conn.getOutputStream();
                os.write(data); os.flush(); os.close();

                int code = conn.getResponseCode();
                if (code == 401) stopSelf();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private void sendLocation(Location location, String token, String apiUrl) {
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(apiUrl + "/attendance/location");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);

                JSONObject body = new JSONObject();
                body.put("lat",       location.getLatitude());
                body.put("lng",       location.getLongitude());
                body.put("accuracy",  location.hasAccuracy() ? location.getAccuracy() : -1);
                body.put("status",    "ok");
                body.put("timestamp", System.currentTimeMillis());

                byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(data.length);
                OutputStream os = conn.getOutputStream();
                os.write(data); os.flush(); os.close();

                int code = conn.getResponseCode();
                if (code == 401) stopSelf();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
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

        // Foreground service channel (low priority, silent)
        NotificationChannel trackingCh = new NotificationChannel(
            CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_LOW);
        trackingCh.setDescription("Background location tracking for attendance");
        nm.createNotificationChannel(trackingCh);

        // Alert channel (high priority, makes sound)
        NotificationChannel alertCh = new NotificationChannel(
            ALERT_CHANNEL_ID, "Location Alert", NotificationManager.IMPORTANCE_HIGH);
        alertCh.setDescription("Alert when location is disabled");
        nm.createNotificationChannel(alertCh);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        if (bgHandler != null && locationRunnable != null)
            bgHandler.removeCallbacks(locationRunnable);
        if (activeCts != null) activeCts.cancel();
        if (handlerThread != null) handlerThread.quitSafely();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
