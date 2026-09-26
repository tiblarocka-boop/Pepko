package com.fatyliser.eq

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.audiofx.AudioEffect
import android.media.audiofx.DynamicsProcessing
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.ConcurrentHashMap

/**
 * AudioEngineService - Crash-Proof System-Wide DynamicsProcessing Equalizer
 *
 * Runs as a sticky foreground mediaPlayback service.
 * Applies a 32-band Pre-EQ parametric curve and native Limiter per active audio session.
 * Actively tracks hidden YouTube and system playback sessions via audio_flinger dumpsys parsing.
 */
class AudioEngineService : Service() {

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // 32-band equalizer gains in decibels (-15.0 dB to +15.0 dB)
    private val bandGains = FloatArray(BAND_COUNT) { 0.0f }

    // Map of active session ID to its DynamicsProcessing effect instance
    private val activeEffects = ConcurrentHashMap<Int, DynamicsProcessing>()

    // Metadata for active sessions (e.g., package source, track id)
    private val sessionSources = ConcurrentHashMap<Int, String>()

    // Calculated cutoff frequencies across the 32 bands
    private val cutoffFrequencies = FloatArray(BAND_COUNT)

    // Engine settings
    private var limiterEnabled = true
    private var limiterThresholdDb = -0.5f
    private var isEngineActive = true

    inner class LocalBinder : Binder() {
        fun getService(): AudioEngineService = this@AudioEngineService
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "AudioEngineService initializing...")

        // Precompute ascending exponential frequencies to avoid duplicate calculation
        for (i in 0 until BAND_COUNT) {
            cutoffFrequencies[i] = (20.0f * Math.pow(1.25, i.toDouble())).toFloat()
        }

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Active - 32 Bands DynamicsProcessing"))

        // Register default global output mix session (Session 0)
        attachSession(0, "System Audio Mix (Global)")

