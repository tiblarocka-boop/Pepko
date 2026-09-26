import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  X,
  FileCode,
  FileText
} from 'lucide-react';

interface NativeInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FILES = [
  {
    name: 'AudioEngineService.kt',
    path: 'android/app/src/main/java/com/fatyliser/eq/AudioEngineService.kt',
    description: 'Crash-proof 32-band Pre-EQ DynamicsProcessing engine with exponential frequency fix & audio_flinger parser.',
    code: `package com.fatyliser.eq

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.audiofx.DynamicsProcessing
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.ConcurrentHashMap

class AudioEngineService : Service() {
    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val bandGains = FloatArray(BAND_COUNT) { 0.0f }
    private val activeEffects = ConcurrentHashMap<Int, DynamicsProcessing>()
    private val sessionSources = ConcurrentHashMap<Int, String>()
    private var limiterEnabled = true
    private var limiterThresholdDb = -0.5f
    private var isEngineActive = true

    inner class LocalBinder : Binder() {
        fun getService(): AudioEngineService = this@AudioEngineService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Active - 32 Bands DynamicsProcessing"))
        attachSession(0, "System Audio Mix (Global)")
        startAudioFlingerMonitoring()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent?): IBinder = binder

    private fun applyEqualizerToSession(sessionId: Int, sourceTag: String) {
        if (activeEffects.containsKey(sessionId)) return
        try {
            val builder = DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                CHANNEL_COUNT, // 2 (Stereo: 0=Left, 1=Right)
                true,          // preEqInUse
                BAND_COUNT,    // 32 bands
                false, 0, false, 0, true // native limiter
            )

            val preEq = DynamicsProcessing.Eq(true, true, BAND_COUNT)

            // MANDATORY FREQUENCY FIX:
            // Ascending exponential formula to prevent unhandled C++ hardware initialization exceptions
            for (i in 0 until BAND_COUNT) {
                val cutoffFreq = (20.0f * Math.pow(1.25, i.toDouble())).toFloat()
                val eqBand = DynamicsProcessing.EqBand(true, cutoffFreq, bandGains[i])
                preEq.setBand(i, eqBand)
            }
            builder.setPreEqAllChannelsTo(preEq)

            val limiter = DynamicsProcessing.Limiter(
                true, limiterEnabled, 0, 1.0f, 50.0f, 10.0f, limiterThresholdDb, 0.0f
            )
            builder.setLimiterAllChannelsTo(limiter)

            val dp = DynamicsProcessing(0, sessionId, builder.build())

            // Initialize both channels sequentially
            for (channel in 0 until CHANNEL_COUNT) {
                for (i in 0 until BAND_COUNT) {
                    val band = dp.getPreEqBandByChannelIndex(channel, i)
                    band.cutoffFrequency = (20.0f * Math.pow(1.25, i.toDouble())).toFloat()
                    band.gain = bandGains[i]
                    band.enabled = true
                    dp.setPreEqBandByChannelIndex(channel, i, band)
                }
            }

            dp.enabled = isEngineActive
            activeEffects[sessionId] = dp
            sessionSources[sessionId] = sourceTag
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to initialize DynamicsProcessing on session $sessionId", t)
        }
    }

    private fun startAudioFlingerMonitoring() {
        serviceScope.launch {
            val sessionRegex = Regex("Session\\\\s+(\\\\d+)")
            while (isActive) {
                try {
                    val process = Runtime.getRuntime().exec(arrayOf("dumpsys", "media.audio_flinger"))
                    val reader = BufferedReader(InputStreamReader(process.inputStream))
                    var isYouTube = false
                    val detectedSessions = mutableMapOf<Int, String>()

                    reader.forEachLine { line ->
                        if (line.contains("com.google.android.youtube", ignoreCase = true)) {
                            isYouTube = true
                        }
                        val match = sessionRegex.find(line)
                        if (match != null) {
                            val sessionId = match.groupValues[1].toInt()
                            if (sessionId > 0) {
                                detectedSessions[sessionId] = if (isYouTube) "YouTube" else "Audio Stream"
                            }
                        }
                        if (line.trim().isEmpty()) isYouTube = false
                    }
                    process.waitFor()

                    for ((id, src) in detectedSessions) {
                        if (!activeEffects.containsKey(id)) applyEqualizerToSession(id, src)
                    }
                } catch (e: Exception) {}
                delay(2500)
            }
        }
    }

    fun updateBandGain(index: Int, gainDb: Float) {
        if (index !in 0 until BAND_COUNT) return
        bandGains[index] = gainDb
        activeEffects.values.forEach { dp ->
            try {
                for (ch in 0 until CHANNEL_COUNT) {
                    val band = dp.getPreEqBandByChannelIndex(ch, index)
                    band.gain = gainDb
                    band.enabled = true
                    dp.setPreEqBandByChannelIndex(ch, index, band)
                }
            } catch (e: Exception) {}
        }
    }

    fun getBandGains(): FloatArray = bandGains.clone()
    fun getActiveSessionCount(): Int = activeEffects.size

    companion object {
        const val TAG = "FatyliserAudioEngine"
        const val BAND_COUNT = 32
        const val CHANNEL_COUNT = 2
        const val NOTIFICATION_ID = 4040
    }
}`
  },
  {
    name: 'MainActivity.kt',
    path: 'android/app/src/main/java/com/fatyliser/eq/MainActivity.kt',
    description: 'Capacitor Bridge entry point inheriting from BridgeActivity, starts and binds AudioEngineService.',
    code: `package com.fatyliser.eq

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    var audioService: AudioEngineService? = null
        private set
    private var isServiceBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? AudioEngineService.LocalBinder
            audioService = binder?.getService()
            isServiceBound = true
            Log.i("MainActivity", "AudioEngineService bound successfully to BridgeActivity")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            audioService = null
            isServiceBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(AudioEnginePlugin::class.java)
        super.onCreate(savedInstanceState)
        startAndBindAudioService()
    }

    private fun startAndBindAudioService() {
        val serviceIntent = Intent(this, AudioEngineService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isServiceBound) {
            unbindService(serviceConnection)
            isServiceBound = false
        }
    }
}`
  },
  {
    name: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    description: 'Target SDK 34, FOREGROUND_SERVICE_MEDIA_PLAYBACK, DUMP, RECEIVE_BOOT_COMPLETED.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.fatyliser.eq">

    <!-- Permissions required for Background Equalizer Engine & Audio Flinger Parsing -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.DUMP" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:label="Fatyliser"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Crash-Proof Media Playback Foreground Audio Engine Service -->
        <service
            android:name=".AudioEngineService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>`
  },
  {
    name: 'gradle.properties',
    path: 'android/gradle.properties',
    description: 'Explicit android.useAndroidX=true configuration.',
    code: `# Project-wide Gradle settings.
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8`
  }
];

