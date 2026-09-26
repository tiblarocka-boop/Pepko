import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Volume2,
  Radio,
  Activity,
  Mic,
  Music
} from 'lucide-react';
import { webAudioEngine, type TestAudioType } from '../audio/WebAudioEngine';

interface SoundTestBarProps {
  engineActive: boolean;
}

export const SoundTestBar: React.FC<SoundTestBarProps> = ({ engineActive }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentType, setCurrentType] = useState<TestAudioType | null>(null);

  useEffect(() => {
    return () => {
      webAudioEngine.stopTestSound();
    };
  }, []);

  const handleToggleSound = (type: TestAudioType) => {
    if (isPlaying && currentType === type) {
      webAudioEngine.stopTestSound();
      setIsPlaying(false);
      setCurrentType(null);
    } else {
      webAudioEngine.playTestSound(type);
      setIsPlaying(true);
      setCurrentType(type);
    }
  };

  const stopAll = () => {
    webAudioEngine.stopTestSound();
    setIsPlaying(false);
    setCurrentType(null);
  };

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3 shadow-xl backdrop-blur flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400">
          <Music className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5">
            Real-Time Acoustic Test Lab
            {isPlaying && (
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[10px] animate-pulse">
                ● Live 32-Band Routing
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">
            Hear your 32-band curve shape live audio right in the browser or mobile view
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Synth Beat */}
        <button
          onClick={() => handleToggleSound('synth_beat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
            isPlaying && currentType === 'synth_beat'
              ? 'bg-cyan-500 text-zinc-950 border-cyan-400 shadow-lg shadow-cyan-500/30'
              : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
          }`}
        >
          {isPlaying && currentType === 'synth_beat' ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          <span>Synth Beat & Sub</span>
        </button>

        {/* Pink Noise */}
        <button
          onClick={() => handleToggleSound('pink_noise')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
            isPlaying && currentType === 'pink_noise'
              ? 'bg-cyan-500 text-zinc-950 border-cyan-400 shadow-lg shadow-cyan-500/30'
              : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
          }`}
        >
          {isPlaying && currentType === 'pink_noise' ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          <span>Pink Noise (20Hz-20kHz)</span>
        </button>

        {/* 20-20k Sweep */}
        <button
          onClick={() => handleToggleSound('frequency_sweep')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
            isPlaying && currentType === 'frequency_sweep'
              ? 'bg-cyan-500 text-zinc-950 border-cyan-400 shadow-lg shadow-cyan-500/30'
              : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
          }`}
        >
          {isPlaying && currentType === 'frequency_sweep' ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          <span>Frequency Sweep</span>
        </button>

        {/* Live Mic */}
        <button
          onClick={() => handleToggleSound('mic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
            isPlaying && currentType === 'mic'
              ? 'bg-cyan-500 text-zinc-950 border-cyan-400 shadow-lg shadow-cyan-500/30'
              : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
          }`}
        >
          <Mic className="w-3 h-3" />
          <span>Live Mic Pass-Through</span>
        </button>

        {/* Stop Button */}
        {isPlaying && (
          <button
            onClick={stopAll}
            className="p-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 cursor-pointer"
            title="Stop audio test"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        )}
      </div>
    </div>
  );
};
