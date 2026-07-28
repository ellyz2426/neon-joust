// Neon Joust VR — Core game logic
import { createSystem, World, Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry,
  MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, Color } from '@iwsdk/core';
import { gameState, EnemyData, EggData, PLATFORMS, GRAVITY, FLAP_IMPULSE,
  FLAP_COOLDOWN, MOVE_SPEED, MAX_VY, DRAG, LAVA_Y, ARENA_W, ARENA_H } from './game-state.js';

const HALF_W = ARENA_W / 2;
const ENEMY_COLORS: Record<string, number> = { bounder: 0x44ff44, hunter: 0xffff44, shadow: 0xff4444 };
const ENEMY_SCORES: Record<string, number> = { bounder: 100, hunter: 200, shadow: 500 };
const EGG_SCORE = 150;
const PTERO_SCORE = 1000;
const HATCH_TIME = 6;
const PTERO_DELAY = 25;
const JOUST_DIST = 1.2;
const EGG_COLLECT_DIST = 1.0;
const PTERO_HIT_DIST = 1.5;

function diffMul(): number {
  return gameState.difficulty === 'insane' ? 1.6 : gameState.difficulty === 'hard' ? 1.3 : 1.0;
}

function waveEnemies(w: number): { type: string; count: number }[] {
  const dm = diffMul();
  const base: { type: string; count: number }[] = [];
  const bounders = Math.max(1, Math.floor((3 + Math.floor(w * 0.5)) * dm));
  base.push({ type: 'bounder', count: bounders });
  if (w >= 3) base.push({ type: 'hunter', count: Math.floor((Math.floor((w - 1) / 2)) * dm) || 1 });
  if (w >= 6) base.push({ type: 'shadow', count: Math.floor((Math.floor((w - 4) / 3)) * dm) || 1 });
  return base;
}

function createBirdMesh(color: number): { group: Group; wingL: Mesh; wingR: Mesh } {
  const group = new Group();
  const bodyMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
  const edgeMat = new LineBasicMaterial({ color, linewidth: 1 });
  // Body — elongated sphere
  const bodyGeo = new SphereGeometry(0.35, 8, 6);
  bodyGeo.scale(1, 0.8, 0.8);
  const body = new Mesh(bodyGeo, bodyMat);
  group.add(body);
  group.add(new LineSegments(new EdgesGeometry(bodyGeo), edgeMat));
  // Head
  const headGeo = new SphereGeometry(0.18, 6, 5);
  const head = new Mesh(headGeo, bodyMat);
  head.position.set(0.25, 0.25, 0);
  group.add(head);
  // Lance/beak — cone using CylinderGeometry(0, r, h, seg)
  const lanceGeo = new CylinderGeometry(0, 0.06, 0.5, 4);
  const lance = new Mesh(lanceGeo, new MeshBasicMaterial({ color: 0xffffff }));
  lance.rotation.z = -Math.PI / 2;
  lance.position.set(0.55, 0.25, 0);
  group.add(lance);
  // Wings
  const wingGeo = new BoxGeometry(0.4, 0.05, 0.6);
  const wingMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
  const wingL = new Mesh(wingGeo, wingMat);
  wingL.position.set(-0.1, 0.15, 0.35);
  group.add(wingL);
  const wingR = new Mesh(wingGeo, wingMat);
  wingR.position.set(-0.1, 0.15, -0.35);
  group.add(wingR);
  // Legs
  const legGeo = new CylinderGeometry(0.03, 0.03, 0.3, 4);
  const legMat = new MeshBasicMaterial({ color: 0xffaa44 });
  const legL = new Mesh(legGeo, legMat);
  legL.position.set(-0.1, -0.4, 0.12);
  group.add(legL);
  const legR = new Mesh(legGeo, legMat);
  legR.position.set(-0.1, -0.4, -0.12);
  group.add(legR);
  return { group, wingL, wingR };
}

function createEggMesh(): Mesh {
  const geo = new SphereGeometry(0.2, 8, 6);
  geo.scale(0.8, 1, 0.8);
  const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const mesh = new Mesh(geo, mat);
  const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: 0xffffff }));
  mesh.add(edges);
  return mesh;
}

