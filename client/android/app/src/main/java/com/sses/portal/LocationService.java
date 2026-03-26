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

    private static final String CHANNEL_ID = "location_tracking";
    private static final int NOTIF_ID = 101;
    private static final long INTERVAL_MS = 60 * 60 * 1000L; // 1 hour
    private static final float MIN_ACCURACY_METERS = 50f;    // reject if accuracy > 50m
    private static final long LOCATION_TIMEOUT_MS = 30000L;  // 30 sec timeout
    private static final String PREFS = "sses_prefs";

    private Handler bgHandler;
    private HandlerThread handlerThread;
    private Runnable locationRunnable;
    private FusedLocationProviderClient fusedClient;
    private CancellationTokenSource activeCts;
    private boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        handlerThread = new HandlerThread("LocationBgThread");
        handlerThread.start();
        bgHandler = new Handler(handlerThread.getLooper());
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Save token+apiUrl to SharedPreferences so they survive service restart
        if (intent != null) {
            String token = intent.getStringExtra("token");
            String apiUrl = intent.getStringExtra("apiUrl");
            if (token != null && apiUrl != null) {
                SharedPreferences.Editor ed = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
                ed.putString("token", token);
                ed.putString("apiUrl", apiUrl);
                ed.apply();
            }
        }

        startForeground(NOTIF_ID, buildNotification());

        // Prevent multiple runnables stacking
        if (!isRunning) {
            isRunning = true;
            scheduleNext(0);
        }

        return START_STICKY;
    }

    private void scheduleNext(long delayMs) {
        locationRunnable = () -> {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            String token = prefs.getString("token", null);
            String apiUrl = prefs.getString("apiUrl", null);
            fetchAndSendLocation(token, apiUrl);
            scheduleNext(INTERVAL_MS);
        };
        bgHandler.postDelayed(locationRunnable, delayMs);
    }

    private void fetchAndSendLocation(String token, String apiUrl) {
        if (token == null || apiUrl == null) return;

        // Cancel any previous pending request
        if (activeCts != null) activeCts.cancel();
        activeCts = new CancellationTokenSource();
        CancellationTokenSource cts = activeCts;

        // Timeout: cancel after 30s if no location
        bgHandler.postDelayed(() -> {
            if (!cts.getToken().isCancellationRequested()) cts.cancel();
        }, LOCATION_TIMEOUT_MS);

        try {
            fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
                .addOnSuccessListener(location -> {
                    if (location == null) return;
                    // Reject low-accuracy locations
                    if (location.hasAccuracy() && location.getAccuracy() > MIN_ACCURACY_METERS) return;
                    sendLocation(location, token, apiUrl);
                })
                .addOnFailureListener(e -> e.printStackTrace());
        } catch (SecurityException e) {
            e.printStackTrace();
        }
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
                body.put("lat", location.getLatitude());
                body.put("lng", location.getLongitude());
                body.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : -1);
                body.put("timestamp", System.currentTimeMillis());

                byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(data.length);
                OutputStream os = conn.getOutputStream();
                os.write(data);
                os.flush();
                os.close();

                int code = conn.getResponseCode();
                // If 401 (token expired), stop service
                if (code == 401) stopSelf();

            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SSES Portal")
            .setContentText("Location tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Tracks location every hour for attendance");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
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
