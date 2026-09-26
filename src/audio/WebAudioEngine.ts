import type { EqBand } from '../types/equalizer';

export const BAND_COUNT = 32;

/**
 * Ascending exponential formula as specified:
 * band.cutoffFrequency = 20f * Math.pow(1.25, i.toDouble()).toFloat()
 */
export const BAND_FREQUENCIES: number[] = Array.from({ length: BAND_COUNT }, (_, i) => {
  return 20 * Math.pow(1.25, i);
});

export function getBandCategory(freq: number): EqBand['category'] {
  if (freq < 60) return 'sub';
  if (freq < 250) return 'bass';
  if (freq < 600) return 'lowmid';
  if (freq < 2000) return 'mid';
  if (freq < 4500) return 'highmid';
  if (freq < 9000) return 'presence';
  return 'air';
}

export function formatFrequencyLabel(freq: number): string {
  if (freq >= 10000) {
    return `${(freq / 1000).toFixed(1)}k`;
  }
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)}k`;
  }
  return `${Math.round(freq)}Hz`;
}

export function createDefaultBands(): EqBand[] {
  return BAND_FREQUENCIES.map((freq, index) => ({
    index,
    frequency: freq,
    label: formatFrequencyLabel(freq),
    gain: 0,
    category: getBandCategory(freq),
  }));
}

export type TestAudioType = 'pink_noise' | 'synth_beat' | 'frequency_sweep' | 'mic';

class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private filters: BiquadFilterNode[] = [];
  private masterGain: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private activeSourceNode: AudioNode | null = null;
  private isPlaying = false;
  private currentTestType: TestAudioType | null = null;
  private sweepOscillator: OscillatorNode | null = null;
  private beatInterval: number | null = null;
  private micStream: MediaStream | null = null;

  public init(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

      // Limiter (DynamicsCompressor with hard ratio, fast attack, peak cap)
      this.limiterNode = this.ctx.createDynamicsCompressor();
      this.limiterNode.threshold.setValueAtTime(-0.5, this.ctx.currentTime);
      this.limiterNode.knee.setValueAtTime(0, this.ctx.currentTime);
      this.limiterNode.ratio.setValueAtTime(20, this.ctx.currentTime);
      this.limiterNode.attack.setValueAtTime(0.001, this.ctx.currentTime);
      this.limiterNode.release.setValueAtTime(0.05, this.ctx.currentTime);

      // Analyser for real-time FFT visualization
      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.85;

      // Build 32 Biquad Filter Chain
      this.filters = [];
      let previousNode: AudioNode | null = null;

      for (let i = 0; i < BAND_COUNT; i++) {
        const filter = this.ctx.createBiquadFilter();
        const freq = BAND_FREQUENCIES[i];

        if (i === 0) {
          filter.type = 'lowshelf';
          filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
        } else if (i === BAND_COUNT - 1) {
          filter.type = 'highshelf';
          filter.frequency.setValueAtTime(Math.min(freq, 20000), this.ctx.currentTime);
        } else {
          filter.type = 'peaking';
          filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
          filter.Q.setValueAtTime(1.8, this.ctx.currentTime); // Precise 32-band Q factor
        }

        filter.gain.setValueAtTime(0, this.ctx.currentTime);

        if (previousNode) {
          previousNode.connect(filter);
        }
        previousNode = filter;
        this.filters.push(filter);
      }

      // Connect last filter -> Limiter -> MasterGain -> Analyser -> Destination
      if (previousNode && this.limiterNode && this.masterGain && this.analyserNode) {
        previousNode.connect(this.limiterNode);
        this.limiterNode.connect(this.masterGain);
        this.masterGain.connect(this.analyserNode);
        this.analyserNode.connect(this.ctx.destination);
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  public setBandGain(index: number, gainDb: number): void {
    if (this.filters[index] && this.ctx) {
      // Smooth parameter change
      this.filters[index].gain.setTargetAtTime(gainDb, this.ctx.currentTime, 0.02);
    }
  }

  public setAllBandGains(gains: number[]): void {
    if (!this.ctx) return;
    gains.forEach((gain, i) => {
      if (this.filters[i]) {
        this.filters[i].gain.setTargetAtTime(gain, this.ctx!.currentTime, 0.02);
      }
    });
  }

  public setPreGain(gainDb: number): void {
    if (this.masterGain && this.ctx) {
      const linear = Math.pow(10, gainDb / 20);
      this.masterGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.02);
    }
  }

  public setLimiterState(enabled: boolean, thresholdDb: number): void {
    if (this.limiterNode && this.ctx) {
      this.limiterNode.threshold.setTargetAtTime(
        enabled ? thresholdDb : 0,
        this.ctx.currentTime,
        0.02
      );
      this.limiterNode.ratio.setTargetAtTime(
        enabled ? 20 : 1,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public getFrequencyData(array: Uint8Array): void {
    if (this.analyserNode) {
      // Cast to any for compatibility across TS lib DOM Uint8Array ArrayBufferLike definitions
      (this.analyserNode as any).getByteFrequencyData(array);
    } else {
      array.fill(0);
    }
  }

  public getTimeDomainData(array: Uint8Array): void {
    if (this.analyserNode) {
      (this.analyserNode as any).getByteTimeDomainData(array);
    } else {
      array.fill(128);
    }
  }

  /**
   * Starts live built-in sound playback to test the 32-band equalizer
   */
  public async playTestSound(type: TestAudioType): Promise<void> {
    const ctx = this.init();
    this.stopTestSound();

    this.isPlaying = true;
    this.currentTestType = type;

    const firstFilter = this.filters[0];
    if (!firstFilter) return;

    if (type === 'pink_noise') {
      // Generate continuous high-quality pink noise (equal energy per octave across 20Hz-20kHz)
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      noiseSource.connect(firstFilter);
      noiseSource.start();
      this.activeSourceNode = noiseSource;

    } else if (type === 'synth_beat') {
      // Algorithmic punchy beat with sub-kick, snappy snare, hi-hats and warm synth chords
      let step = 0;
      const tempo = 115;
      const intervalMs = (60 / tempo / 4) * 1000;

      const playDrumHit = () => {
        if (!this.isPlaying || !this.ctx) return;
        const now = this.ctx.currentTime;

        // Kick on 1, 5, 9, 13 (4-on-the-floor style)
        if (step % 4 === 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
          gain.gain.setValueAtTime(0.7, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          gain.connect(firstFilter);
          osc.start(now);
          osc.stop(now + 0.25);
        }

        // Snare / Clap on beats 4 & 12
        if (step % 8 === 4) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(gain);
          gain.connect(firstFilter);
          osc.start(now);
          osc.stop(now + 0.18);
        }

        // Hi-Hat on offbeats
        if (step % 2 === 1) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'highpass' as unknown as OscillatorType;
          osc.frequency.setValueAtTime(9000, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(gain);
          gain.connect(firstFilter);
          osc.start(now);
          osc.stop(now + 0.05);
        }

        // Bassline synth note every 4 steps
        if (step % 4 === 2) {
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          bassOsc.type = 'sawtooth';
          const notes = [65.41, 73.42, 82.41, 98.00]; // C2, D2, E2, G2
          bassOsc.frequency.setValueAtTime(notes[(step / 4) % notes.length], now);
          bassGain.gain.setValueAtTime(0.35, now);
          bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
          bassOsc.connect(bassGain);
          bassGain.connect(firstFilter);
          bassOsc.start(now);
          bassOsc.stop(now + 0.22);
        }

        step = (step + 1) % 16;
      };

      playDrumHit();
      this.beatInterval = window.setInterval(playDrumHit, intervalMs);

    } else if (type === 'frequency_sweep') {
      // 20Hz -> 20kHz exponential sine sweep repeating every 6 seconds
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(20, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20000, ctx.currentTime + 6.0);

      osc.connect(gain);
      gain.connect(firstFilter);
      osc.start();

      this.sweepOscillator = osc;
      this.activeSourceNode = gain;

      osc.onended = () => {
        if (this.isPlaying && this.currentTestType === 'frequency_sweep') {
          this.playTestSound('frequency_sweep');
        }
      };
      osc.stop(ctx.currentTime + 6.0);

    } else if (type === 'mic') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = stream;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(firstFilter);
        this.activeSourceNode = source;
      } catch (e) {
        console.warn('Microphone access denied:', e);
        this.isPlaying = false;
        this.currentTestType = null;
      }
    }
  }

  public stopTestSound(): void {
    if (this.activeSourceNode) {
      try {
        (this.activeSourceNode as AudioBufferSourceNode).stop?.();
        this.activeSourceNode.disconnect();
      } catch {
        // noop
      }
      this.activeSourceNode = null;
    }

    if (this.sweepOscillator) {
      try {
        this.sweepOscillator.stop();
        this.sweepOscillator.disconnect();
      } catch {
        // noop
      }
      this.sweepOscillator = null;
    }

    if (this.beatInterval !== null) {
      clearInterval(this.beatInterval);
      this.beatInterval = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    this.isPlaying = false;
    this.currentTestType = null;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTestType(): TestAudioType | null {
    return this.currentTestType;
  }
}

export const webAudioEngine = new WebAudioEngine();
