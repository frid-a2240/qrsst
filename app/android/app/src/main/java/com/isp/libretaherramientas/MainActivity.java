package com.isp.libretaherramientas;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(Actualizador.class);
        super.onCreate(savedInstanceState);
    }
}
