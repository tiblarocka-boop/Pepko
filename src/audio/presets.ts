import type { Preset } from '../types/equalizer';
import { BAND_FREQUENCIES } from './WebAudioEngine';

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'flat',
    name: 'Flat Studio Reference',
    category: 'Reference',
    description: 'Pure neutral bypass across all 32 bands (0.0 dB unity gain).',
    gains: new Array(32).fill(0),
  },
  {
    id: 'harman_target',
    name: 'Harman Target (In-Ear 2019)',
    category: 'Audiophile',
    description: 'Gold-standard audiophile target curve with tactile sub-bass shelf and ear canal pinna gain.',
    gains: [
      6.2, 5.8, 5.3, 4.6, 3.8, 2.9, 1.8, 0.8, 0.2, -0.2,
      -0.4, -0.2, 0.0, 0.3, 0.8, 1.5, 2.4, 3.5, 4.8, 6.2,
      7.0, 6.5, 4.8, 2.8, 1.2, 0.5, 0.0, -0.4, -0.8, -1.2,
      -1.8, -2.5
    ],
  },
  {
    id: 'wavelet_iem',
    name: 'Wavelet AutoEq V-Shape',
    category: 'Modern',
    description: 'Classic punchy V-shaped curve optimized for consumer IEMs and dynamic drivers.',
    gains: [
      5.5, 5.2, 4.8, 4.2, 3.5, 2.6, 1.8, 0.8, 0.0, -0.8,
      -1.4, -1.8, -2.0, -1.8, -1.4, -0.8, 0.0, 0.8, 1.6, 2.5,
      3.4, 4.2, 4.8, 4.5, 3.8, 3.0, 2.2, 1.5, 1.0, 0.5,
      0.0, -0.5
    ],
  },
  {
    id: 'basshead_sub',
    name: 'Deep Sub-Bass Rumble',
    category: 'Bass',
    description: 'Surgical sub-bass boost (<80Hz) without muddying mid-range vocals.',
    gains: [
      9.0, 8.5, 7.8, 6.8, 5.5, 4.0, 2.2, 0.8, 0.0, -0.4,
      -0.5, -0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0
    ],
  },
  {
    id: 'vocal_clarity',
    name: 'Vocal Clarity & Speech',
    category: 'Clarity',
    description: 'Sub-bass roll-off with speech intelligibility boost between 1kHz and 4kHz.',
    gains: [
      -4.5, -4.0, -3.2, -2.2, -1.5, -0.8, 0.0, 0.2, 0.5, 0.8,
      1.0, 1.2, 1.5, 1.8, 2.4, 3.2, 4.2, 5.0, 5.5, 5.2,
      4.5, 3.5, 2.5, 1.5, 0.8, 0.2, 0.0, -0.5, -1.0, -1.5,
      -2.0, -2.5
    ],
  },
  {
    id: 'electronic_edm',
    name: 'Electronic & Synth Club',
    category: 'Electronic',
    description: 'Tight transient attack with boosted 40Hz sub-kick and sparkling 10kHz+ air.',
    gains: [
      7.0, 6.8, 6.2, 5.0, 3.5, 1.8, 0.4, -0.5, -1.0, -1.2,
      -1.0, -0.5, 0.0, 0.5, 0.8, 1.2, 1.5, 1.8, 2.2, 2.8,
      3.2, 3.6, 4.0, 4.5, 5.0, 5.5, 6.0, 6.2, 5.8, 5.0,
      4.2, 3.5
    ],
  },
  {
    id: 'acoustic_warm',
    name: 'Acoustic & Classical Chamber',
    category: 'Acoustic',
    description: 'Warm organic body with gentle air preservation and natural instrument timbre.',
    gains: [
      1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 2.0, 1.8, 1.5, 1.0,
      0.8, 0.5, 0.2, 0.0, 0.0, 0.2, 0.4, 0.8, 1.2, 1.5,
      1.8, 2.0, 1.8, 1.5, 1.2, 1.0, 1.2, 1.5, 1.8, 2.0,
      1.8, 1.5
    ],
  },
  {
    id: 'treble_air',
    name: 'Air & Micro-Detail',
    category: 'Highs',
    description: 'High-frequency resolution enhancer highlighting cymbals, reverbs, and room acoustics.',
    gains: [
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.5, 0.8, 1.2, 1.8,
      2.5, 3.2, 4.0, 4.8, 5.8, 6.8, 7.5, 8.0, 8.2, 7.8,
      7.0, 6.0
    ],
  }
];
