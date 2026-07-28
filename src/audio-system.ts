// Neon Joust VR — Audio system
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
};

let musicOsc1: OscillatorNode | null = null;
let musicGain: GainNode | null = null;
let musicPlaying = false;

function startMusic() {
  if (musicPlaying || !gameState.musicEnabled) return;
  try {
    const c = getCtx();
    musicOsc1 = c.createOscillator();
    musicGain = c.createGain();
    musicOsc1.type = 'triangle';
    musicOsc1.frequency.setValueAtTime(55, c.currentTime);
    musicGain.gain.setValueAtTime(0.04, c.currentTime);
    musicOsc1.connect(musicGain).connect(c.destination);
    musicOsc1.start();
    musicPlaying = true;
  } catch {}
}

function stopMusic() {
  if (musicOsc1) { try { musicOsc1.stop(); } catch {} musicOsc1 = null; }
  if (musicGain) { musicGain.disconnect(); musicGain = null; }
  musicPlaying = false;
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
      if (musicOsc1) {
        const baseFreq = 55;
        const wave = gameState.wave;
        const mod = Math.sin(time * 0.5) * 10 + Math.sin(time * 0.3) * 5;
        musicOsc1.frequency.setValueAtTime(baseFreq + mod + wave * 2, getCtx().currentTime);
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
