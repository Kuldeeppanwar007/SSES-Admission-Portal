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
import java.io.BufferedReader;
import java.io.InputStreamReader;
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
        // IST time check: only 7AM - 7PM, Sunday off
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"));
        int hour = cal.get(Calendar.HOUR_OF_DAY);
        int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);
        boolean isSunday = (dayOfWeek == Calendar.SUNDAY);
        if (isSunday || hour < 7 || hour >= 19) return Result.success();

        SharedPreferences prefs = getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token  = prefs.getString("token",  null);
        String apiUrl = prefs.getString("apiUrl", null);
        if (apiUrl == null) return Result.failure();
        if (token == null) return Result.failure();

        try {
            FusedLocationProviderClient client =
                LocationServices.getFusedLocationProviderClient(getApplicationContext());

            CancellationTokenSource cts = new CancellationTokenSource();
            // Tasks.await — synchronous call (WorkManager runs on background thread)
            Location location = Tasks.await(
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.getToken())
            );

            if (location == null) {
                sendPingWithRefresh(apiUrl, null, -1, "unavailable");
                return Result.success();
            }

            dismissLocationOffNotif();
            sendPingWithRefresh(apiUrl, location, location.hasAccuracy() ? location.getAccuracy() : -1, "ok");
            return Result.success();

        } catch (SecurityException e) {
            sendPingWithRefresh(apiUrl, null, -1, "unavailable");
            return Result.success();
        } catch (Exception e) {
            e.printStackTrace();
            return Result.retry();
        }
    }

    private void sendPingWithRefresh(String apiUrl, Location location, float accuracy, String status) {
        SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString("token", null);
        if (token == null) return;

        try {
            JSONObject body = new JSONObject();
            body.put("status", status);
            body.put("timestamp", System.currentTimeMillis());
            if (location != null) {
                body.put("lat", location.getLatitude());
                body.put("lng", location.getLongitude());
                body.put("accuracy", accuracy);
            }

            int code = doPost(apiUrl + "/attendance/location", token, body);
            if (code == 401) {
                String newToken = refreshAccessToken(apiUrl, prefs);
                if (newToken != null) doPost(apiUrl + "/attendance/location", newToken, body);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

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

    private String refreshAccessToken(String apiUrl, SharedPreferences prefs) {
        String refreshToken = prefs.getString("refreshToken", null);
        if (refreshToken == null) return null;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiUrl + "/auth/refresh");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            JSONObject body = new JSONObject();
            body.put("refreshToken", refreshToken);
            byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            OutputStream os = conn.getOutputStream();
            os.write(data); os.flush(); os.close();
            if (conn.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();
                JSONObject resp = new JSONObject(sb.toString());
                String newAccessToken  = resp.getString("token");
                String newRefreshToken = resp.optString("refreshToken", refreshToken);
                prefs.edit().putString("token", newAccessToken).putString("refreshToken", newRefreshToken).apply();
                return newAccessToken;
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
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
