package com.fatyliser.eq

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import com.getcapacitor.BridgeActivity

/**
 * MainActivity - The Capacitor Bridge Entry Point.
 * Inherits from BridgeActivity and automatically binds to AudioEngineService.
 */
class MainActivity : BridgeActivity() {

    var audioService: AudioEngineService? = null
        private set

    private var isServiceBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? AudioEngineService.LocalBinder
            audioService = binder?.getService()
            isServiceBound = true
            Log.i(TAG, "AudioEngineService connected to MainActivity Capacitor Bridge")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            audioService = null
            isServiceBound = false
            Log.w(TAG, "AudioEngineService disconnected from MainActivity")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Register custom Capacitor plugin before super.onCreate
        registerPlugin(AudioEnginePlugin::class.java)
        super.onCreate(savedInstanceState)

        Log.i(TAG, "Starting and binding AudioEngineService...")
        startAndBindAudioService()
    }

    private fun startAndBindAudioService() {
        val serviceIntent = Intent(this, AudioEngineService::class.java)

        // Start foreground service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        // Bind for zero-latency direct method invocation from Capacitor Plugin
        bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isServiceBound) {
            unbindService(serviceConnection)
            isServiceBound = false
        }
    }

    companion object {
        const val TAG = "FatyliserMainActivity"
    }
}
