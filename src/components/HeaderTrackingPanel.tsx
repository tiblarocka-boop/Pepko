import React from 'react';
import {
  Activity,
  Layers,
  Radio,
  Sliders,
  Terminal,
  Code2,
  Volume2,
  ShieldCheck,
  Youtube,
  Music,
  Power
} from 'lucide-react';
import type { AudioSession } from '../types/equalizer';

interface HeaderTrackingPanelProps {
  sessions: AudioSession[];
  activeCount: number;
  engineActive: boolean;
  limiterActive: boolean;
  isNative: boolean;
  onToggleEngine: () => void;
  onOpenAdbModal: () => void;
  onOpenCodeModal: () => void;
  onSimulateYouTubeToggle?: () => void;
  testAudioActive: boolean;
}

export const HeaderTrackingPanel: React.FC<HeaderTrackingPanelProps> = ({
  sessions,
  activeCount,
  engineActive,
  limiterActive,
  isNative,
  onToggleEngine,
  onOpenAdbModal,
  onOpenCodeModal,
  onSimulateYouTubeToggle,
  testAudioActive,
}) => {
  const hasYouTube = sessions.some((s) => s.isYouTube);

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-4 py-3 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* App Title & Service Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all shadow-lg ${
              engineActive
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/20'
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              <Sliders className="w-5 h-5" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                engineActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Fatyliser
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  32-Band Pre-EQ
                </span>
              </h1>
              <span className="text-xs text-zinc-500 font-mono">com.fatyliser.eq</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                DynamicsProcessing
              </span>
              <span>•</span>
              <span className="text-zinc-500">
                {isNative ? 'Native Foreground Service' : 'Capacitor Bridge (Web View)'}
              </span>
            </div>
          </div>
        </div>

        {/* Small Header Tracking Panel: Active Stream Connections */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Sessions Badge & Track Info */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs shadow-inner">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Radio className={`w-3.5 h-3.5 ${activeCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-zinc-600'}`} />
              <span className="text-zinc-400 font-medium">Active Streams:</span>
              <span className="font-mono font-bold text-white px-1.5 py-0.2 rounded bg-zinc-800">
                {activeCount}
              </span>
            </div>

            {/* Stream Tags */}
            <div className="flex items-center gap-1.5 ml-1">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                    sess.isYouTube
                      ? 'bg-red-950/60 border-red-800/60 text-red-300'
                      : sess.id === 0
                      ? 'bg-blue-950/50 border-blue-800/60 text-blue-300'
                      : 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300'
                  }`}
                  title={`${sess.name} (Session #${sess.id}, ${sess.sampleRate}Hz)`}
                >
                  {sess.isYouTube ? (
                    <Youtube className="w-3 h-3 text-red-400" />
                  ) : sess.id === 0 ? (
                    <Layers className="w-3 h-3 text-blue-400" />
                  ) : (
                    <Music className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>
                    {sess.isYouTube
                      ? 'YouTube Track'
                      : sess.id === 0
                      ? 'Global Mix'
                      : sess.name.replace(/com\..*?\./, '')}
                  </span>
                  <span className="text-[9px] opacity-60">#{sess.id}</span>
                </div>
              ))}
            </div>

            {/* In browser simulator: Quick toggle YouTube detection */}
            {!isNative && onSimulateYouTubeToggle && (
              <button
                onClick={onSimulateYouTubeToggle}
                className={`ml-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                  hasYouTube
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                    : 'bg-red-900/30 text-red-300 border-red-700/50 hover:bg-red-900/50'
                }`}
                title="Simulate media.audio_flinger dumpsys YouTube stream capture"
              >
                {hasYouTube ? 'Drop YouTube' : '+ Sim YouTube'}
              </button>
            )}
          </div>

          {/* Engine Action Controls */}
          <div className="flex items-center gap-1.5">
            {/* ADB Guidance Button */}
            <button
              onClick={onOpenAdbModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition cursor-pointer"
              title="View Wavelet DUMP permission instructions for ADB"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">ADB DUMP</span>
            </button>

            {/* Native Code Inspector Modal */}
            <button
              onClick={onOpenCodeModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition cursor-pointer"
              title="Inspect AndroidManifest.xml, MainActivity.kt and AudioEngineService.kt"
            >
              <Code2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Native Code</span>
            </button>

            {/* Global Engine Power Toggle */}
            <button
              onClick={onToggleEngine}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border shadow-sm ${
                engineActive
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/25'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${engineActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>{engineActive ? 'BYPASS' : 'ENGAGE'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
