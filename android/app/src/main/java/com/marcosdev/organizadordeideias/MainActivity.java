package com.marcosdev.organizadordeideias;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PdfSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
