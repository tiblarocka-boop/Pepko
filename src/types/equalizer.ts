export interface EqBand {
  index: number;
  frequency: number;
  label: string;
  gain: number; // in dB (-15.0 to +15.0)
  category: 'sub' | 'bass' | 'lowmid' | 'mid' | 'highmid' | 'presence' | 'air';
}

export interface AudioSession {
  id: number;
  name: string;
  isYouTube: boolean;
  active: boolean;
  sampleRate: number;
  channelCount: number;
  detectedAt: number;
}

export interface LimiterConfig {
  enabled: boolean;
  thresholdDb: number; // e.g. -0.5 dB
  attackMs: number;
  releaseMs: number;
  ratio: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: string;
  gains: number[];
}

export interface EngineStats {
  activeSessionCount: number;
  engineActive: boolean;
  limiterActive: boolean;
  limiterThreshold: number;
  preGainDb: number;
  isNativeCapacitor: boolean;
  latencyMs: number;
  bufferFrames: number;
}
