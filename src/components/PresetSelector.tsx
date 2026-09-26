import React, { useState } from 'react';
import {
  Bookmark,
  Sparkles,
  Download,
  Upload,
  Check,
  Plus
} from 'lucide-react';
import type { Preset } from '../types/equalizer';
import { DEFAULT_PRESETS } from '../audio/presets';

interface PresetSelectorProps {
  currentGains: number[];
  onSelectPreset: (preset: Preset) => void;
  activePresetId: string | null;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  currentGains,
  onSelectPreset,
  activePresetId,
}) => {
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [customName, setCustomName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newPreset: Preset = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      category: 'User Custom',
      description: 'User crafted 32-band parametric equalization profile',
      gains: [...currentGains],
    };

    setPresets((prev) => [newPreset, ...prev]);
    onSelectPreset(newPreset);
    setCustomName('');
    setShowSaveInput(false);
  };

  const exportPresetJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(presets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fatyliser_eq_presets.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importPresetJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setPresets(parsed);
        }
      } catch (err) {
        alert('Invalid preset JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold uppercase text-zinc-300 tracking-wider">
            Audiophile Target Curves & Presets
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {!showSaveInput ? (
            <button
              onClick={() => setShowSaveInput(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-mono transition cursor-pointer"
            >
              <Plus className="w-3 h-3 text-emerald-400" />
              <span>Save Current</span>
            </button>
          ) : (
            <form onSubmit={handleSaveCustom} className="flex items-center gap-1.5">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Preset Name..."
                autoFocus
                className="px-2 py-0.5 rounded bg-zinc-900 border border-cyan-500/60 text-xs text-white placeholder-zinc-500 outline-none w-36 font-mono"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowSaveInput(false)}
                className="px-1.5 py-0.5 text-zinc-500 hover:text-zinc-300 text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </form>
          )}

          <button
            onClick={exportPresetJson}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition"
            title="Export presets as JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <label
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition cursor-pointer"
            title="Import presets from JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept=".json"
              onChange={importPresetJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {presets.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200 shadow-md shadow-cyan-950/50'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase font-mono font-bold tracking-wider px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                    {preset.category}
                  </span>
                  {isActive && <Check className="w-3 h-3 text-cyan-400" />}
                </div>
                <div className="text-xs font-bold text-zinc-200 line-clamp-1">
                  {preset.name}
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1 leading-snug">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
