import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AudioSession, EngineStats } from '../types/equalizer';

export interface FatyliserBridgePlugin {
  getBandGains(): Promise<{ gains: number[] }>;
  updateBandGain(options: { index: number; value: number }): Promise<{ success: boolean; index: number; value: number }>;
  updateAllGains(options: { gains: number[] }): Promise<{ success: boolean }>;
  getActiveSessionCount(): Promise<{ count: number }>;
  getSessionDetails(): Promise<{ sessions: Array<{ id: number; name: string; isYouTube: boolean }>; count: number; isEngineActive: boolean }>;
  setLimiter(options: { enabled: boolean; threshold: number }): Promise<{ success: boolean }>;
  setEngineActive(options: { active: boolean }): Promise<{ active: boolean }>;
}

// Register the custom Capacitor Plugin
export const FatyliserNativePlugin = registerPlugin<FatyliserBridgePlugin>('FatyliserBridge');

// Fallback / In-Memory State for Web Browser Preview & Testing
class FatyliserBridgeController {
  private isNative = Capacitor.isNativePlatform();
  private mockGains: number[] = new Array(32).fill(0);
  private mockSessions: AudioSession[] = [
    {
      id: 0,
      name: 'System Audio Mix (Global Output)',
      isYouTube: false,
      active: true,
      sampleRate: 48000,
      channelCount: 2,
      detectedAt: Date.now() - 360000,
    },
    {
      id: 1042,
      name: 'YouTube (com.google.android.youtube)',
      isYouTube: true,
      active: true,
      sampleRate: 48000,
      channelCount: 2,
      detectedAt: Date.now() - 120000,
    },
    {
      id: 1088,
      name: 'Spotify Music (com.spotify.music)',
      isYouTube: false,
      active: true,
      sampleRate: 44100,
      channelCount: 2,
      detectedAt: Date.now() - 45000,
    }
  ];
  private isEngineActive = true;
  private limiterEnabled = true;
  private limiterThreshold = -0.5;

  public isNativeEnvironment(): boolean {
    return this.isNative;
  }

  /**
   * Ultra-low latency single band gain update
   */
  public async updateBandGain(index: number, value: number): Promise<void> {
    this.mockGains[index] = value;

    if (this.isNative) {
      try {
        await FatyliserNativePlugin.updateBandGain({ index, value });
      } catch (err) {
        console.warn('Native bridge error, falling back:', err);
      }
    }
  }

  /**
   * Batch update all 32 bands
   */
  public async updateAllGains(gains: number[]): Promise<void> {
    this.mockGains = [...gains];

    if (this.isNative) {
      try {
        await FatyliserNativePlugin.updateAllGains({ gains });
      } catch (err) {
        console.warn('Native bridge error:', err);
      }
    }
  }

  /**
   * Fetch current band gains from native service
   */
  public async getBandGains(): Promise<number[]> {
    if (this.isNative) {
      try {
        const res = await FatyliserNativePlugin.getBandGains();
        if (res && res.gains && res.gains.length === 32) {
          this.mockGains = res.gains;
          return res.gains;
        }
      } catch (err) {
        console.warn('Native getBandGains failed:', err);
      }
    }
    return [...this.mockGains];
  }

  /**
   * Fetch active audio sessions (including YouTube tracks parsed from dumpsys)
   */
  public async getSessionDetails(): Promise<{ sessions: AudioSession[]; count: number; engineActive: boolean }> {
    if (this.isNative) {
      try {
        const res = await FatyliserNativePlugin.getSessionDetails();
        const mappedSessions: AudioSession[] = (res.sessions || []).map((s) => ({
          id: s.id,
          name: s.name,
          isYouTube: s.isYouTube || s.name.toLowerCase().includes('youtube'),
          active: true,
          sampleRate: 48000,
          channelCount: 2,
          detectedAt: Date.now(),
        }));

        return {
          sessions: mappedSessions,
          count: res.count ?? mappedSessions.length,
          engineActive: res.isEngineActive ?? true,
        };
      } catch (err) {
        console.warn('Native getSessionDetails failed:', err);
      }
    }

    return {
      sessions: this.mockSessions,
      count: this.mockSessions.length,
      engineActive: this.isEngineActive,
    };
  }

  /**
   * Configure Native DynamicsProcessing Limiter
   */
  public async setLimiter(enabled: boolean, threshold: number): Promise<void> {
    this.limiterEnabled = enabled;
    this.limiterThreshold = threshold;

    if (this.isNative) {
      try {
        await FatyliserNativePlugin.setLimiter({ enabled, threshold });
      } catch (err) {
        console.warn('Native setLimiter failed:', err);
      }
    }
  }

  /**
   * Toggle Engine Bypass
   */
  public async setEngineActive(active: boolean): Promise<void> {
    this.isEngineActive = active;

    if (this.isNative) {
      try {
        await FatyliserNativePlugin.setEngineActive({ active });
      } catch (err) {
        console.warn('Native setEngineActive failed:', err);
      }
    }
  }

  /**
   * Simulator helper: Toggle simulated YouTube stream for browser testing
   */
  public toggleSimulatedYouTube(): boolean {
    const ytIndex = this.mockSessions.findIndex((s) => s.isYouTube);
    if (ytIndex >= 0) {
      this.mockSessions.splice(ytIndex, 1);
      return false;
    } else {
      this.mockSessions.push({
        id: Math.floor(1000 + Math.random() * 9000),
        name: 'YouTube (com.google.android.youtube)',
        isYouTube: true,
        active: true,
        sampleRate: 48000,
        channelCount: 2,
        detectedAt: Date.now(),
      });
      return true;
    }
  }

  /**
   * Simulator helper: Add another custom app session
   */
  public addSimulatedApp(name: string): void {
    this.mockSessions.push({
      id: Math.floor(1000 + Math.random() * 9000),
      name,
      isYouTube: name.toLowerCase().includes('youtube'),
      active: true,
      sampleRate: 48000,
      channelCount: 2,
      detectedAt: Date.now(),
    });
  }

  public removeSimulatedSession(id: number): void {
    this.mockSessions = this.mockSessions.filter((s) => s.id !== id);
  }
}

export const FatyliserBridge = new FatyliserBridgeController();
