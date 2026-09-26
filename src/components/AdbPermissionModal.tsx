import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

interface AdbPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdbPermissionModal: React.FC<AdbPermissionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const adbCommand = `adb shell pm grant com.fatyliser.eq android.permission.DUMP`;

  const handleCopy = () => {
    navigator.clipboard.writeText(adbCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-zinc-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                ADB DUMP Permission Setup (Wavelet Architecture)
              </h3>
              <p className="text-xs text-zinc-400">
                Grant elevated inspection rights to detect hidden YouTube streams
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation */}
        <div className="text-xs space-y-2.5 text-zinc-300 leading-relaxed">
          <p>
            Like the renowned <strong className="text-cyan-400">Wavelet</strong> audio engine, Fatyliser uses Android's
            native <code className="bg-zinc-900 px-1 py-0.5 rounded text-amber-300 font-mono">DynamicsProcessing</code> API.
            Standard Android apps like YouTube often route audio in isolated private sessions that do not broadcast the standard
            <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-400 font-mono">AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION</code> broadcast.
          </p>
          <p>
            To detect and equalize these hidden sessions, Fatyliser’s <code className="bg-zinc-900 px-1 py-0.5 rounded text-cyan-300 font-mono">AudioEngineService</code> parses
            <code className="bg-zinc-900 px-1 py-0.5 rounded text-cyan-300 font-mono">dumpsys media.audio_flinger</code> in a background coroutine.
            On non-rooted Android devices, this requires one-time authorization via ADB.
          </p>
        </div>

        {/* Terminal Box */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>Terminal / Command Prompt</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-sans cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Command'}</span>
            </button>
          </div>
          <div className="text-xs text-emerald-400 bg-black/50 p-2.5 rounded border border-zinc-800/80 select-all overflow-x-auto">
            {adbCommand}
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-3 text-xs space-y-2">
          <div className="font-bold text-zinc-200">How to run in 3 quick steps:</div>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400">
            <li>Enable <strong className="text-zinc-200">Developer Options</strong> and <strong className="text-zinc-200">USB Debugging</strong> on your Android phone.</li>
            <li>Connect your device to your PC or Mac via USB and run <code className="bg-zinc-900 px-1 rounded text-zinc-300">adb devices</code>.</li>
            <li>Paste and execute the command above. Fatyliser will immediately latch onto YouTube and active media playback tracks!</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
