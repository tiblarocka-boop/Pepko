import React, { useRef } from 'react';
import {
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Volume2,
  Shield,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import type { EqBand } from '../types/equalizer';
import { FaderTrack } from './FaderTrack';

interface EqualizerRackProps {
  bands: EqBand[];
  onBandGainChange: (index: number, gain: number) => void;
  onResetFlat: () => void;
  onInvertGains: () => void;
  onAdjustAll: (delta: number) => void;
  engineActive: boolean;
  preGain: number;
  onPreGainChange: (gain: number) => void;
  limiterEnabled: boolean;
  limiterThreshold: number;
  onLimiterChange: (enabled: boolean, threshold: number) => void;
}

export const EqualizerRack: React.FC<EqualizerRackProps> = ({
  bands,
  onBandGainChange,
  onResetFlat,
  onInvertGains,
  onAdjustAll,
  engineActive,
  preGain,
  onPreGainChange,
  limiterEnabled,
  limiterThreshold,
  onLimiterChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollHorizontally = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur flex flex-col gap-4">
      {/* Top Rack Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase text-zinc-400 tracking-wider">
            32-Band Parametric Console
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            (20 Hz → 20.2 kHz • 1.25x Exponential Steps)
          </span>
        </div>

        {/* Quick Adjustment Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdjustAll(1.0)}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-mono transition cursor-pointer"
            title="Boost all bands by +1.0 dB"
          >
            +1 dB
          </button>
          <button
            onClick={() => onAdjustAll(-1.0)}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-mono transition cursor-pointer"
            title="Reduce all bands by -1.0 dB"
          >
            -1 dB
          </button>
          <button
            onClick={onInvertGains}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-mono transition cursor-pointer"
            title="Invert curve (+ to -, - to +)"
          >
            <ArrowUpDown className="w-3 h-3 text-cyan-400" />
            <span>Invert</span>
          </button>
          <button
            onClick={onResetFlat}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-red-950/40 text-zinc-300 hover:text-red-300 border border-zinc-700/60 text-xs font-mono transition cursor-pointer"
            title="Reset all 32 bands to 0.0 dB (Flat)"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Flat</span>
          </button>

          {/* Scroll Navigation Arrows on Mobile / Narrow Screens */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => scrollHorizontally(-200)}
              className="p-1 rounded bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              title="Scroll left"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollHorizontally(200)}
              className="p-1 rounded bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              title="Scroll right"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Equalizer Rack & Master Modules */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Left: 32 Vertically-Aligned Faders Container */}
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
          >
            <div className="min-w-[900px] flex items-center justify-between gap-1 px-1">
              {bands.map((band) => (
                <FaderTrack
                  key={band.index}
                  band={band}
                  onChange={onBandGainChange}
                  engineActive={engineActive}
                />
              ))}
            </div>
          </div>

          {/* Acoustic Category Spectrum Footprint Bar */}
          <div className="min-w-[900px] grid grid-cols-7 gap-1 pt-2 border-t border-zinc-900 text-[10px] font-mono uppercase text-center tracking-wider">
            <span className="text-purple-400 bg-purple-950/20 py-0.5 rounded border border-purple-900/30">
              Sub-Bass (20-60Hz)
            </span>
            <span className="text-indigo-400 bg-indigo-950/20 py-0.5 rounded border border-indigo-900/30">
              Bass (60-250Hz)
            </span>
            <span className="text-blue-400 bg-blue-950/20 py-0.5 rounded border border-blue-900/30">
              Low-Mid (250-600Hz)
            </span>
            <span className="text-cyan-400 bg-cyan-950/20 py-0.5 rounded border border-cyan-900/30">
              Mid (600-2kHz)
            </span>
            <span className="text-teal-400 bg-teal-950/20 py-0.5 rounded border border-teal-900/30">
              High-Mid (2-4.5kHz)
            </span>
            <span className="text-amber-400 bg-amber-950/20 py-0.5 rounded border border-amber-900/30">
              Presence (4.5-9k)
            </span>
            <span className="text-rose-400 bg-rose-950/20 py-0.5 rounded border border-rose-900/30">
              Air (9k-20kHz)
            </span>
          </div>
        </div>

        {/* Right: Master Pre-Gain & Native Limiter Module */}
        <div className="w-full lg:w-48 bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-800 text-xs font-mono font-bold text-zinc-300">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>Master & Limiter</span>
          </div>

          {/* Pre-Gain Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-zinc-400">Pre-Gain</span>
              <span className="font-bold text-cyan-400">
                {preGain > 0 ? `+${preGain.toFixed(1)}` : preGain.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={preGain}
              onChange={(e) => onPreGainChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
            <div className="flex justify-between text-[9px] font-mono text-zinc-600">
              <span>-12 dB</span>
              <button
                onClick={() => onPreGainChange(0)}
                className="hover:text-zinc-300 cursor-pointer"
              >
                0.0 dB
              </button>
              <span>+12 dB</span>
            </div>
          </div>

          {/* Native DynamicsProcessing Limiter Module */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Native Limiter
              </span>
              <button
                onClick={() => onLimiterChange(!limiterEnabled, limiterThreshold)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold transition cursor-pointer border ${
                  limiterEnabled
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}
              >
                {limiterEnabled ? 'ARMED' : 'OFF'}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-zinc-500">Ceiling</span>
              <span className="font-mono text-zinc-300 font-bold">{limiterThreshold.toFixed(1)} dBFS</span>
            </div>
            <input
              type="range"
              min="-6.0"
              max="0.0"
              step="0.1"
              value={limiterThreshold}
              disabled={!limiterEnabled}
              onChange={(e) => onLimiterChange(limiterEnabled, parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg disabled:opacity-40"
            />

            <div className="text-[10px] text-zinc-500 font-mono leading-tight bg-zinc-950 p-2 rounded border border-zinc-800/60 mt-1">
              Protects against inter-sample peaks with zero clipping.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
