import { fetchIceConfig, IceServerEntry, mpClient } from './onlineClient';

export interface RtcPeerStatus {
  peerId: string;
  state: RTCPeerConnectionState | 'idle';
  iceState: RTCIceConnectionState;
  channelOpen: boolean;
  rttMs: number | null;
}

class WebRtcP2PManager {
  private peers = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private statuses = new Map<string, RtcPeerStatus>();
  private iceServers: IceServerEntry[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  private hasTurn = false;
  private turnInfo = 'Usando STUN público.';
  private statusListeners = new Set<(peers: RtcPeerStatus[]) => void>();
  private telemetryListeners = new Set<(fromPeerId: string, data: Record<string, unknown>) => void>();
  private manualPc: RTCPeerConnection | null = null;
  private manualChannel: RTCDataChannel | null = null;

  public async refreshIceConfig(): Promise<{
    iceServers: IceServerEntry[];
    hasTurn: boolean;
    turnInfo: string;
  }> {
    const cfg = await fetchIceConfig();
    if (cfg && Array.isArray(cfg.iceServers) && cfg.iceServers.length > 0) {
      this.iceServers = cfg.iceServers;
      this.hasTurn = Boolean(cfg.hasTurn);
      this.turnInfo = cfg.turnInfo;
    }
    return {
      iceServers: this.iceServers,
      hasTurn: this.hasTurn,
      turnInfo: this.turnInfo,
    };
  }

  public getTurnSummary(): { hasTurn: boolean; turnInfo: string; serverCount: number } {
    return {
      hasTurn: this.hasTurn,
      turnInfo: this.turnInfo,
      serverCount: this.iceServers.length,
    };
  }

  public subscribe(cb: (peers: RtcPeerStatus[]) => void): () => void {
    this.statusListeners.add(cb);
    cb(Array.from(this.statuses.values()));
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  public subscribeTelemetry(
    cb: (fromPeerId: string, data: Record<string, unknown>) => void,
  ): () => void {
    this.telemetryListeners.add(cb);
    return () => {
      this.telemetryListeners.delete(cb);
    };
  }

  public hasOpenDataChannels(): boolean {
    for (const ch of this.channels.values()) {
      if (ch.readyState === 'open') return true;
    }
    return false;
  }

  public broadcastTelemetry(payload: Record<string, unknown>): boolean {
    let sentAny = false;
    const raw = JSON.stringify({ type: 'telemetry', payload });
    for (const ch of this.channels.values()) {
      if (ch.readyState === 'open') {
        try {
          ch.send(raw);
          sentAny = true;
        } catch {
          // Ignore transient DataChannel buffer full
        }
      }
    }
    return sentAny;
  }

  private emitStatuses(): void {
    const snapshot = Array.from(this.statuses.values());
    this.statusListeners.forEach((cb) => cb(snapshot));
  }

  private updateStatus(peerId: string, partial: Partial<RtcPeerStatus>): void {
    const prev: RtcPeerStatus = this.statuses.get(peerId) ?? {
      peerId,
      state: 'new',
      iceState: 'new',
      channelOpen: false,
      rttMs: null,
    };
    this.statuses.set(peerId, { ...prev, ...partial });
    this.emitStatuses();
  }

  private createPeerConnection(remoteUserId: string): RTCPeerConnection {
    const existing = this.peers.get(remoteUserId);
    if (existing) {
      return existing;
    }
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peers.set(remoteUserId, pc);
    this.updateStatus(remoteUserId, {
      state: pc.connectionState,
      iceState: pc.iceConnectionState,
      channelOpen: false,
    });

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        mpClient.sendRtcSignal({
          toUserId: remoteUserId,
          signalType: 'ice',
          candidate: evt.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateStatus(remoteUserId, { state: pc.connectionState });
    };

    pc.oniceconnectionstatechange = () => {
      this.updateStatus(remoteUserId, { iceState: pc.iceConnectionState });
    };

    pc.ondatachannel = (evt) => {
      this.bindDataChannel(remoteUserId, evt.channel);
    };

    return pc;
  }

  private bindDataChannel(remoteUserId: string, ch: RTCDataChannel): void {
    this.channels.set(remoteUserId, ch);
    ch.onopen = () => {
      this.updateStatus(remoteUserId, { channelOpen: true });
      try {
        ch.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      } catch {
        // Ignore
      }
    };
    ch.onclose = () => {
      this.updateStatus(remoteUserId, { channelOpen: false });
    };
    ch.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as {
          type?: string;
          ts?: number;
          payload?: Record<string, unknown>;
        };
        if (msg.type === 'ping' && typeof msg.ts === 'number') {
          ch.send(JSON.stringify({ type: 'pong', ts: msg.ts }));
        } else if (msg.type === 'pong' && typeof msg.ts === 'number') {
          this.updateStatus(remoteUserId, { rttMs: Math.max(1, Date.now() - msg.ts) });
        } else if (msg.type === 'telemetry' && msg.payload) {
          this.telemetryListeners.forEach((cb) => cb(remoteUserId, msg.payload!));
        }
      } catch {
        // Ignore malformed datachannel msg
      }
    };
  }

  public async connectToPeerViaRoom(remoteUserId: string): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;
    await this.refreshIceConfig();
    const pc = this.createPeerConnection(remoteUserId);
    if (!this.channels.has(remoteUserId)) {
      const ch = pc.createDataChannel('metro-rush-p2p', { ordered: false, maxRetransmits: 1 });
      this.bindDataChannel(remoteUserId, ch);
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    mpClient.sendRtcSignal({
      toUserId: remoteUserId,
      signalType: 'offer',
      sdp: offer,
    });
  }

  public async handleIncomingSignal(payload: {
    fromUserId: string;
    signalType: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;
    const { fromUserId, signalType, sdp, candidate } = payload;
    const pc = this.createPeerConnection(fromUserId);

    if (signalType === 'offer' && sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      mpClient.sendRtcSignal({
        toUserId: fromUserId,
        signalType: 'answer',
        sdp: answer,
      });
    } else if (signalType === 'answer' && sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } else if (signalType === 'ice' && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE
      }
    }
  }

  public closeAll(): void {
    for (const ch of this.channels.values()) {
      try {
        ch.close();
      } catch {
        // Ignore
      }
    }
    for (const pc of this.peers.values()) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
    }
    this.channels.clear();
    this.peers.clear();
    this.statuses.clear();
    this.emitStatuses();
  }

