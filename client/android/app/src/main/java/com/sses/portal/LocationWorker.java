package com.sses.portal;

import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.Tasks;
import com.google.android.gms.tasks.CancellationTokenSource;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.TimeZone;

public class LocationWorker extends Worker {

    private static final String PREFS = "sses_prefs";

    public LocationWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        // IST time check: only 7AM - 6PM
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"));
        int hour = cal.get(Calendar.HOUR_OF_DAY);
        if (hour < 7 || hour >= 18) return Result.success();

        SharedPreferences prefs = getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token  = prefs.getString("token",  null);
        String apiUrl = prefs.getString("apiUrl", null);
        if (token == null || apiUrl == null) return Result.failure();

        try {
            FusedLocationProviderClient client =
                LocationServices.getFusedLocationProviderClient(getApplicationContext());

            CancellationTokenSource cts = new CancellationTokenSource();
            // Tasks.await — synchronous call (WorkManager runs on background thread)
            Location location = Tasks.await(
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
            );

            if (location == null) {
                sendPing(token, apiUrl, null, -1, "unavailable");
                showLocationOffNotif();
                return Result.success();
            }

            dismissLocationOffNotif();
            sendPing(token, apiUrl, location, location.hasAccuracy() ? location.getAccuracy() : -1, "ok");
            return Result.success();

        } catch (SecurityException e) {
            sendPing(token, apiUrl, null, -1, "unavailable");
            return Result.success();
        } catch (Exception e) {
            e.printStackTrace();
            return Result.retry();
        }
    }

    private void sendPing(String token, String apiUrl, Location location, float accuracy, String status) {
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
            body.put("status", status);
            body.put("timestamp", System.currentTimeMillis());
            if (location != null) {
                body.put("lat", location.getLatitude());
                body.put("lng", location.getLongitude());
                body.put("accuracy", accuracy);
            }

            byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            OutputStream os = conn.getOutputStream();
            os.write(data); os.flush(); os.close();
            conn.getResponseCode();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void showLocationOffNotif() {
        try {
            android.app.NotificationManager nm =
                (android.app.NotificationManager) getApplicationContext()
                    .getSystemService(Context.NOTIFICATION_SERVICE);

            // Delete old channel to force recreate with sound
            nm.deleteNotificationChannel("location_alert");

            android.app.NotificationChannel ch = new android.app.NotificationChannel(
                "location_alert", "Location Alert", android.app.NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            ch.setSound(
                android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION),
                new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            nm.createNotificationChannel(ch);

            androidx.core.app.NotificationCompat.Builder b =
                new androidx.core.app.NotificationCompat.Builder(getApplicationContext(), "location_alert")
                    .setContentTitle("⚠️ Location Band Hai!")
                    .setContentText("SSES Portal ke liye location on rakhen. Band rehne par attendance block ho sakti hai.")
                    .setSmallIcon(android.R.drawable.ic_dialog_alert)
                    .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(false);
            nm.notify(102, b.build());
        } catch (Exception ignored) {}
    }

    private void dismissLocationOffNotif() {
        try {
            android.app.NotificationManager nm =
                (android.app.NotificationManager) getApplicationContext()
                    .getSystemService(Context.NOTIFICATION_SERVICE);
            nm.cancel(102);
        } catch (Exception ignored) {}
    }
}
