package com.sses.portal;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(LocationTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
