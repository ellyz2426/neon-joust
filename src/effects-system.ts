// Neon Joust VR — Effects system (particles + ambient + wave transitions)
import { createSystem, World, Group, Mesh, SphereGeometry, BoxGeometry, MeshBasicMaterial,
  LineSegments, EdgesGeometry, LineBasicMaterial } from '@iwsdk/core';
import { gameState, COLOR_SCHEMES, POWERUP_COLORS } from './game-state.js';

interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }
interface Orb { mesh: Mesh; baseY: number; speed: number; phase: number; }
interface WaveBanner { meshes: Mesh[]; life: number; }

export class EffectsSystem extends createSystem({}) {

  private particles: Particle[] = [];
  private orbs: Orb[] = [];
  private waveBanners: WaveBanner[] = [];
  private prevScore = 0;
  private prevWave = 0;
  private prevPowerUp: string | null = null;

  init() {
    this.createOrbs();
  }

  private createOrbs() {
    const scene = this.world.scene;
    for (let i = 0; i < 20; i++) {
      const geo = new SphereGeometry(0.06 + Math.random() * 0.04, 6, 4);
      const mat = new MeshBasicMaterial({ color: gameState.accentColor, transparent: true, opacity: 0.3 + Math.random() * 0.3 });
      const mesh = new Mesh(geo, mat);
      const x = (Math.random() - 0.5) * 24;
      const y = 1 + Math.random() * 13;
      const z = -2 + Math.random() * 4;
      mesh.position.set(x, y, z);
      scene.add(mesh);
      this.orbs.push({ mesh, baseY: y, speed: 0.2 + Math.random() * 0.4, phase: Math.random() * Math.PI * 2 });
    }
  }

  burst(x: number, y: number, color: number, count: number = 8) {
    for (let i = 0; i < count; i++) {
      const geo = new SphereGeometry(0.04, 4, 3);
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      this.world.scene.add(mesh);
      const angle = (Math.PI * 2 * i) / count;
      const spd = 2 + Math.random() * 3;
      this.particles.push({
        mesh, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        vz: (Math.random() - 0.5) * 2, life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
      });
    }
  }

  private trailBurst(x: number, y: number, color: number) {
    // Upward trail particles
    for (let i = 0; i < 4; i++) {
      const geo = new SphereGeometry(0.03, 4, 3);
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      this.world.scene.add(mesh);
      this.particles.push({
        mesh, vx: (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 4,
        vz: (Math.random() - 0.5), life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
      });
    }
  }

  private waveTransitionEffect() {
    const scene = this.world.scene;
    // Burst from multiple points
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 18;
      const y = 2 + Math.random() * 10;
      this.burst(x, y, gameState.accentColor, 15);
    }
    // Firework trails from bottom
    for (let i = 0; i < 3; i++) {
      const x = -6 + i * 6;
      for (let j = 0; j < 8; j++) {
        const geo = new SphereGeometry(0.05, 4, 3);
        const hue = [0xff4444, 0x44ff44, 0x4444ff, 0xffcc00, 0xff44ff, 0x00ffff, 0xff8800, 0xffffff];
        const mat = new MeshBasicMaterial({ color: hue[j % hue.length], transparent: true, opacity: 0.9 });
        const mesh = new Mesh(geo, mat);
        mesh.position.set(x, 1, 0);
        scene.add(mesh);
        const angle = (Math.PI * 2 * j) / 8;
        this.particles.push({
          mesh, vx: Math.cos(angle) * 4, vy: 5 + Math.sin(angle) * 3,
          vz: (Math.random() - 0.5) * 2, life: 1.2, maxLife: 1.2,
        });
      }
    }
  }

  update(delta: number, time: number) {
    const dt = Math.min(delta, 0.05);
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.world.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 5 * dt;
      const mat = p.mesh.material as MeshBasicMaterial;
      mat.opacity = (p.life / p.maxLife) * 0.8;
      p.mesh.scale.setScalar(0.3 + (p.life / p.maxLife) * 0.7);
    }

    // Ambient orbs
    for (const o of this.orbs) {
      o.mesh.position.y = o.baseY + Math.sin(time * o.speed + o.phase) * 0.5;
      const mat = o.mesh.material as MeshBasicMaterial;
      mat.opacity = 0.2 + 0.2 * Math.sin(time * o.speed * 2 + o.phase);
    }

    // Score-triggered bursts
    if (gameState.score > this.prevScore + 100) {
      this.burst(gameState.playerX, gameState.playerY, gameState.accentColor, 6);
      this.prevScore = gameState.score;
    }

    // Wave-triggered celebration
    if (gameState.wave > this.prevWave && this.prevWave > 0) {
      this.waveTransitionEffect();
    }
    this.prevWave = gameState.wave;

    // Power-up collect effect
    const currentPU = gameState.activePowerUp;
    if (currentPU && currentPU !== this.prevPowerUp) {
      const color = POWERUP_COLORS[currentPU] ?? 0xffffff;
      this.burst(gameState.playerX, gameState.playerY, color, 12);
      // Ring of particles around player
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const px = gameState.playerX + Math.cos(angle) * 0.8;
        const py = gameState.playerY + Math.sin(angle) * 0.8;
        this.trailBurst(px, py, color);
      }
    }
    this.prevPowerUp = currentPU;

    // Color scheme change — update orb colors
    if (gameState.colorChanged) {
      gameState.colorChanged = false;
      for (const o of this.orbs) {
        (o.mesh.material as MeshBasicMaterial).color.setHex(gameState.accentColor);
      }
    }
  }

  updateOrbColors(color: number) {
    for (const o of this.orbs) {
      (o.mesh.material as MeshBasicMaterial).color.setHex(color);
    }
  }
}
