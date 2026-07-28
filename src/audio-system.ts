// Neon Joust VR — Audio system with melody-driven music
import { createSystem } from '@iwsdk/core';
import { gameState } from './game-state.js';

let ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playTone(freq: number, dur: number, vol: number, type: OscillatorType = 'square') {
  if (!gameState.soundEnabled) return;
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  } catch {}
}

function playNoise(dur: number, vol: number) {
  if (!gameState.soundEnabled) return;
  try {
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * vol;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(g).connect(c.destination);
    src.start();
  } catch {}
}

const SFX: Record<string, () => void> = {
  flap: () => { playTone(300 + Math.random() * 100, 0.08, 0.08, 'triangle'); },
  joust_win: () => {
    playTone(600, 0.1, 0.12, 'square');
    setTimeout(() => playTone(800, 0.1, 0.12, 'square'), 60);
    setTimeout(() => playTone(1000, 0.15, 0.1, 'square'), 120);
  },
  egg_collect: () => {
    playTone(500, 0.08, 0.1, 'sine');
    setTimeout(() => playTone(700, 0.08, 0.1, 'sine'), 50);
  },
  death: () => {
    playTone(400, 0.15, 0.15, 'sawtooth');
    setTimeout(() => playTone(250, 0.2, 0.12, 'sawtooth'), 100);
    setTimeout(() => playTone(150, 0.3, 0.1, 'sawtooth'), 200);
  },
  hatch: () => {
    playNoise(0.15, 0.08);
    playTone(200, 0.1, 0.08, 'square');
  },
  levelup: () => {
    playTone(400, 0.1, 0.1, 'square');
    setTimeout(() => playTone(500, 0.1, 0.1, 'square'), 80);
    setTimeout(() => playTone(600, 0.1, 0.1, 'square'), 160);
    setTimeout(() => playTone(800, 0.2, 0.12, 'square'), 240);
  },
  achievement: () => {
    playTone(600, 0.1, 0.1, 'sine');
    setTimeout(() => playTone(800, 0.1, 0.1, 'sine'), 100);
    setTimeout(() => playTone(1000, 0.1, 0.1, 'sine'), 200);
    setTimeout(() => playTone(1200, 0.2, 0.12, 'sine'), 300);
  },
  gameover: () => {
    playTone(300, 0.2, 0.12, 'sawtooth');
    setTimeout(() => playTone(200, 0.3, 0.1, 'sawtooth'), 200);
    setTimeout(() => playTone(100, 0.5, 0.08, 'sawtooth'), 400);
  },
  powerup: () => {
    playTone(400, 0.08, 0.1, 'sine');
    setTimeout(() => playTone(600, 0.08, 0.1, 'sine'), 50);
    setTimeout(() => playTone(800, 0.08, 0.1, 'sine'), 100);
    setTimeout(() => playTone(1000, 0.1, 0.12, 'sine'), 150);
    setTimeout(() => playTone(1200, 0.15, 0.1, 'sine'), 200);
  },
  shield_break: () => {
    playNoise(0.2, 0.12);
    playTone(300, 0.15, 0.1, 'sawtooth');
    setTimeout(() => playTone(200, 0.1, 0.08, 'sawtooth'), 100);
  },
  fireball: () => {
    playNoise(0.08, 0.06);
    playTone(180, 0.15, 0.1, 'sawtooth');
    setTimeout(() => playTone(120, 0.1, 0.08, 'sawtooth'), 60);
  },
  boss_defeat: () => {
    playTone(300, 0.15, 0.12, 'square');
    setTimeout(() => playTone(400, 0.12, 0.12, 'square'), 100);
    setTimeout(() => playTone(500, 0.12, 0.12, 'square'), 200);
    setTimeout(() => playTone(600, 0.12, 0.12, 'square'), 300);
    setTimeout(() => playTone(800, 0.15, 0.14, 'square'), 400);
    setTimeout(() => playTone(1000, 0.2, 0.12, 'sine'), 500);
    setTimeout(() => playNoise(0.3, 0.1), 100);
  },
  lava_eruption: () => {
    playNoise(0.12, 0.1);
    playTone(100, 0.2, 0.12, 'sawtooth');
    setTimeout(() => playTone(150, 0.15, 0.1, 'sawtooth'), 80);
    setTimeout(() => playNoise(0.08, 0.06), 150);
  },
  wave_bonus: () => {
    playTone(500, 0.1, 0.08, 'triangle');
    setTimeout(() => playTone(600, 0.1, 0.08, 'triangle'), 80);
    setTimeout(() => playTone(700, 0.12, 0.1, 'triangle'), 160);
    setTimeout(() => playTone(900, 0.15, 0.1, 'sine'), 240);
  },
  wind: () => {
    playNoise(0.4, 0.04);
    playTone(80, 0.3, 0.03, 'sine');
    setTimeout(() => playNoise(0.3, 0.03), 150);
  },
  freeze: () => {
    playTone(1200, 0.15, 0.08, 'sine');
    setTimeout(() => playTone(1000, 0.12, 0.08, 'sine'), 80);
    setTimeout(() => playTone(800, 0.12, 0.08, 'sine'), 160);
    setTimeout(() => playTone(600, 0.15, 0.1, 'triangle'), 240);
    setTimeout(() => playNoise(0.2, 0.04), 100);
  },
  charger_dash: () => {
    playTone(200, 0.08, 0.1, 'sawtooth');
    setTimeout(() => playTone(350, 0.1, 0.12, 'sawtooth'), 40);
    setTimeout(() => playTone(500, 0.08, 0.1, 'sawtooth'), 80);
    playNoise(0.1, 0.06);
  },
};

