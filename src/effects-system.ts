// Neon Joust VR — Effects system (particles + ambient)
import { createSystem, World, Group, Mesh, SphereGeometry, MeshBasicMaterial } from '@iwsdk/core';
import { gameState, COLOR_SCHEMES } from './game-state.js';

interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; }
interface Orb { mesh: Mesh; baseY: number; speed: number; phase: number; }

export class EffectsSystem extends createSystem({}) {

  private particles: Particle[] = [];
  private orbs: Orb[] = [];
  private prevScore = 0;
  private prevWave = 0;

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
        vz: (Math.random() - 0.5) * 2, life: 0.6 + Math.random() * 0.4,
      });
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
      mat.opacity = p.life;
      p.mesh.scale.setScalar(p.life);
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
      for (let i = 0; i < 3; i++) {
        this.burst((Math.random() - 0.5) * 16, 2 + Math.random() * 10, gameState.accentColor, 12);
      }
    }
    this.prevWave = gameState.wave;
  }

  updateOrbColors(color: number) {
    for (const o of this.orbs) {
      (o.mesh.material as MeshBasicMaterial).color.setHex(color);
    }
  }
}
