package com.sses.portal;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "LocationTracking")
public class LocationTrackingPlugin extends Plugin {

    private static final String WORK_TAG = "sses_location_work";
    private static final String PREFS    = "sses_prefs";

    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            boolean ignored = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("granted", ignored);
            call.resolve(ret);
        } else {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        String token  = call.getString("token");
        String apiUrl = call.getString("apiUrl");

        // Save credentials
        SharedPreferences.Editor ed = getContext()
            .getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit();
        ed.putString("token", token);
        ed.putString("apiUrl", apiUrl);
        ed.apply();

        // Start Foreground Service (immediate first ping)
        Intent intent = new Intent(getContext(), LocationService.class);
        intent.putExtra("token", token);
        intent.putExtra("apiUrl", apiUrl);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            getContext().startForegroundService(intent);
        else
            getContext().startService(intent);

        // Schedule WorkManager (survives force close + reboot)
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        PeriodicWorkRequest workRequest = new PeriodicWorkRequest.Builder(
            LocationWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .addTag(WORK_TAG)
            .build();

        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(
            WORK_TAG,
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        );

        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        // Stop foreground service
        getContext().stopService(new Intent(getContext(), LocationService.class));
        // Cancel WorkManager
        WorkManager.getInstance(getContext()).cancelAllWorkByTag(WORK_TAG);
        call.resolve();
    }
}
