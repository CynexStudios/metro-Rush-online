import { DistrictId, PCSettings, TimeOfDay, WeatherType } from './types';

export type MusicMode =
  | 'intro'
  | 'lobby'
  | 'exploration'
  | 'highspeed'
  | 'tension'
  | 'pursuit'
  | 'event'
  | 'boss'
  | 'victory'
  | 'defeat';

export type AudioSettingsSlice = Pick<
  PCSettings,
  | 'masterVolume'
  | 'musicVolume'
  | 'sfxVolume'
  | 'ambientVolume'
  | 'voiceVolume'
  | 'uiVolume'
  | 'droneVolume'
  | 'vehicleVolume'
  | 'chaseVolume'
  | 'muted'
>;

/**
 * Next-Gen 9-Channel Procedural Web Audio Engine
 */
class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private vehicleGain: GainNode | null = null;
  private chaseGain: GainNode | null = null;

  private musicFilter: BiquadFilterNode | null = null;
  private tunnelDelay: DelayNode | null = null;
  private tunnelFeedback: GainNode | null = null;

  private ambientNoiseSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;

  private isPlayingMusic = false;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private schedulerId: number | null = null;

  private bpm = 134;
  private rootHz = 110;
  private intensity = 0.35;
  private slowMoFactor = 1.0;
  private dangerLevel = 0;
  private inTunnel = false;
  private districtId: DistrictId = 'downtown';
  private bossPhase = 1;
  private musicMode: MusicMode = 'lobby';
  private lobbyMusicEnabled = true;

  private settings: AudioSettingsSlice = {
    masterVolume: 0.75,
    musicVolume: 0.55,
    sfxVolume: 0.85,
    ambientVolume: 0.45,
    voiceVolume: 0.7,
    uiVolume: 0.75,
    droneVolume: 0.8,
    vehicleVolume: 0.8,
    chaseVolume: 0.85,
    muted: false,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 14000;
      this.musicFilter.Q.value = 1.1;

      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.uiGain = this.ctx.createGain();
      this.droneGain = this.ctx.createGain();
      this.vehicleGain = this.ctx.createGain();
      this.chaseGain = this.ctx.createGain();

      // Acoustic tunnel resonance
      this.tunnelDelay = this.ctx.createDelay(0.5);
      this.tunnelDelay.delayTime.value = 0.085;
      this.tunnelFeedback = this.ctx.createGain();
      this.tunnelFeedback.gain.value = 0.0;

      this.sfxGain.connect(this.tunnelDelay);
      this.tunnelDelay.connect(this.tunnelFeedback);
      this.tunnelFeedback.connect(this.tunnelDelay);
      this.tunnelFeedback.connect(this.masterGain);

      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.uiGain.connect(this.masterGain);
      this.droneGain.connect(this.masterGain);
      this.vehicleGain.connect(this.masterGain);
      this.chaseGain.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);

      this.startAmbientBed();
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private startAmbientBed(): void {
    if (!this.ctx || !this.ambientGain || this.ambientNoiseSource) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.03 * white) / 1.03;
      lastOut = data[i];
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'bandpass';
    this.ambientFilter.frequency.value = 420;
    this.ambientFilter.Q.value = 0.7;

    src.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    src.start();
    this.ambientNoiseSource = src;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public updateSettings(settings: AudioSettingsSlice & { lobbyMusicEnabled?: boolean }): void {
    this.settings = { ...settings };
    if (settings.lobbyMusicEnabled !== undefined) {
      this.lobbyMusicEnabled = settings.lobbyMusicEnabled;
      if (this.musicMode === 'lobby' && !this.lobbyMusicEnabled) {
        this.stopMusic();
      }
    }
    this.applyVolumes();
  }

  public setBossPhase(phase: number): void {
    this.bossPhase = Math.max(1, Math.min(4, Math.round(phase)));
    if (this.musicMode === 'boss') {
      this.intensity = Math.min(1, 0.72 + this.bossPhase * 0.07);
    }
  }

  public setMusicMode(mode: MusicMode): void {
    this.musicMode = mode;
    if (mode === 'lobby' || mode === 'intro') {
      this.bpm = mode === 'intro' ? 118 : 112;
      this.intensity = mode === 'intro' ? 0.34 : 0.28;
      this.dangerLevel = 0;
      if (this.lobbyMusicEnabled && this.ctx?.state === 'running') {
        this.startMusic();
      } else if (!this.lobbyMusicEnabled) {
        this.stopMusic();
      }
    } else if (mode === 'exploration') {
      this.intensity = Math.max(this.intensity, 0.38);
    } else if (mode === 'highspeed' || mode === 'event') {
      this.intensity = Math.max(this.intensity, 0.72);
    } else if (mode === 'tension') {
      this.intensity = Math.max(this.intensity, 0.6);
    } else if (mode === 'pursuit' || mode === 'boss') {
      this.intensity = Math.max(this.intensity, mode === 'boss' ? 0.78 + this.bossPhase * 0.05 : 0.8);
      this.dangerLevel = Math.max(this.dangerLevel, 0.6);
    } else if (mode === 'victory' || mode === 'defeat') {
      this.intensity = 0.22;
      this.dangerLevel = 0;
    }
  }

  public startLobbyMusicIfAllowed(enabled: boolean): void {
    this.lobbyMusicEnabled = enabled;
    this.musicMode = 'lobby';
    if (!enabled) {
      this.stopMusic();
      return;
    }
    const ctx = this.ensureContext();
    if (ctx) {
      this.bpm = 112;
      this.intensity = 0.28;
      this.dangerLevel = 0;
      this.startMusic();
    }
  }

  private applyVolumes(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      !this.musicGain ||
      !this.sfxGain ||
      !this.ambientGain ||
      !this.voiceGain ||
      !this.uiGain ||
      !this.droneGain ||
      !this.vehicleGain ||
      !this.chaseGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.04);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume * 0.42, now, 0.06);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume * 0.78, now, 0.04);
    this.ambientGain.gain.setTargetAtTime(this.settings.ambientVolume * 0.35, now, 0.08);
    this.voiceGain.gain.setTargetAtTime(this.settings.voiceVolume * 0.65, now, 0.04);
    this.uiGain.gain.setTargetAtTime(this.settings.uiVolume * 0.65, now, 0.04);
    this.droneGain.gain.setTargetAtTime(this.settings.droneVolume * 0.72, now, 0.04);
    this.vehicleGain.gain.setTargetAtTime(this.settings.vehicleVolume * 0.72, now, 0.04);
    this.chaseGain.gain.setTargetAtTime(this.settings.chaseVolume * 0.78, now, 0.04);
  }

  public setCityAmbience(
    districtId: DistrictId,
    timePeriod: Exclude<TimeOfDay, 'dynamic'>,
    weather: WeatherType,
  ): void {
    this.districtId = districtId;
    this.inTunnel = districtId === 'underground';
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.tunnelFeedback) {
      this.tunnelFeedback.gain.setTargetAtTime(
        this.inTunnel ? 0.36 : districtId === 'oldcity' ? 0.14 : 0.0,
        now,
        0.15,
      );
    }
    if (this.ambientFilter) {
      let freq = 420;
      if (districtId === 'underground') freq = 210;
      else if (districtId === 'beach') freq = 310;
      else if (districtId === 'industrial') freq = 280;
      else if (districtId === 'skyline') freq = 620;
      else if (districtId === 'future') freq = 520;
      if (weather === 'rain' || weather === 'storm') freq += 460;
      if (timePeriod === 'night' || timePeriod === 'midnight') freq *= 0.88;
      this.ambientFilter.frequency.setTargetAtTime(freq, now, 0.25);
    }
  }

  public setEnvironmentReverb(inTunnel: boolean, rainActive: boolean): void {
    this.setCityAmbience(
      inTunnel ? 'underground' : 'downtown',
      'night',
      rainActive ? 'rain' : 'clear',
    );
  }

  public setMusicParams(params: {
    bpm?: number;
    rootHz?: number;
    intensity?: number;
    slowMo?: boolean;
    danger?: number;
  }): void {
    if (params.bpm !== undefined) this.bpm = params.bpm;
    if (params.rootHz !== undefined) this.rootHz = params.rootHz;
    if (params.intensity !== undefined) {
      this.intensity = Math.max(0.15, Math.min(1, params.intensity));
    }
    if (params.slowMo !== undefined) {
      this.slowMoFactor = params.slowMo ? 0.45 : 1.0;
    }
    if (params.danger !== undefined) {
      this.dangerLevel = Math.max(0, Math.min(1, params.danger));
    }

    if (this.ctx && this.musicFilter) {
      const targetCutoff =
        this.slowMoFactor < 0.8
          ? 700
          : (this.inTunnel ? 1800 : 2800) +
            this.intensity * 9500 +
            this.dangerLevel * 2800;
      this.musicFilter.frequency.setTargetAtTime(
        targetCutoff,
        this.ctx.currentTime,
        0.08,
      );
    }
  }

  public startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    this.stepIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const scheduleLoop = () => {
      if (!this.isPlayingMusic || !this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
        this.scheduleStep(this.stepIndex, this.nextNoteTime);
        const effBpm =
          (this.bpm + this.intensity * 16 + this.dangerLevel * 12) *
          (this.slowMoFactor < 0.8 ? 0.65 : 1.0);
        const sixteenth = 60 / effBpm / 4;
        this.nextNoteTime += sixteenth;
        this.stepIndex = (this.stepIndex + 1) % 16;
      }
      this.schedulerId = window.setTimeout(scheduleLoop, 30);
    };

    scheduleLoop();
  }

  public stopMusic(): void {
    this.isPlayingMusic = false;
    if (this.schedulerId !== null) {
      clearTimeout(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.musicFilter) return;

    const isLobby = this.musicMode === 'lobby' || this.musicMode === 'victory' || this.musicMode === 'defeat';

    if (step === 0 || (!isLobby && (step === 10 || (this.intensity > 0.65 && step === 6))) || (isLobby && step === 8)) {
      this.playKick(time);
    }
    if (!isLobby && (step === 4 || step === 12)) {
      this.playSnare(time, 0.34 + this.intensity * 0.24);
    } else if (isLobby && step === 12) {
      this.playSnare(time, 0.16);
    }
    if (step % 2 === 0 || (!isLobby && this.intensity > 0.45)) {
      const hatVol = isLobby ? 0.04 : step % 2 === 1 ? 0.065 * this.intensity : 0.1;
      this.playHat(time, hatVol);
    }

    const bassPattern = isLobby
      ? [0, 0, 7, 0, 3, 0, 5, 0, 0, 0, 7, 0, 5, 3, 0, 0]
      : [0, 0, 12, 0, 3, 0, 7, 10, 0, 0, 12, 0, 5, 7, 10, 12];
    const semitone = bassPattern[step];
    if (step % 2 === 0 || (!isLobby && this.intensity > 0.5)) {
      const freq = this.rootHz * Math.pow(2, semitone / 12) * 0.5;
      this.playBassNote(time, freq, isLobby ? 0.16 : 0.11, isLobby ? 0.14 : 0.2 + this.intensity * 0.11);
    }

    if ((isLobby && step % 4 === 0) || (!isLobby && this.intensity > 0.38 && step % 2 === 0)) {
      const scaleMap: Record<DistrictId, number[]> = {
        downtown: [0, 7, 12, 15, 19, 15, 12, 7],
        oldcity: [0, 3, 7, 10, 14, 10, 7, 3],
        industrial: [0, 1, 7, 8, 12, 8, 7, 1],
        skyline: [0, 4, 7, 11, 14, 19, 14, 11],
        beach: [0, 4, 7, 9, 12, 16, 12, 7],
        underground: [0, 1, 5, 7, 10, 7, 5, 1],
        future: [0, 6, 7, 11, 12, 18, 12, 7],
      };
      const arpIntervals = isLobby ? [0, 7, 12, 19] : (scaleMap[this.districtId] ?? scaleMap.downtown);
      const idx = Math.floor(step / (isLobby ? 4 : 2)) % arpIntervals.length;
      const bossBoost = this.musicMode === 'boss' ? (this.bossPhase - 1) * 2 : 0;
      const arpFreq = this.rootHz * 2 * Math.pow(2, (arpIntervals[idx] + bossBoost) / 12);
      this.playArpNote(time, arpFreq, isLobby ? 0.24 : 0.09, isLobby ? 0.055 : 0.07 * this.intensity);
    }

    if ((this.dangerLevel > 0.45 || this.musicMode === 'boss') && (step === 0 || step === 8 || (this.bossPhase >= 3 && step === 4))) {
      this.playArpNote(time, this.rootHz * (this.bossPhase >= 3 ? 3.5 : 3.1), 0.12, 0.065 * Math.max(0.4, this.dangerLevel));
    }
  }

  private playKick(time: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    gain.gain.setValueAtTime(0.62, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  private playSnare(time: number, vol: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 950;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    noise.start(time);
  }

  private playHat(time: number, vol: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const bufferSize = this.ctx.sampleRate * 0.035;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    noise.start(time);
  }

  private playBassNote(time: number, freq: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400 + this.intensity * 550, time);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(f);
    f.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playArpNote(time: number, freq: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  public playSoundTest(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.22, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(this.uiGain!);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.22);
    });
  }

  public playUiClick(confirm = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(confirm ? 660 : 520, now);
    if (confirm) osc.frequency.exponentialRampToValueAtTime(980, now + 0.07);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playCoin(combo = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitch = 780 + Math.min(combo, 12) * 45;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.setValueAtTime(pitch * 1.45, now + 0.045);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playGem(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [880, 1174, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.22, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.24);
    });
  }

  public playEmpCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.chaseGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.18);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.chaseGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playEmpHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.chaseGain) return;
    const now = ctx.currentTime;
    [180, 110, 62].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(32, now + i * 0.05 + 0.25);
      gain.gain.setValueAtTime(0.28, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.27);
      osc.connect(gain);
      gain.connect(this.chaseGain!);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.28);
    });
  }

  public playBossEntrance(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.chaseGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(64, now + 0.65);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    osc.connect(gain);
    gain.connect(this.chaseGain);
    osc.start(now);
    osc.stop(now + 0.74);
  }

  public playJump(isDouble = false, voicePitch = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.voiceGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isDouble ? 'triangle' : 'sine';
    const base = (isDouble ? 340 : 210) * voicePitch;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.2, now + 0.13);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playLaneSwitch(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.06);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(450, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  public playGrapple(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.16);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playSlowMo(enter: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(enter ? 620 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(enter ? 110 : 540, now + 0.28);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playAbility(voicePitch = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.voiceGain) return;
    const now = ctx.currentTime;
    [330, 495, 660, 990].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * voicePitch, now + idx * 0.035);
      gain.gain.setValueAtTime(0.15, now + idx * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.25);
      osc.connect(gain);
      gain.connect(this.voiceGain!);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.26);
    });
  }

  public playDroneAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.droneGain) return;
    const now = ctx.currentTime;
    [980, 1320].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      gain.gain.setValueAtTime(0.11, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.08);
      osc.connect(gain);
      gain.connect(this.droneGain!);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.09);
    });
  }

  public playTrainHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.vehicleGain) return;
    const now = ctx.currentTime;
    [220, 277.18].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.88, now + 0.55);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain);
      gain.connect(this.vehicleGain!);
      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  public playRobotStep(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.droneGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.droneGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      gain.gain.setValueAtTime(0.22, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.36);
    });
  }

  public playCrash(shieldBroken = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = shieldBroken ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(shieldBroken ? 320 : 140, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.32);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playFootstep(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.04);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playUiHover(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playPurchaseConfirm(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.18, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.2);
      osc.connect(gain);
      gain.connect(this.uiGain!);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.22);
    });
  }

  public playClaimReward(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    [587.33, 739.99, 880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.19, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
      osc.connect(gain);
      gain.connect(this.uiGain!);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.24);
    });
  }

  public playTalismanPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [659.25, 987.77, 1318.51, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.24, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.3);
    });
  }

  public playTalismanRevive(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [392, 523.25, 783.99, 1046.5, 1567.98].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.2, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.36);
    });
  }

  public playReviveSurge(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.32);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playPursuerSiren(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.chaseGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(920, now + 0.18);
    osc.frequency.linearRampToValueAtTime(600, now + 0.36);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.chaseGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playJetFlyby(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.vehicleGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.55);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(gain);
    gain.connect(this.vehicleGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playHelicopterPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.vehicleGain) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(84, now + i * 0.11);
      gain.gain.setValueAtTime(0.14, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.08);
      osc.connect(gain);
      gain.connect(this.vehicleGain);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.09);
    }
  }

  public playBossTelegraph(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.chaseGain) return;
    const now = ctx.currentTime;
    [520, 780, 1040].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      gain.gain.setValueAtTime(0.13, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.1);
      osc.connect(gain);
      gain.connect(this.chaseGain!);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.12);
    });
  }

  public playBossShockwave(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.chaseGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.42);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(this.chaseGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playTutorialChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    [587.33, 880, 1174.66].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.065);
      gain.gain.setValueAtTime(0.18, now + i * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.065 + 0.24);
      osc.connect(gain);
      gain.connect(this.uiGain!);
      osc.start(now + i * 0.065);
      osc.stop(now + i * 0.065 + 0.26);
    });
  }
}

export const audioEngine = new ProceduralAudioEngine();