  /* ---------------- MANUAL OFFER / ANSWER SDP FALLBACK ---------------- */

  public async createManualOffer(): Promise<string> {
    await this.refreshIceConfig();
    if (this.manualPc) {
      try {
        this.manualPc.close();
      } catch {
        // Ignore
      }
    }
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.manualPc = pc;
    this.manualChannel = pc.createDataChannel('metro-rush-manual');
    this.bindDataChannel('manual_peer', this.manualChannel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc, 2200);
    return JSON.stringify(pc.localDescription);
  }

  public async acceptManualOfferAndCreateAnswer(offerJson: string): Promise<string> {
    await this.refreshIceConfig();
    if (this.manualPc) {
      try {
        this.manualPc.close();
      } catch {
        // Ignore
      }
    }
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.manualPc = pc;
    pc.ondatachannel = (evt) => {
      this.manualChannel = evt.channel;
      this.bindDataChannel('manual_peer', evt.channel);
    };
    const parsed = JSON.parse(offerJson) as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(new RTCSessionDescription(parsed));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc, 2200);
    return JSON.stringify(pc.localDescription);
  }

  public async applyManualAnswer(answerJson: string): Promise<void> {
    if (!this.manualPc) {
      throw new Error('Primero debes generar una Oferta P2P manual.');
    }
    const parsed = JSON.parse(answerJson) as RTCSessionDescriptionInit;
    await this.manualPc.setRemoteDescription(new RTCSessionDescription(parsed));
  }
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export const rtcClient = new WebRtcP2PManager();
