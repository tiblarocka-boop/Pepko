package com.fatyliser.eq

import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

/**
 * Capacitor Plugin Bridge to AudioEngineService.
 * Enables zero-overhead, ultra-low latency updates from the web UI to DynamicsProcessing bands.
 */
@CapacitorPlugin(name = "FatyliserBridge")
class AudioEnginePlugin : Plugin() {

    private val mainActivity: MainActivity?
        get() = activity as? MainActivity

    @PluginMethod
    fun getBandGains(call: PluginCall) {
        val service = mainActivity?.audioService
        if (service != null) {
            val gains = service.getBandGains()
            val jsArray = JSArray()
            for (g in gains) {
                jsArray.put(g.toDouble())
            }
            val ret = JSObject()
            ret.put("gains", jsArray)
            call.resolve(ret)
        } else {
            // Service not yet connected or fallback
            val defaultGains = JSArray()
            for (i in 0 until 32) defaultGains.put(0.0)
            val ret = JSObject()
            ret.put("gains", defaultGains)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun updateBandGain(call: PluginCall) {
        val index = call.getInt("index")
        val value = call.getDouble("value")?.toFloat() ?: call.getDouble("gainDb")?.toFloat()

        if (index == null || value == null) {
            call.reject("Index and value are required")
            return
        }

        val service = mainActivity?.audioService
        if (service != null) {
            service.updateBandGain(index, value)
            val ret = JSObject()
            ret.put("success", true)
            ret.put("index", index)
            ret.put("value", value)
            call.resolve(ret)
        } else {
            call.reject("AudioEngineService is not bound")
        }
    }

    @PluginMethod
    fun updateAllGains(call: PluginCall) {
        val gainsArray = call.getArray("gains")
        val service = mainActivity?.audioService
        if (gainsArray != null && service != null) {
            for (i in 0 until gainsArray.length()) {
                val gain = gainsArray.getDouble(i).toFloat()
                service.updateBandGain(i, gain)
            }
            val ret = JSObject()
            ret.put("success", true)
            call.resolve(ret)
        } else {
            call.reject("Failed to update all gains")
        }
    }

    @PluginMethod
    fun getActiveSessionCount(call: PluginCall) {
        val service = mainActivity?.audioService
        val count = service?.getActiveSessionCount() ?: 0
        val ret = JSObject()
        ret.put("count", count)
        call.resolve(ret)
    }

    @PluginMethod
    fun getSessionDetails(call: PluginCall) {
        val service = mainActivity?.audioService
        val ret = JSObject()
        val sessionsArray = JSArray()

        if (service != null) {
            val sessions = service.getActiveSessionDetails()
            for ((id, name) in sessions) {
                val sessObj = JSObject()
                sessObj.put("id", id)
                sessObj.put("name", name)
                sessObj.put("isYouTube", name.contains("youtube", ignoreCase = true))
                sessionsArray.put(sessObj)
            }
            ret.put("sessions", sessionsArray)
            ret.put("count", sessions.size)
            ret.put("isEngineActive", service.isEngineActive())
        } else {
            ret.put("sessions", sessionsArray)
            ret.put("count", 0)
            ret.put("isEngineActive", false)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun setLimiter(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) ?: true
        val threshold = call.getDouble("threshold", -0.5)?.toFloat() ?: -0.5f

        val service = mainActivity?.audioService
        service?.setLimiter(enabled, threshold)
        val ret = JSObject()
        ret.put("success", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun setEngineActive(call: PluginCall) {
        val active = call.getBoolean("active", true) ?: true
        val service = mainActivity?.audioService
        service?.setEngineActive(active)
        val ret = JSObject()
        ret.put("active", active)
        call.resolve(ret)
    }
}
