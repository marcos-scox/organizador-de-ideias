package com.marcosdev.organizadordeideias;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupFolderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
