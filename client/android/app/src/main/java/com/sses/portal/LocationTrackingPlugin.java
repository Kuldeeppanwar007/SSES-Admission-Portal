package com.sses.portal;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocationTracking")
public class LocationTrackingPlugin extends Plugin {

    @PluginMethod
    public void startTracking(PluginCall call) {
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");

        Intent intent = new Intent(getContext(), LocationService.class);
        intent.putExtra("token", token);
        intent.putExtra("apiUrl", apiUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            getContext().startForegroundService(intent);
        else
            getContext().startService(intent);

        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        getContext().stopService(new Intent(getContext(), LocationService.class));
        call.resolve();
    }
}
