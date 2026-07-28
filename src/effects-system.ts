// Neon Joust VR — Effects system (particles + ambient + wave transitions + lava embers)
import { createSystem, World, Group, Mesh, SphereGeometry, BoxGeometry, MeshBasicMaterial,
  LineSegments, EdgesGeometry, LineBasicMaterial } from '@iwsdk/core';
import { gameState, COLOR_SCHEMES, POWERUP_COLORS, ARENA_W, LAVA_Y } from './game-state.js';

interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }
interface Orb { mesh: Mesh; baseY: number; speed: number; phase: number; }
interface Ember { mesh: Mesh; x: number; y: number; vx: number; vy: number; life: number; wobble: number; }

export class EffectsSystem extends createSystem({}) {

  private particles: Particle[] = [];
  private orbs: Orb[] = [];
  private embers: Ember[] = [];
  private prevScore = 0;
  private prevWave = 0;
  private prevPowerUp: string | null = null;
  private emberTimer = 0;
  private prevPlayerAlive = true;
  private respawnFlashTimer = 0;
  private flashMesh: Mesh | null = null;
  private deathBurstDone = false;

  init() {
    this.createOrbs();
    this.createFlashOverlay();
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

  private createFlashOverlay() {
    // Full-screen flash for big events (boss defeat, death, respawn)
    const geo = new BoxGeometry(50, 30, 0.01);
    const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.flashMesh = new Mesh(geo, mat);
    this.flashMesh.position.set(0, 7, 15);
    this.world.scene.add(this.flashMesh);
  }

  private triggerFlash(color: number, intensity: number) {
    if (!this.flashMesh) return;
    (this.flashMesh.material as MeshBasicMaterial).color.setHex(color);
    (this.flashMesh.material as MeshBasicMaterial).opacity = intensity;
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

  private deathExplosion(x: number, y: number) {
    // Large burst with player color and white sparks
    this.burst(x, y, gameState.accentColor, 20);
    this.burst(x, y, 0xffffff, 10);
    // Outward ring of larger particles
    for (let i = 0; i < 12; i++) {
      const geo = new SphereGeometry(0.06, 4, 3);
      const mat = new MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      this.world.scene.add(mesh);
      const angle = (Math.PI * 2 * i) / 12;
      const spd = 5 + Math.random() * 3;
      this.particles.push({
        mesh, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        vz: (Math.random() - 0.5) * 3, life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
      });
    }
    // Falling debris particles
    for (let i = 0; i < 8; i++) {
      const geo = new BoxGeometry(0.05, 0.05, 0.05);
      const mat = new MeshBasicMaterial({ color: gameState.accentColor, transparent: true, opacity: 0.7 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      this.world.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 2,
        life: 1.0 + Math.random() * 0.5,
        maxLife: 1.5,
      });
    }
    this.triggerFlash(0xff4444, 0.15);
  }

  private respawnSparkle(x: number, y: number) {
    // Upward spiral of sparkles at respawn point
    for (let i = 0; i < 16; i++) {
      const geo = new SphereGeometry(0.03, 4, 3);
      const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y - 0.5, 0);
      this.world.scene.add(mesh);
      const angle = (Math.PI * 2 * i) / 16;
      const radius = 0.3 + (i / 16) * 0.5;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * radius * 3,
        vy: 3 + Math.random() * 4,
        vz: Math.sin(angle) * radius,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
      });
    }
    // Central glow burst
    this.burst(x, y, gameState.accentColor, 8);
    this.triggerFlash(gameState.accentColor, 0.1);
    this.respawnFlashTimer = 0.5;
  }

  private spawnEmber() {
    const x = (Math.random() - 0.5) * (ARENA_W + 2);
    const geo = new SphereGeometry(0.025 + Math.random() * 0.02, 4, 3);
    const colors = [0xff4400, 0xff6600, 0xff8800, 0xffaa00];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5 + Math.random() * 0.3 });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, LAVA_Y + 0.2, (Math.random() - 0.5) * 3);
    this.world.scene.add(mesh);
    this.embers.push({
      mesh, x, y: LAVA_Y + 0.2,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.8 + Math.random() * 1.5,
      life: 1.5 + Math.random() * 2,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  private trailBurst(x: number, y: number, color: number) {
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
        this.world.scene.add(mesh);
        const angle = (Math.PI * 2 * j) / 8;
        this.particles.push({
          mesh, vx: Math.cos(angle) * 4, vy: 5 + Math.sin(angle) * 3,
          vz: (Math.random() - 0.5) * 2, life: 1.2, maxLife: 1.2,
        });
      }
    }
    // Boss wave gets extra dramatic
    if (gameState.bossWave) {
      this.triggerFlash(0xff6600, 0.12);
    }
  }

  private bossDefeatExplosion() {
    // Massive multi-burst explosion for boss defeat
    for (let i = 0; i < 3; i++) {
      const bx = gameState.playerX + (Math.random() - 0.5) * 4;
      const by = gameState.playerY + (Math.random() - 0.5) * 4;
      this.burst(bx, by, 0xff6600, 16);
      this.burst(bx, by, 0xffcc00, 10);
    }
    // Big white flash
    this.triggerFlash(0xffcc00, 0.2);
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

    // Lava embers — continuously rising from lava
    if (gameState.screen === 'playing' || gameState.screen === 'menu') {
      this.emberTimer -= dt;
      if (this.emberTimer <= 0) {
        this.emberTimer = 0.3 + Math.random() * 0.5;
        this.spawnEmber();
        // More embers at higher waves
        if (gameState.wave >= 5 && Math.random() < 0.4) this.spawnEmber();
        if (gameState.wave >= 10 && Math.random() < 0.3) this.spawnEmber();
      }
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.world.scene.remove(e.mesh);
        this.embers.splice(i, 1);
        continue;
      }
      e.y += e.vy * dt;
      e.x += e.vx * dt + Math.sin(time * 3 + e.wobble) * 0.3 * dt;
      e.mesh.position.set(e.x, e.y, e.mesh.position.z);
      const mat = e.mesh.material as MeshBasicMaterial;
      // Fade out near end of life
      mat.opacity = Math.min(0.7, (e.life / 2) * 0.7);
      // Shrink as they rise
      const s = 0.5 + (e.life / 3) * 0.5;
      e.mesh.scale.setScalar(s);
    }

    // Death explosion — trigger once when player dies
    if (!gameState.playerAlive && this.prevPlayerAlive) {
      this.deathExplosion(gameState.playerX, gameState.playerY);
      this.deathBurstDone = true;
    }
    // Respawn sparkle — trigger once when player comes back alive
    if (gameState.playerAlive && !this.prevPlayerAlive) {
      this.respawnSparkle(gameState.playerX, gameState.playerY);
    }
    this.prevPlayerAlive = gameState.playerAlive;

    // Respawn flash fade
    if (this.respawnFlashTimer > 0) {
      this.respawnFlashTimer -= dt;
    }

    // Flash overlay fade
    if (this.flashMesh) {
      const mat = this.flashMesh.material as MeshBasicMaterial;
      if (mat.opacity > 0) {
        mat.opacity = Math.max(0, mat.opacity - dt * 0.8);
      }
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

    // Boss defeat flash (triggered via sfxAction in game-system)
    if (gameState.sfxAction === 'boss_defeat') {
      this.bossDefeatExplosion();
    }

    // Power-up collect effect
    const currentPU = gameState.activePowerUp;
    if (currentPU && currentPU !== this.prevPowerUp) {
      const color = POWERUP_COLORS[currentPU] ?? 0xffffff;
      this.burst(gameState.playerX, gameState.playerY, color, 12);
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