// Melody-driven music system
const MELODY_NOTES = [
  // C minor pentatonic phrases
  [262, 311, 349, 392, 466, 523],  // C4, Eb4, F4, G4, Bb4, C5
  [196, 233, 262, 311, 349, 392],  // G3, Bb3, C4, Eb4, F4, G4
];

const BASS_NOTES = [65, 73, 87, 98]; // C2, D2, F2, G2

let musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicPlaying = false;
let melodyStep = 0;
let bassStep = 0;

function playMelodyNote() {
  if (!gameState.musicEnabled || !musicPlaying) return;
  try {
    const c = getCtx();
    const wave = Math.min(gameState.wave, MELODY_NOTES.length) - 1;
    const notes = MELODY_NOTES[Math.max(0, wave)] ?? MELODY_NOTES[0];
    const freq = notes[melodyStep % notes.length];
    const dur = 0.15 + Math.random() * 0.1;

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(0.04, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);

    melodyStep++;
    // Every 4th note, play bass
    if (melodyStep % 4 === 0) {
      const bassFreq = BASS_NOTES[bassStep % BASS_NOTES.length];
      const bo = c.createOscillator();
      const bg = c.createGain();
      bo.type = 'sine';
      bo.frequency.setValueAtTime(bassFreq, c.currentTime);
      bg.gain.setValueAtTime(0.05, c.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
      bo.connect(bg).connect(c.destination);
      bo.start();
      bo.stop(c.currentTime + 0.4);
      bassStep++;
    }
  } catch {}
}

function startMusic() {
  if (musicPlaying || !gameState.musicEnabled) return;
  try {
    const c = getCtx();
    // Low ambient drone
    const droneOsc = c.createOscillator();
    const droneGain = c.createGain();
    droneOsc.type = 'sine';
    droneOsc.frequency.setValueAtTime(55, c.currentTime);
    droneGain.gain.setValueAtTime(0.03, c.currentTime);
    droneOsc.connect(droneGain).connect(c.destination);
    droneOsc.start();
    musicNodes.push({ osc: droneOsc, gain: droneGain });

    // Second drone a fifth up
    const droneOsc2 = c.createOscillator();
    const droneGain2 = c.createGain();
    droneOsc2.type = 'sine';
    droneOsc2.frequency.setValueAtTime(82, c.currentTime);
    droneGain2.gain.setValueAtTime(0.02, c.currentTime);
    droneOsc2.connect(droneGain2).connect(c.destination);
    droneOsc2.start();
    musicNodes.push({ osc: droneOsc2, gain: droneGain2 });

    // Melody timer — notes every ~300ms
    const tempo = 300;
    musicTimer = setInterval(playMelodyNote, tempo);
    musicPlaying = true;
  } catch {}
}

function stopMusic() {
  for (const n of musicNodes) {
    try { n.osc.stop(); } catch {}
    try { n.gain.disconnect(); } catch {}
  }
  musicNodes = [];
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  musicPlaying = false;
  melodyStep = 0;
  bassStep = 0;
}

export class AudioSystem extends createSystem({}) {
  private prevScreen = '';

  init() {}

  update(_delta: number, time: number) {
    // SFX
    if (gameState.sfxAction) {
      const fn = SFX[gameState.sfxAction];
      if (fn) fn();
      gameState.sfxAction = '';
    }
    // Music
    if (gameState.screen === 'playing' && gameState.musicEnabled) {
      if (!musicPlaying) startMusic();
      // Modulate drone frequency based on wave intensity
      if (musicNodes.length > 0) {
        const baseFreq = 55 + gameState.wave * 2;
        const mod = Math.sin(time * 0.3) * 5;
        try {
          musicNodes[0].osc.frequency.setValueAtTime(baseFreq + mod, getCtx().currentTime);
        } catch {}
      }
    } else if (musicPlaying) {
      stopMusic();
    }
    if (gameState.screen === 'gameover' && this.prevScreen === 'playing') {
      SFX.gameover?.();
    }
    this.prevScreen = gameState.screen;
  }
}