function createPteroMesh(): Group {
  const g = new Group();
  const mat = new MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7 });
  const edgeMat = new LineBasicMaterial({ color: 0xff8800 });
  const bodyGeo = new SphereGeometry(0.5, 8, 6);
  bodyGeo.scale(1.5, 0.6, 0.6);
  const body = new Mesh(bodyGeo, mat);
  g.add(body);
  g.add(new LineSegments(new EdgesGeometry(bodyGeo), edgeMat));
  const wingGeo = new BoxGeometry(1.2, 0.04, 0.8);
  const wingMat = new MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
  const wL = new Mesh(wingGeo, wingMat);
  wL.position.set(0, 0.1, 0.6);
  g.add(wL);
  const wR = new Mesh(wingGeo, wingMat);
  wR.position.set(0, 0.1, -0.6);
  g.add(wR);
  // Beak
  const bGeo = new CylinderGeometry(0, 0.1, 0.6, 4);
  const beak = new Mesh(bGeo, new MeshBasicMaterial({ color: 0xffcc00 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.8, 0, 0);
  g.add(beak);
  return g;
}

function landOnPlatform(x: number, y: number, vy: number, r: number): { landed: boolean; py: number } {
  if (vy > 0) return { landed: false, py: y };
  for (const p of PLATFORMS) {
    const hw = p.w / 2;
    if (x >= p.x - hw && x <= p.x + hw) {
      if (y >= p.y && y <= p.y + 0.6 + r) {
        return { landed: true, py: p.y + 0.4 };
      }
    }
  }
  return { landed: false, py: y };
}

function wrapX(x: number): number {
  if (x < -HALF_W - 1) return HALF_W + 1;
  if (x > HALF_W + 1) return -HALF_W - 1;
  return x;
}

export class GameSystem extends createSystem({}) {

  private playerMesh!: Group;
  private playerWingL!: Mesh;
  private playerWingR!: Mesh;
  private enemies: EnemyData[] = [];
  private eggs: EggData[] = [];
  private pteroMesh: Group | null = null;
  private platformMeshes: Group[] = [];
  private lavaMesh: Mesh | null = null;
  private inputState = { left: false, right: false, flap: false, flapPressed: false };

  init() {
    gameState.loadStats();
    this.buildPlatforms();
    this.buildLava();
    this.buildPlayer();
  }

  private buildPlatforms() {
    const scene = this.world.scene;
    for (const p of PLATFORMS) {
      const g = new Group();
      const geo = new BoxGeometry(p.w, 0.3, 1.5);
      const mat = new MeshBasicMaterial({ color: gameState.accentColor, transparent: true, opacity: 0.15 });
      const mesh = new Mesh(geo, mat);
      g.add(mesh);
      const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: gameState.accentColor }));
      g.add(edges);
      g.position.set(p.x, p.y, 0);
      scene.add(g);
      this.platformMeshes.push(g);
    }
  }

  private buildLava() {
    const geo = new BoxGeometry(ARENA_W + 4, 0.3, 4);
    const mat = new MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.5 });
    this.lavaMesh = new Mesh(geo, mat);
    this.lavaMesh.position.set(0, 0, 0);
    this.world.scene.add(this.lavaMesh);
    const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: 0xff6600 }));
    this.lavaMesh.add(edges);
  }

  private buildPlayer() {
    const { group, wingL, wingR } = createBirdMesh(gameState.accentColor);
    this.playerMesh = group;
    this.playerWingL = wingL;
    this.playerWingR = wingR;
    group.position.set(0, 7, 0);
    this.world.scene.add(group);
  }

  setInput(left: boolean, right: boolean, flap: boolean, flapPressed: boolean) {
    this.inputState = { left, right, flap, flapPressed };
  }

  startGame(mode: string) {
    gameState.screen = 'playing';
    gameState.mode = mode as any;
    gameState.score = 0;
    gameState.wave = 1;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.comboTimer = 0;
    gameState.eggsThisGame = 0;
    gameState.killsThisGame = 0;
    gameState.gameTime = 0;
    gameState.noDeathThisWave = true;
    gameState.noDeathStreak = 0;
    gameState.pteroActive = false;
    gameState.waveTimer = 0;
    gameState.speedTimer = 120;
    gameState.playerAlive = true;
    gameState.respawnTimer = 0;
    gameState.lives = mode === 'zen' ? 99 : mode === 'challenge' ? gameState.challengeLives : 3;
    gameState.playerX = 0;
    gameState.playerY = 7;
    gameState.playerVX = 0;
    gameState.playerVY = 0;
    gameState.playerFacing = 1;
    gameState.playerOnGround = false;
    gameState.playerFlapCooldown = 0;
    this.clearEntities();
    this.spawnWave();
    this.playerMesh.visible = true;
  }

  private clearEntities() {
    for (const e of this.enemies) this.world.scene.remove(e.mesh);
    for (const e of this.eggs) this.world.scene.remove(e.mesh);
    this.enemies = [];
    this.eggs = [];
    if (this.pteroMesh) { this.world.scene.remove(this.pteroMesh); this.pteroMesh = null; }
    gameState.pteroActive = false;
  }

  private spawnWave() {
    const spec = waveEnemies(gameState.wave);
    gameState.waveStarting = true;
    gameState.waveClearTimer = 0;
    gameState.waveTimer = 0;
    gameState.noDeathThisWave = true;
    for (const s of spec) {
      for (let i = 0; i < s.count; i++) {
        this.spawnEnemy(s.type as any);
      }
    }
    setTimeout(() => { gameState.waveStarting = false; }, 1500);
  }

  private spawnEnemy(type: string) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (HALF_W + 0.5);
    const y = 4 + Math.random() * 8;
    const { group, wingL, wingR } = createBirdMesh(ENEMY_COLORS[type] ?? 0x44ff44);
    group.position.set(x, y, 0);
    group.scale.x = -side;
    this.world.scene.add(group);
    this.enemies.push({
      x, y, vx: -side * (1 + Math.random() * 2) * diffMul(), vy: 0,
      type: type as any, facing: -side, flapTimer: Math.random() * 1.5,
      mesh: group, wingL, wingR, alive: true,
    });
  }

  private spawnEgg(x: number, y: number) {
    const mesh = createEggMesh();
    mesh.position.set(x, y, 0);
    this.world.scene.add(mesh);
    this.eggs.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: 1, hatchTimer: HATCH_TIME, mesh, onGround: false });
  }

  private spawnPtero() {
    if (gameState.pteroActive) return;
    gameState.pteroActive = true;
    const side = Math.random() < 0.5 ? -1 : 1;
    gameState.pteroX = side * (HALF_W + 2);
    gameState.pteroY = 5 + Math.random() * 6;
    gameState.pteroVX = -side * 5 * diffMul();
    this.pteroMesh = createPteroMesh();
    this.pteroMesh.position.set(gameState.pteroX, gameState.pteroY, 0);
    this.pteroMesh.scale.x = -side;
    this.world.scene.add(this.pteroMesh);
  }

  update(delta: number, _time: number) {
    if (gameState.screen !== 'playing') return;
    const dt = Math.min(delta, 0.05);
    gameState.gameTime += dt;
    gameState.totalPlayTime += dt;
    if (gameState.comboTimer > 0) {
      gameState.comboTimer -= dt;
      if (gameState.comboTimer <= 0) { gameState.combo = 0; gameState.comboTimer = 0; }
    }
    // Speed mode timer
    if (gameState.mode === 'speed') {
      gameState.speedTimer -= dt;
      if (gameState.speedTimer <= 0) {
        gameState.sfxAction = 'achievement';
        gameState.checkAchievements();
        if (!gameState.achievements['speed_win']) {
          gameState.achievements['speed_win'] = true;
          gameState.saveStats();
        }
        this.endGame();
        return;
      }
    }
    // Player
    if (gameState.playerAlive) {
      this.updatePlayer(dt);
    } else {
      gameState.respawnTimer -= dt;
      if (gameState.respawnTimer <= 0) {
        if (gameState.lives > 0) {
          gameState.playerAlive = true;
          gameState.playerX = 0;
          gameState.playerY = 7;
          gameState.playerVX = 0;
          gameState.playerVY = 0;
          this.playerMesh.visible = true;
        } else {
          this.endGame();
          return;
        }
      }
    }
    // Enemies
    this.updateEnemies(dt);
    // Eggs
    this.updateEggs(dt);
    // Pterodactyl
    this.updatePtero(dt);
    // Wave check
    if (!gameState.waveStarting && this.enemies.length === 0 && this.eggs.length === 0) {
      gameState.waveClearTimer += dt;
      if (gameState.waveClearTimer >= 1.0) {
        if (gameState.noDeathThisWave) gameState.noDeathStreak++;
        gameState.totalWavesAll++;
        gameState.wave++;
        if (gameState.wave > gameState.bestWave) gameState.bestWave = gameState.wave;
        gameState.sfxAction = 'levelup';
        gameState.checkAchievements();
        gameState.saveStats();
        this.spawnWave();
      }
    }
    // Ptero spawn timer
    gameState.waveTimer += dt;
    if (gameState.waveTimer > PTERO_DELAY && !gameState.pteroActive && this.enemies.length > 0) {
      this.spawnPtero();
    }
    // Lava animation
    if (this.lavaMesh) {
      this.lavaMesh.position.y = 0.05 * Math.sin(_time * 3);
      (this.lavaMesh.material as MeshBasicMaterial).opacity = 0.4 + 0.15 * Math.sin(_time * 5);
    }
    // Wing flap animation
    const flapAngle = Math.sin(_time * 12) * 0.4;
    if (gameState.playerAlive) {
      this.playerWingL.rotation.x = gameState.playerOnGround ? 0 : flapAngle;
      this.playerWingR.rotation.x = gameState.playerOnGround ? 0 : -flapAngle;
    }
    gameState.checkAchievements();
  }

  private updatePlayer(dt: number) {
    const gs = gameState;
    // Input
    if (this.inputState.left) { gs.playerVX -= MOVE_SPEED * dt * 5; gs.playerFacing = -1; }
    if (this.inputState.right) { gs.playerVX += MOVE_SPEED * dt * 5; gs.playerFacing = 1; }
    // Flap
    gs.playerFlapCooldown -= dt;
    if (this.inputState.flapPressed && gs.playerFlapCooldown <= 0) {
      gs.playerVY = Math.min(gs.playerVY + FLAP_IMPULSE, MAX_VY);
      gs.playerFlapCooldown = FLAP_COOLDOWN;
      gs.playerOnGround = false;
      gs.sfxAction = 'flap';
    }
    // Physics
    if (!gs.playerOnGround) gs.playerVY += GRAVITY * dt;
    gs.playerVX *= DRAG;
    gs.playerVX = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, gs.playerVX));
    gs.playerVY = Math.max(-MAX_VY, Math.min(MAX_VY, gs.playerVY));
    gs.playerX += gs.playerVX * dt;
    gs.playerY += gs.playerVY * dt;
    // Wrap
    gs.playerX = wrapX(gs.playerX);
    // Ceiling
    if (gs.playerY > ARENA_H - 0.5) { gs.playerY = ARENA_H - 0.5; gs.playerVY = -1; }
    // Platform landing
    const land = landOnPlatform(gs.playerX, gs.playerY, gs.playerVY, 0.4);
    if (land.landed) {
      gs.playerY = land.py;
      gs.playerVY = 0;
      gs.playerOnGround = true;
    } else {
      gs.playerOnGround = false;
    }
    // Lava death
    if (gs.playerY < LAVA_Y) {
      this.playerDeath();
      return;
    }
    // Update mesh
    this.playerMesh.position.set(gs.playerX, gs.playerY, 0);
    this.playerMesh.scale.x = gs.playerFacing;
    // Joust collision with enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const dx = gs.playerX - e.x;
      const dy = gs.playerY - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < JOUST_DIST) {
        if (gs.playerY > e.y + 0.15) {
          // Player wins
          this.defeatEnemy(i);
        } else if (e.y > gs.playerY + 0.15) {
          // Enemy wins
          this.playerDeath();
          return;
        }
        // Equal height — bounce apart
        else {
          gs.playerVX = dx > 0 ? 4 : -4;
          gs.playerVY = 3;
          e.vx = dx > 0 ? -4 : 4;
          e.vy = 3;
        }
      }
    }
    // Egg collection
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      const dx = gs.playerX - egg.x;
      const dy = gs.playerY - egg.y;
      if (Math.sqrt(dx * dx + dy * dy) < EGG_COLLECT_DIST) {
        this.collectEgg(i);
      }
    }
    // Ptero collision
    if (gs.pteroActive && this.pteroMesh) {
      const dx = gs.playerX - gs.pteroX;
      const dy = gs.playerY - gs.pteroY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PTERO_HIT_DIST) {
        if (gs.playerY > gs.pteroY + 0.3) {
          // Player defeats ptero
          this.addScore(PTERO_SCORE);
          gs.totalPterosAll++;
          gs.sfxAction = 'joust_win';
          this.world.scene.remove(this.pteroMesh);
          this.pteroMesh = null;
          gs.pteroActive = false;
          gs.checkAchievements();
          gs.saveStats();
        } else {
          this.playerDeath();
        }
      }
    }
  }

  private defeatEnemy(idx: number) {
    const e = this.enemies[idx];
    e.alive = false;
    this.world.scene.remove(e.mesh);
    this.spawnEgg(e.x, e.y);
    this.enemies.splice(idx, 1);
    gameState.combo++;
    if (gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;
    if (gameState.combo > gameState.bestCombo) gameState.bestCombo = gameState.combo;
    gameState.comboTimer = 3;
    const points = (ENEMY_SCORES[e.type] ?? 100) * Math.max(1, gameState.combo);
    this.addScore(points);
    gameState.killsThisGame++;
    gameState.totalKillsAll++;
    gameState.sfxAction = 'joust_win';
    gameState.checkAchievements();
    gameState.saveStats();
  }

  private collectEgg(idx: number) {
    const egg = this.eggs[idx];
    this.world.scene.remove(egg.mesh);
    this.eggs.splice(idx, 1);
    this.addScore(EGG_SCORE);
    gameState.eggsThisGame++;
    gameState.totalEggsAll++;
    gameState.sfxAction = 'egg_collect';
    gameState.checkAchievements();
    gameState.saveStats();
  }

  private playerDeath() {
    gameState.playerAlive = false;
    gameState.lives--;
    gameState.noDeathThisWave = false;
    gameState.noDeathStreak = 0;
    gameState.combo = 0;
    gameState.respawnTimer = 2;
    gameState.sfxAction = 'death';
    this.playerMesh.visible = false;
    if (gameState.lives <= 0 && gameState.mode !== 'zen') {
      setTimeout(() => this.endGame(), 1500);
    }
  }

  private addScore(pts: number) {
    gameState.score += pts;
    if (gameState.score > gameState.bestScore) gameState.bestScore = gameState.score;
  }

  private endGame() {
    gameState.screen = 'gameover';
    gameState.totalGames++;
    gameState.totalScoreAll += gameState.score;
    gameState.checkAchievements();
    gameState.saveStats();
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // AI flapping
      e.flapTimer -= dt;
      if (e.flapTimer <= 0) {
        const flapRate = e.type === 'shadow' ? 0.4 : e.type === 'hunter' ? 0.7 : 1.0;
        e.flapTimer = flapRate + Math.random() * flapRate;
        e.vy = Math.min(e.vy + FLAP_IMPULSE * 0.8, MAX_VY * 0.8);
      }
      // AI horizontal
      if (e.type === 'hunter' || e.type === 'shadow') {
        const spd = e.type === 'shadow' ? 4 : 2.5;
        const tx = gameState.playerAlive ? gameState.playerX : 0;
        if (tx > e.x + 0.5) e.vx += spd * dt * diffMul();
        else if (tx < e.x - 0.5) e.vx -= spd * dt * diffMul();
      } else {
        // Bounder: random drift
        if (Math.random() < 0.02) e.vx += (Math.random() - 0.5) * 3;
      }
      // Physics
      e.vy += GRAVITY * dt;
      e.vx *= DRAG;
      e.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, e.vx));
      e.vy = Math.max(-MAX_VY, Math.min(MAX_VY * 0.8, e.vy));
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = wrapX(e.x);
      if (e.y > ARENA_H - 0.5) { e.y = ARENA_H - 0.5; e.vy = -1; }
      // Platform
      const land = landOnPlatform(e.x, e.y, e.vy, 0.4);
      if (land.landed) { e.y = land.py; e.vy = 0; }
      // Lava — bounce off for enemies (they fly up)
      if (e.y < LAVA_Y + 0.3) { e.y = LAVA_Y + 0.3; e.vy = 5; }
      // Facing
      e.facing = e.vx >= 0 ? 1 : -1;
      // Update mesh
      e.mesh.position.set(e.x, e.y, 0);
      e.mesh.scale.x = e.facing;
      // Wing animation
      const wingAngle = Math.sin(performance.now() * 0.012 + e.x) * 0.4;
      e.wingL.rotation.x = wingAngle;
      e.wingR.rotation.x = -wingAngle;
    }
  }

  private updateEggs(dt: number) {
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      egg.vy += GRAVITY * dt;
      egg.vx *= 0.98;
      egg.x += egg.vx * dt;
      egg.y += egg.vy * dt;
      egg.x = wrapX(egg.x);
      // Platform
      const land = landOnPlatform(egg.x, egg.y, egg.vy, 0.2);
      if (land.landed) {
        egg.y = land.py;
        egg.vy = Math.abs(egg.vy) > 1 ? -egg.vy * 0.3 : 0;
        egg.onGround = true;
      }
      // Lava — destroy
      if (egg.y < LAVA_Y) {
        this.world.scene.remove(egg.mesh);
        this.eggs.splice(i, 1);
        continue;
      }
      // Hatch timer
      egg.hatchTimer -= dt;
      // Pulse to warn
      const mat = egg.mesh.material as MeshBasicMaterial;
      if (egg.hatchTimer < 2) {
        mat.opacity = 0.4 + 0.4 * Math.sin(performance.now() * 0.02);
      }
      if (egg.hatchTimer <= 0) {
        // Hatch into enemy
        this.world.scene.remove(egg.mesh);
        this.eggs.splice(i, 1);
        const { group, wingL, wingR } = createBirdMesh(ENEMY_COLORS.hunter);
        group.position.set(egg.x, egg.y, 0);
        this.world.scene.add(group);
        this.enemies.push({
          x: egg.x, y: egg.y, vx: (Math.random() - 0.5) * 3, vy: 4,
          type: 'hunter', facing: 1, flapTimer: 0.5,
          mesh: group, wingL, wingR, alive: true,
        });
        gameState.sfxAction = 'hatch';
        continue;
      }
      egg.mesh.position.set(egg.x, egg.y, 0);
      egg.mesh.rotation.z += dt * 2;
    }
  }

  private updatePtero(dt: number) {
    if (!gameState.pteroActive || !this.pteroMesh) return;
    gameState.pteroX += gameState.pteroVX * dt;
    // Wing animation
    const wingAngle = Math.sin(performance.now() * 0.015) * 0.3;
    if (this.pteroMesh.children[3]) this.pteroMesh.children[3].rotation.x = wingAngle;
    if (this.pteroMesh.children[4]) this.pteroMesh.children[4].rotation.x = -wingAngle;
    this.pteroMesh.position.set(gameState.pteroX, gameState.pteroY, 0);
    // Off screen — remove
    if (Math.abs(gameState.pteroX) > HALF_W + 4) {
      this.world.scene.remove(this.pteroMesh);
      this.pteroMesh = null;
      gameState.pteroActive = false;
    }
  }

  updatePlatformColors(color: number) {
    for (const g of this.platformMeshes) {
      const mesh = g.children[0] as Mesh;
      (mesh.material as MeshBasicMaterial).color.setHex(color);
      const edges = g.children[1] as LineSegments;
      (edges.material as LineBasicMaterial).color.setHex(color);
    }
  }

  updatePlayerColor(color: number) {
    const body = this.playerMesh.children[0] as Mesh;
    (body.material as MeshBasicMaterial).color.setHex(color);
    const edges = this.playerMesh.children[1] as LineSegments;
    (edges.material as LineBasicMaterial).color.setHex(color);
    (this.playerWingL.material as MeshBasicMaterial).color.setHex(color);
    (this.playerWingR.material as MeshBasicMaterial).color.setHex(color);
  }
}
