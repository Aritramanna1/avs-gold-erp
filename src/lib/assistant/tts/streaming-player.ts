/**
 * Streaming PCM / WAV playback with pause, resume, stop, and rate control.
 * Used by Qwen3-TTS chunk emitters and unit tests — no cloud audio.
 */

export type StreamPlayerState = "idle" | "playing" | "paused" | "ended" | "error";

export interface StreamPlayerEvents {
  onState?: (state: StreamPlayerState) => void;
  onError?: (message: string) => void;
  onEnded?: () => void;
}

export interface PcmChunk {
  /** interleaved Float32 samples in [-1, 1] */
  samples: Float32Array;
  sampleRate: number;
}

export class StreamingAudioPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];
  private state: StreamPlayerState = "idle";
  private events: StreamPlayerEvents;
  private rate = 1;
  private pausedAt = 0;
  private startedAt = 0;
  private gain: GainNode | null = null;

  constructor(events: StreamPlayerEvents = {}) {
    this.events = events;
  }

  getState(): StreamPlayerState {
    return this.state;
  }

  setRate(rate: number): void {
    this.rate = Math.min(1.35, Math.max(0.75, rate));
    for (const s of this.sources) {
      try {
        s.playbackRate.value = this.rate;
      } catch {
        /* ignore */
      }
    }
  }

  getRate(): number {
    return this.rate;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const AC =
        typeof window !== "undefined"
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;
      if (!AC) throw new Error("Web Audio API unavailable");
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private setState(s: StreamPlayerState): void {
    this.state = s;
    this.events.onState?.(s);
  }

  async enqueue(chunk: PcmChunk): Promise<void> {
    if (chunk.samples.length === 0) return;
    try {
      const ctx = this.ensureCtx();
      if (ctx.state === "suspended") await ctx.resume();
      const frames = chunk.samples.length;
      const buffer = ctx.createBuffer(1, frames, chunk.sampleRate);
      buffer.copyToChannel(new Float32Array(chunk.samples), 0);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = this.rate;
      src.connect(this.gain ?? ctx.destination);
      const startAt = Math.max(ctx.currentTime, this.nextTime);
      src.start(startAt);
      this.nextTime = startAt + buffer.duration / this.rate;
      this.sources.push(src);
      src.onended = () => {
        this.sources = this.sources.filter((x) => x !== src);
        if (this.sources.length === 0 && this.state === "playing") {
          this.setState("ended");
          this.events.onEnded?.();
          this.setState("idle");
        }
      };
      if (this.state !== "playing" && this.state !== "paused") {
        this.startedAt = ctx.currentTime;
        this.setState("playing");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Audio playback failed";
      this.setState("error");
      this.events.onError?.(msg);
    }
  }

  /** Decode a full WAV/PCM ArrayBuffer as one chunk (non-streaming fallback). */
  async playArrayBuffer(buf: ArrayBuffer): Promise<void> {
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") await ctx.resume();
    const audioBuf = await ctx.decodeAudioData(buf.slice(0));
    const ch = audioBuf.getChannelData(0);
    await this.enqueue({ samples: new Float32Array(ch), sampleRate: audioBuf.sampleRate });
  }

  async pause(): Promise<void> {
    if (!this.ctx || this.state !== "playing") return;
    this.pausedAt = this.ctx.currentTime;
    await this.ctx.suspend();
    this.setState("paused");
  }

  async resume(): Promise<void> {
    if (!this.ctx || this.state !== "paused") return;
    await this.ctx.resume();
    this.setState("playing");
  }

  async stop(): Promise<void> {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.sources = [];
    this.nextTime = 0;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
    this.gain = null;
    this.setState("idle");
  }
}