export const NativeInspectorModal: React.FC<NativeInspectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentFile = FILES[selectedFileIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-800/80 flex items-center justify-center text-amber-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Native Android & Kotlin Architecture Inspector
              </h3>
              <p className="text-xs text-zinc-400">
                Inspect the generated Kotlin services, Capacitor Bridge, and Manifest
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-850 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-zinc-800 bg-zinc-900/30 overflow-x-auto">
          {FILES.map((file, idx) => (
            <button
              key={file.name}
              onClick={() => {
                setSelectedFileIdx(idx);
                setCopied(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono rounded-t-lg transition cursor-pointer border-t border-x ${
                selectedFileIdx === idx
                  ? 'bg-zinc-950 text-cyan-400 border-zinc-700 font-bold'
                  : 'bg-zinc-900/40 text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{file.name}</span>
            </button>
          ))}
        </div>

        {/* File Path & Description Bar */}
        <div className="px-6 py-2 bg-zinc-900/50 border-b border-zinc-800/60 flex items-center justify-between text-xs font-mono">
          <div className="text-zinc-400 truncate mr-2">
            <span className="text-zinc-500">File: </span>
            <span className="text-zinc-300">{currentFile.path}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-sans transition cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Source'}</span>
          </button>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-auto p-4 bg-black/60 font-mono text-xs text-zinc-300 leading-relaxed selection:bg-cyan-900 selection:text-cyan-200">
          <pre className="whitespace-pre">
            <code>{currentFile.code}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs">
          <span className="text-zinc-500">{currentFile.description}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