        // Start background polling coroutine for audio_flinger inspection
        startAudioFlingerMonitoring()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "AudioEngineService onStartCommand (START_STICKY)")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onDestroy() {
        Log.i(TAG, "AudioEngineService destroying. Releasing audio effects...")
        serviceScope.cancel()
        releaseAllEffects()
        super.onDestroy()
    }

    /**
     * Initializes DynamicsProcessing with 32-band Pre-EQ and Limiter on an audio session.
     * Includes the MANDATORY ascending exponential frequency fix across both stereo channels.
     */
    private fun applyEqualizerToSession(sessionId: Int, sourceTag: String) {
        if (activeEffects.containsKey(sessionId)) {
            Log.d(TAG, "Session $sessionId already attached.")
            return
        }

        try {
            Log.i(TAG, "Applying 32-Band DynamicsProcessing to Audio Session $sessionId ($sourceTag)")

            // 1. Build initial DynamicsProcessing configuration
            val builder = DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                CHANNEL_COUNT, // 2 channels (Stereo: 0 = Left, 1 = Right)
                true,          // preEqInUse
                BAND_COUNT,    // preEqBandCount: 32 bands
                false,         // mbcInUse
                0,             // mbcBandCount
                false,         // postEqInUse
                0,             // postEqBandCount
                true           // limiterInUse: true
            )

            // Setup 32-band Eq prototype
            val preEq = DynamicsProcessing.Eq(true, true, BAND_COUNT)

            // MANDATORY FREQUENCY FIX:
            // Initialize 32 bands sequentially using an ascending exponential formula
            // (band.cutoffFrequency = 20f * Math.pow(1.25, i.toDouble()).toFloat())
            // to prevent unhandled C++ hardware initialization exceptions in AudioFlinger.
            for (i in 0 until BAND_COUNT) {
                val cutoffFreq = (20.0f * Math.pow(1.25, i.toDouble())).toFloat()
                val eqBand = DynamicsProcessing.EqBand(true, cutoffFreq, bandGains[i])
                preEq.setBand(i, eqBand)
            }
            builder.setPreEqAllChannelsTo(preEq)

            // Setup native limiter to prevent inter-sample clipping and distortion
            val limiter = DynamicsProcessing.Limiter(
                true,                 // inUse
                limiterEnabled,       // enabled
                0,                    // linkGroup
                1.0f,                 // attackTime ms
                50.0f,                // releaseTime ms
                10.0f,                // ratio
                limiterThresholdDb,   // threshold dB
                0.0f                  // postGain dB
            )
            builder.setLimiterAllChannelsTo(limiter)

            // 2. Instantiate effect on targeted session ID (0 for global, or specific app session)
            val dpConfig = builder.build()
            val dp = DynamicsProcessing(0, sessionId, dpConfig)

            // MANDATORY SEQUENTIAL PER-CHANNEL FIX:
            // Apply across both stereo channels (0 and 1) sequentially
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

            Log.i(TAG, "Successfully attached 32-band DynamicsProcessing effect to session $sessionId")
            updateNotification()

        } catch (t: Throwable) {
            Log.e(TAG, "Failed to initialize DynamicsProcessing on session $sessionId: ${t.message}", t)
        }
    }

    /**
     * Periodically monitors AudioFlinger dumpsys output in a background coroutine
     * to discover newly created sessions, including hidden streams from YouTube.
     */
    private fun startAudioFlingerMonitoring() {
        serviceScope.launch {
            // Regex pattern to capture session numbers: Session <digits>
            val sessionRegex = Regex("Session\\s+(\\d+)")

            while (isActive) {
                try {
                    parseAudioFlingerDumpsys(sessionRegex)
                } catch (e: Exception) {
                    Log.w(TAG, "Dumpsys parsing failed or permission not granted: ${e.message}")
                }
                delay(2500)
            }
        }
    }

    /**
     * Executes 'dumpsys media.audio_flinger' and parses audio tracks.
     * Uses match.groupValues[1].toInt() to grab session ID safely without sequence mismatches.
     */
    private fun parseAudioFlingerDumpsys(sessionRegex: Regex) {
        val detectedSessions = mutableMapOf<Int, String>()

        try {
            val process = Runtime.getRuntime().exec(arrayOf("dumpsys", "media.audio_flinger"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            var lastSeenPackage = "Audio Track"

            reader.forEachLine { line ->
                val trimmed = line.trim()

                // Detect app package name if present in dumpsys block
                if (trimmed.contains("com.google.android.youtube", ignoreCase = true)) {
                    lastSeenPackage = "YouTube (com.google.android.youtube)"
                } else if (trimmed.contains("com.spotify.music", ignoreCase = true)) {
                    lastSeenPackage = "Spotify (com.spotify.music)"
                } else if (trimmed.contains("com.apple.android.music", ignoreCase = true)) {
                    lastSeenPackage = "Apple Music"
                }

                // Match Session <number>
                val match = sessionRegex.find(line)
                if (match != null) {
                    // Grab specific capturing group index string via match.groupValues[1].toInt()
                    val sessionId = match.groupValues[1].toInt()
                    if (sessionId > 0) {
                        detectedSessions[sessionId] = lastSeenPackage
                    }
                }

                if (trimmed.isEmpty()) {
                    lastSeenPackage = "Audio Stream"
                }
            }

            process.waitFor()

            // Attach new sessions
            for ((sessionId, source) in detectedSessions) {
                if (!activeEffects.containsKey(sessionId)) {
                    applyEqualizerToSession(sessionId, source)
                }
            }

            // Clean up defunct sessions (except global mix session 0)
            val currentKeys = activeEffects.keys.toList()
            for (sessId in currentKeys) {
                if (sessId != 0 && !detectedSessions.containsKey(sessId)) {
                    detachSession(sessId)
                }
            }

        } catch (e: Exception) {
            // DUMP permission requires ADB grant: adb shell pm grant com.fatyliser.eq android.permission.DUMP
            // If not granted yet, fallback gracefully keeps Session 0 active.
        }
    }

    /**
     * Attaches a session manually or from native AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION
     */
    fun attachSession(sessionId: Int, source: String) {
        applyEqualizerToSession(sessionId, source)
    }

    /**
     * Detaches and releases an audio effect
     */
    fun detachSession(sessionId: Int) {
        val effect = activeEffects.remove(sessionId)
        sessionSources.remove(sessionId)
        if (effect != null) {
            try {
                effect.enabled = false
                effect.release()
                Log.i(TAG, "Released DynamicsProcessing on session $sessionId")
                updateNotification()
            } catch (t: Throwable) {
                Log.e(TAG, "Error releasing session $sessionId", t)
            }
        }
    }

    /**
     * Public API: Updates gain for a specific band (0..31) in real time
     */
    fun updateBandGain(index: Int, gainDb: Float) {
        if (index !in 0 until BAND_COUNT) {
            Log.w(TAG, "Band index $index out of bounds (0..31)")
            return
        }

        bandGains[index] = gainDb

        // Update all active DynamicsProcessing sessions in real time across stereo channels
        activeEffects.values.forEach { dp ->
            try {
                for (channel in 0 until CHANNEL_COUNT) {
                    val band = dp.getPreEqBandByChannelIndex(channel, index)
                    band.gain = gainDb
                    band.enabled = true
                    dp.setPreEqBandByChannelIndex(channel, index, band)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error updating band $index on effect: ${e.message}")
            }
        }
    }

    /**
     * Public API: Returns a defensive copy of current 32-band gains
     */
    fun getBandGains(): FloatArray {
        return bandGains.clone()
    }

    /**
     * Public API: Returns the count of actively processed audio sessions
     */
    fun getActiveSessionCount(): Int {
        return activeEffects.size
    }

    /**
     * Public API: Returns detailed session info (id, name)
     */
    fun getActiveSessionDetails(): List<Pair<Int, String>> {
        return activeEffects.keys.map { id ->
            id to (sessionSources[id] ?: "Session $id")
        }
    }

    /**
     * Public API: Returns the calculated cutoff frequencies
     */
    fun getCutoffFrequencies(): FloatArray {
        return cutoffFrequencies.clone()
    }

    /**
     * Sets limiter state
     */
    fun setLimiter(enabled: Boolean, thresholdDb: Float) {
        limiterEnabled = enabled
        limiterThresholdDb = thresholdDb
        activeEffects.values.forEach { dp ->
            try {
                val limiter = dp.getLimiterByChannelIndex(0)
                limiter.enabled = enabled
                limiter.threshold = thresholdDb
                dp.setLimiterAllChannelsTo(limiter)
            } catch (e: Exception) {
                Log.e(TAG, "Error configuring limiter: ${e.message}")
            }
        }
    }

    /**
     * Toggles global EQ engine bypass
     */
    fun setEngineActive(active: Boolean) {
        isEngineActive = active
        activeEffects.values.forEach { dp ->
            try {
                dp.enabled = active
            } catch (e: Exception) {
                Log.e(TAG, "Error toggling engine state: ${e.message}")
            }
        }
        updateNotification()
    }

    fun isEngineActive(): Boolean = isEngineActive

    private fun releaseAllEffects() {
        activeEffects.forEach { (id, effect) ->
            try {
                effect.enabled = false
                effect.release()
            } catch (t: Throwable) {
                Log.w(TAG, "Error releasing effect $id: ${t.message}")
            }
        }
        activeEffects.clear()
        sessionSources.clear()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Fatyliser Audio Processing Engine",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows real-time status of 32-band DynamicsProcessing equalizer"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(statusText: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Fatyliser 32-Band Equalizer")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification() {
        val activeCount = activeEffects.size
        val status = if (isEngineActive) {
            "Processing $activeCount active audio ${if (activeCount == 1) "stream" else "streams"} (Pre-EQ + Limiter)"
        } else {
            "Equalizer Bypassed (Engine Standby)"
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildForegroundNotification(status))
    }

    companion object {
        const val TAG = "FatyliserAudioEngine"
        const val BAND_COUNT = 32
        const val CHANNEL_COUNT = 2 // Stereo L + R
        const val NOTIFICATION_ID = 4040
        const val CHANNEL_ID = "fatyliser_audio_engine_channel"
    }
}
