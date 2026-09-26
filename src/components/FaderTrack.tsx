import React, { useRef, useState } from 'react';
import type { EqBand } from '../types/equalizer';

interface FaderTrackProps {
  band: EqBand;
  onChange: (index: number, gain: number) => void;
  engineActive: boolean;
}

export const FaderTrack: React.FC<FaderTrackProps> = ({
  band,
  onChange,
  engineActive,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map gain (-15 to +15 dB) to percentage (0% to 100%, where 100% is top / +15dB)
  const percent = ((band.gain + 15) / 30) * 100;
  const isBoost = band.gain > 0;
  const isCut = band.gain < 0;
  const isZero = band.gain === 0;

  const calculateGainFromPointer = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    const relativeY = clientY - rect.top;
    // Invert because top is +15dB and bottom is -15dB
    const normalized = Math.max(0, Math.min(1, 1 - relativeY / trackHeight));
    const rawGain = -15 + normalized * 30;
    // Snap to 0.0 if within 0.3 dB of zero for haptic-like detent feel
    let snappedGain = Math.round(rawGain * 10) / 10;
    if (Math.abs(snappedGain) < 0.25) {
      snappedGain = 0;
    }
    onChange(band.index, snappedGain);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    calculateGainFromPointer(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      calculateGainFromPointer(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  const handleDoubleClick = () => {
    onChange(band.index, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(band.index, Math.min(15, Math.round((band.gain + 0.5) * 10) / 10));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(band.index, Math.max(-15, Math.round((band.gain - 0.5) * 10) / 10));
    } else if (e.key === 'Home' || e.key === '0') {
      e.preventDefault();
      onChange(band.index, 0);
    }
  };

  // Color theme by frequency acoustic category
  const categoryColorClass = {
    sub: 'text-purple-400 group-hover:text-purple-300',
    bass: 'text-indigo-400 group-hover:text-indigo-300',
    lowmid: 'text-blue-400 group-hover:text-blue-300',
    mid: 'text-cyan-400 group-hover:text-cyan-300',
    highmid: 'text-teal-400 group-hover:text-teal-300',
    presence: 'text-amber-400 group-hover:text-amber-300',
    air: 'text-rose-400 group-hover:text-rose-300',
  }[band.category];

  return (
    <div
      className={`group flex flex-col items-center select-none flex-1 min-w-[26px] max-w-[42px] py-1 transition-opacity ${
        engineActive ? 'opacity-100' : 'opacity-60'
      }`}
      onDoubleClick={handleDoubleClick}
      title={`Band #${band.index + 1}: ${band.label} (${Math.round(band.frequency)}Hz)\nGain: ${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)} dB\nDouble click to reset to 0dB`}
    >
      {/* Decibel Display Top Badge */}
      <div className="h-6 flex items-center justify-center">
        <span
          className={`font-mono text-[10px] tracking-tight transition-colors ${
            isBoost
              ? 'text-cyan-400 font-bold'
              : isCut
              ? 'text-amber-400 font-bold'
              : 'text-zinc-600'
          }`}
        >
          {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain === 0 ? '0' : band.gain.toFixed(1)}
        </span>
      </div>

      {/* Vertical Slider Track Container */}
      <div
        ref={trackRef}
        tabIndex={0}
        role="slider"
        aria-valuenow={band.gain}
        aria-valuemin={-15}
        aria-valuemax={15}
        aria-label={`Band ${band.label} gain`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-7 h-52 sm:h-64 flex justify-center items-center cursor-pointer touch-none outline-none focus:ring-1 focus:ring-cyan-500/50 rounded-lg py-2"
      >
        {/* Background Track Groove */}
        <div className="absolute w-2 h-full bg-zinc-900 rounded-full border border-zinc-800 shadow-inner overflow-hidden flex flex-col justify-end">
          {/* Subtle tick marks inside groove */}
          <div className="absolute top-1/2 w-full h-[1px] bg-zinc-700 -translate-y-1/2 z-10 opacity-70" />

          {/* Active Fill from Center (0 dB) up or down */}
          {isBoost && (
            <div
              className="absolute left-0 right-0 bg-gradient-to-t from-cyan-600 to-cyan-400 z-0 transition-[height]"
              style={{
                bottom: '50%',
                height: `${(percent - 50)}%`,
              }}
            />
          )}
          {isCut && (
            <div
              className="absolute left-0 right-0 bg-gradient-to-b from-amber-600 to-amber-400 z-0 transition-[height]"
              style={{
                top: '50%',
                height: `${(50 - percent)}%`,
              }}
            />
          )}
        </div>

        {/* Center Zero-Detent Marker Tick on Sides */}
        <div className="absolute top-1/2 left-0 w-1 h-[2px] bg-zinc-600 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-1 h-[2px] bg-zinc-600 -translate-y-1/2 pointer-events-none" />

        {/* Physical Stylized Hardware Fader Knob */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-6 sm:w-6.5 h-8 rounded bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600 shadow-md flex flex-col items-center justify-center transition-all ${
            isDragging
              ? 'scale-110 shadow-cyan-500/30 border-cyan-400'
              : 'group-hover:border-zinc-400'
          }`}
          style={{
            bottom: `calc(${percent}% - 16px)`,
          }}
        >
          {/* Knurled Grip Lines */}
          <div className="w-4 h-[1px] bg-zinc-500 mb-0.5 opacity-60" />
          {/* Center Indicator Light */}
          <div
            className={`w-3.5 h-[2px] rounded-full transition-colors ${
              isBoost
                ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
                : isCut
                ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                : 'bg-zinc-400'
            }`}
          />
          <div className="w-4 h-[1px] bg-zinc-500 mt-0.5 opacity-60" />
        </div>
      </div>

      {/* Frequency Label Bottom Pill */}
      <div className="mt-1 flex flex-col items-center">
        <span
          className={`text-[10px] font-mono tracking-tighter leading-tight font-medium transition-colors ${categoryColorClass}`}
        >
          {band.label}
        </span>
        <span className="text-[8px] font-mono text-zinc-600 leading-none mt-0.5">
          #{band.index + 1}
        </span>
      </div>
    </div>
  );
};
