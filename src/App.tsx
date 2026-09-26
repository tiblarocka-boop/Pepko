/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderTrackingPanel } from './components/HeaderTrackingPanel';
import { EqualizerCurve } from './components/EqualizerCurve';
import { EqualizerRack } from './components/EqualizerRack';
import { PresetSelector } from './components/PresetSelector';
import { SoundTestBar } from './components/SoundTestBar';
import { AdbPermissionModal } from './components/AdbPermissionModal';
import { NativeInspectorModal } from './components/NativeInspectorModal';
import { createDefaultBands, webAudioEngine } from './audio/WebAudioEngine';
import { FatyliserBridge } from './bridge/FatyliserBridge';
import type { EqBand, AudioSession, Preset } from './types/equalizer';

export default function App() {
  const [bands, setBands] = useState<EqBand[]>(createDefaultBands);
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [activeSessionCount, setActiveSessionCount] = useState(0);
  const [engineActive, setEngineActive] = useState(true);
  const [preGain, setPreGain] = useState(0.0);
  const [limiterEnabled, setLimiterEnabled] = useState(true);
  const [limiterThreshold, setLimiterThreshold] = useState(-0.5);
  const [activePresetId, setActivePresetId] = useState<string | null>('flat');

  // Modals
  const [isAdbModalOpen, setIsAdbModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  // Native status
  const isNative = FatyliserBridge.isNativeEnvironment();

  // Periodic polling for active sessions (including hidden YouTube tracks detected via dumpsys)
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const details = await FatyliserBridge.getSessionDetails();
        setSessions(details.sessions);
        setActiveSessionCount(details.count);
        setEngineActive(details.engineActive);
      } catch (err) {
        console.error('Session polling error:', err);
      }
    };

    fetchSessionData();
    const interval = setInterval(fetchSessionData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update a single band gain with ultra-low latency
  const handleBandGainChange = useCallback((index: number, gain: number) => {
    setBands((prevBands) => {
      const next = [...prevBands];
      next[index] = { ...next[index], gain };
      return next;
    });

    setActivePresetId(null);

    // 1. Immediately invoke native Capacitor Plugin Bridge
    FatyliserBridge.updateBandGain(index, gain);

    // 2. Synchronize Web Audio DSP simulation node
    webAudioEngine.setBandGain(index, gain);
  }, []);

  // Update all 32 bands at once (e.g. preset selection or reset)
  const handleApplyAllGains = useCallback((newGains: number[], presetId: string | null = null) => {
    setBands((prevBands) =>
      prevBands.map((band, i) => ({
        ...band,
        gain: newGains[i] ?? 0,
      }))
    );

    setActivePresetId(presetId);

    // 1. Native Capacitor bridge call
    FatyliserBridge.updateAllGains(newGains);

    // 2. Web Audio DSP engine update
    webAudioEngine.setAllBandGains(newGains);
  }, []);

  // Select Preset
  const handleSelectPreset = (preset: Preset) => {
    handleApplyAllGains(preset.gains, preset.id);
  };

  // Quick Action: Reset Flat
  const handleResetFlat = () => {
    handleApplyAllGains(new Array(32).fill(0), 'flat');
  };

  // Quick Action: Invert gains
  const handleInvertGains = () => {
    const inverted = bands.map((b) => Math.round(-b.gain * 10) / 10);
    handleApplyAllGains(inverted, null);
  };

  // Quick Action: Adjust all by delta
  const handleAdjustAll = (delta: number) => {
    const adjusted = bands.map((b) =>
      Math.max(-15, Math.min(15, Math.round((b.gain + delta) * 10) / 10))
    );
    handleApplyAllGains(adjusted, null);
  };

  // Toggle Engine Bypass
  const handleToggleEngine = async () => {
    const nextState = !engineActive;
    setEngineActive(nextState);
    await FatyliserBridge.setEngineActive(nextState);
    if (!nextState) {
      webAudioEngine.setAllBandGains(new Array(32).fill(0));
    } else {
      webAudioEngine.setAllBandGains(bands.map((b) => b.gain));
    }
  };

  // Master Pre-Gain
  const handlePreGainChange = (gain: number) => {
    setPreGain(gain);
    webAudioEngine.setPreGain(gain);
  };

  // Limiter Change
  const handleLimiterChange = async (enabled: boolean, threshold: number) => {
    setLimiterEnabled(enabled);
    setLimiterThreshold(threshold);
    await FatyliserBridge.setLimiter(enabled, threshold);
    webAudioEngine.setLimiterState(enabled, threshold);
  };

  // Simulator helper: Toggle simulated YouTube stream
  const handleSimulateYouTubeToggle = () => {
    FatyliserBridge.toggleSimulatedYouTube();
    FatyliserBridge.getSessionDetails().then((details) => {
      setSessions([...details.sessions]);
      setActiveSessionCount(details.count);
    });
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans selection:bg-cyan-950 selection:text-cyan-200">
      {/* 1. Header Tracking Panel */}
      <HeaderTrackingPanel
        sessions={sessions}
        activeCount={activeSessionCount}
        engineActive={engineActive}
        limiterActive={limiterEnabled}
        isNative={isNative}
        onToggleEngine={handleToggleEngine}
        onOpenAdbModal={() => setIsAdbModalOpen(true)}
        onOpenCodeModal={() => setIsCodeModalOpen(true)}
        onSimulateYouTubeToggle={handleSimulateYouTubeToggle}
        testAudioActive={webAudioEngine.getIsPlaying()}
      />

      {/* Main Studio View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* Real-time Visualizer & Curve Display */}
        <EqualizerCurve
          bands={bands}
          onBandGainChange={handleBandGainChange}
          engineActive={engineActive}
        />

        {/* 32 Vertically-Aligned Fader Controls & Master Limiter Console */}
        <EqualizerRack
          bands={bands}
          onBandGainChange={handleBandGainChange}
          onResetFlat={handleResetFlat}
          onInvertGains={handleInvertGains}
          onAdjustAll={handleAdjustAll}
          engineActive={engineActive}
          preGain={preGain}
          onPreGainChange={handlePreGainChange}
          limiterEnabled={limiterEnabled}
          limiterThreshold={limiterThreshold}
          onLimiterChange={handleLimiterChange}
        />

        {/* Real-Time Acoustic Sound Test Lab */}
        <SoundTestBar engineActive={engineActive} />

        {/* Audiophile Presets & Target Curves */}
        <PresetSelector
          currentGains={bands.map((b) => b.gain)}
          onSelectPreset={handleSelectPreset}
          activePresetId={activePresetId}
        />
      </main>

      {/* Footer Info */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 px-4 py-3 text-center text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>Fatyliser 32-Band Engine • com.fatyliser.eq</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-600">
          <span>DynamicsProcessing Pre-EQ</span>
          <span>•</span>
          <span>Dumpsys AudioFlinger Poller</span>
          <span>•</span>
          <span>Capacitor Native Bridge</span>
        </div>
      </footer>

      {/* Modals */}
      <AdbPermissionModal
        isOpen={isAdbModalOpen}
        onClose={() => setIsAdbModalOpen(false)}
      />

      <NativeInspectorModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}
