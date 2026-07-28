// Neon Joust VR — Core game logic
import { createSystem, World, Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry,
  MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, Color,
  OctahedronGeometry, TorusGeometry } from '@iwsdk/core';
import { gameState, EnemyData, EggData, PowerUpData, ScorePopup, FireballData, LavaEruption, PLATFORMS, GRAVITY, FLAP_IMPULSE,
  FLAP_COOLDOWN, MOVE_SPEED, MAX_VY, DRAG, LAVA_Y, ARENA_W, ARENA_H,
  INVINCIBILITY_TIME, POWERUP_DURATION, POWERUP_DROP_CHANCE, MAGNET_RANGE,
  POWERUP_COLORS, PowerUpType } from './game-state.js';

const HALF_W = ARENA_W / 2;
const ENEMY_COLORS: Record<string, number> = { bounder: 0x44ff44, hunter: 0xffff44, shadow: 0xff4444, dragon: 0xff6600 };
const ENEMY_SCORES: Record<string, number> = { bounder: 100, hunter: 200, shadow: 500, dragon: 2000 };
const ENEMY_HP: Record<string, number> = { bounder: 1, hunter: 1, shadow: 2, dragon: 5 };
const EGG_SCORE = 150;
const PTERO_SCORE = 1000;
const HATCH_TIME = 6;
const PTERO_DELAY = 25;
const JOUST_DIST = 1.2;
const EGG_COLLECT_DIST = 1.0;
const PTERO_HIT_DIST = 1.5;
const POWERUP_COLLECT_DIST = 1.0;
const FIREBALL_SPEED = 8;
const FIREBALL_HIT_DIST = 0.8;
const BOSS_WAVE_INTERVAL = 5;
const POWERUP_TYPES: PowerUpType[] = ['shield', 'speed', 'magnet', 'double'];
const LAVA_ERUPTION_INTERVAL = 12;
const LAVA_ERUPTION_SPEED = 14;
const LAVA_ERUPTION_HIT_DIST = 0.8;
const WAVE_QUICK_CLEAR_TIME = 10;

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
  const bodyGeo = new SphereGeometry(0.35, 8, 6);
  bodyGeo.scale(1, 0.8, 0.8);
  const body = new Mesh(bodyGeo, bodyMat);
  group.add(body);
  group.add(new LineSegments(new EdgesGeometry(bodyGeo), edgeMat));
  const headGeo = new SphereGeometry(0.18, 6, 5);
  const head = new Mesh(headGeo, bodyMat);
  head.position.set(0.25, 0.25, 0);
  group.add(head);
  const lanceGeo = new CylinderGeometry(0, 0.06, 0.5, 4);
  const lance = new Mesh(lanceGeo, new MeshBasicMaterial({ color: 0xffffff }));
  lance.rotation.z = -Math.PI / 2;
  lance.position.set(0.55, 0.25, 0);
  group.add(lance);
  const wingGeo = new BoxGeometry(0.4, 0.05, 0.6);
  const wingMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
  const wingL = new Mesh(wingGeo, wingMat);
  wingL.position.set(-0.1, 0.15, 0.35);
  group.add(wingL);
  const wingR = new Mesh(wingGeo, wingMat);
  wingR.position.set(-0.1, 0.15, -0.35);
  group.add(wingR);
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
  const bGeo = new CylinderGeometry(0, 0.1, 0.6, 4);
  const beak = new Mesh(bGeo, new MeshBasicMaterial({ color: 0xffcc00 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.8, 0, 0);
  g.add(beak);
  return g;
}

function createDragonMesh(): { group: Group; wingL: Mesh; wingR: Mesh } {
  const g = new Group();
  const mat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.75 });
  const edgeMat = new LineBasicMaterial({ color: 0xff8800 });
  // Larger body
  const bodyGeo = new SphereGeometry(0.6, 10, 8);
  bodyGeo.scale(1.4, 0.9, 0.9);
  const body = new Mesh(bodyGeo, mat);
  g.add(body);
  g.add(new LineSegments(new EdgesGeometry(bodyGeo), edgeMat));
  // Head
  const headGeo = new SphereGeometry(0.3, 8, 6);
  const head = new Mesh(headGeo, mat);
  head.position.set(0.5, 0.3, 0);
  g.add(head);
  // Horns
  const hornGeo = new CylinderGeometry(0, 0.06, 0.4, 4);
  const hornMat = new MeshBasicMaterial({ color: 0xffcc00 });
  const hornL = new Mesh(hornGeo, hornMat);
  hornL.position.set(0.4, 0.6, 0.15);
  hornL.rotation.z = 0.4;
  g.add(hornL);
  const hornR = new Mesh(hornGeo, hornMat);
  hornR.position.set(0.4, 0.6, -0.15);
  hornR.rotation.z = 0.4;
  g.add(hornR);
  // Tail
  const tailGeo = new CylinderGeometry(0.08, 0.02, 1.2, 6);
  const tail = new Mesh(tailGeo, mat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.9, -0.1, 0);
  g.add(tail);
  // Large wings
  const wingGeo = new BoxGeometry(0.7, 0.06, 1.0);
  const wingMat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.45 });
  const wingL = new Mesh(wingGeo, wingMat);
  wingL.position.set(-0.1, 0.25, 0.55);
  g.add(wingL);
  const wingR = new Mesh(wingGeo, wingMat);
  wingR.position.set(-0.1, 0.25, -0.55);
  g.add(wingR);
  // Legs
  const legGeo = new CylinderGeometry(0.05, 0.05, 0.4, 4);
  const legMat = new MeshBasicMaterial({ color: 0xcc4400 });
  const legL = new Mesh(legGeo, legMat);
  legL.position.set(-0.15, -0.55, 0.2);
  g.add(legL);
  const legR = new Mesh(legGeo, legMat);
  legR.position.set(-0.15, -0.55, -0.2);
  g.add(legR);
  g.scale.set(1.5, 1.5, 1.5);
  return { group: g, wingL, wingR };
}

function createFireballMesh(): Mesh {
  const geo = new SphereGeometry(0.18, 6, 5);
  const mat = new MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85 });
  const mesh = new Mesh(geo, mat);
  // Outer glow
  const glowGeo = new SphereGeometry(0.28, 6, 5);
  const glowMat = new MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.3 });
  mesh.add(new Mesh(glowGeo, glowMat));
  return mesh;
}

function createPowerUpMesh(type: PowerUpType): Group {
  const g = new Group();
  const color = POWERUP_COLORS[type];
  const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
  const edgeMat = new LineBasicMaterial({ color, linewidth: 1 });

  if (type === 'shield') {
    const geo = new OctahedronGeometry(0.25, 0);
    g.add(new Mesh(geo, mat));
    g.add(new LineSegments(new EdgesGeometry(geo), edgeMat));
  } else if (type === 'speed') {
    const geo = new CylinderGeometry(0, 0.2, 0.45, 3);
    const m = new Mesh(geo, mat);
    m.rotation.z = Math.PI / 2;
    g.add(m);
    g.add(new LineSegments(new EdgesGeometry(geo), edgeMat));
  } else if (type === 'magnet') {
    const geo = new TorusGeometry(0.18, 0.06, 6, 8);
    g.add(new Mesh(geo, mat));
    g.add(new LineSegments(new EdgesGeometry(geo), edgeMat));
  } else {
    // double score — star-like shape using two boxes
    const geo1 = new BoxGeometry(0.35, 0.12, 0.12);
    const geo2 = new BoxGeometry(0.12, 0.35, 0.12);
    g.add(new Mesh(geo1, mat));
    g.add(new LineSegments(new EdgesGeometry(geo1), edgeMat));
    g.add(new Mesh(geo2, mat));
    g.add(new LineSegments(new EdgesGeometry(geo2), edgeMat));
  }

  // Outer glow ring
  const ringGeo = new TorusGeometry(0.35, 0.02, 6, 16);
  const ringMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
  g.add(new Mesh(ringGeo, ringMat));

  return g;
}

function createShieldVisual(color: number): Mesh {
  const geo = new SphereGeometry(0.6, 12, 8);
  const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.15 });
  const mesh = new Mesh(geo, mat);
  const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color, transparent: true, opacity: 0.4 }));
  mesh.add(edges);
  return mesh;
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
  private shieldMesh: Mesh | null = null;
  private enemies: EnemyData[] = [];
  private eggs: EggData[] = [];
  private powerUps: PowerUpData[] = [];
  private scorePopups: ScorePopup[] = [];
  private fireballs: FireballData[] = [];
  private lavaEruptions: LavaEruption[] = [];
  private pteroMesh: Group | null = null;
  private platformMeshes: Group[] = [];
  private lavaMesh: Mesh | null = null;
  private wallMeshes: Mesh[] = [];
  private inputState = { left: false, right: false, flap: false, flapPressed: false };
  private prevColorScheme = 0;
  private cameraBasePos = { x: 0, y: 6.5, z: 18 };

  init() {
    gameState.loadStats();
    this.buildArenaWalls();
    this.buildPlatforms();
    this.buildLava();
    this.buildPlayer();
    this.prevColorScheme = gameState.colorScheme;
  }

  private buildArenaWalls() {
    const scene = this.world.scene;
    const ac = gameState.accentColor;
    // Left wall
    const wallGeo = new BoxGeometry(0.1, ARENA_H + 2, 4);
    const wallMat = new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.04 });
    const edgeMat = new LineBasicMaterial({ color: ac, transparent: true, opacity: 0.15 });
    const leftWall = new Mesh(wallGeo, wallMat);
    leftWall.position.set(-HALF_W - 0.5, ARENA_H / 2, 0);
    leftWall.add(new LineSegments(new EdgesGeometry(wallGeo), edgeMat));
    scene.add(leftWall);
    this.wallMeshes.push(leftWall);
    // Right wall
    const rightWall = new Mesh(wallGeo, wallMat.clone());
    rightWall.position.set(HALF_W + 0.5, ARENA_H / 2, 0);
    rightWall.add(new LineSegments(new EdgesGeometry(wallGeo), edgeMat.clone()));
    scene.add(rightWall);
    this.wallMeshes.push(rightWall);
    // Grid lines on walls
    for (let i = 0; i < 6; i++) {
      const lineGeo = new BoxGeometry(0.02, ARENA_H + 2, 0.02);
      const lineMat = new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.1 });
      const ll = new Mesh(lineGeo, lineMat);
      ll.position.set(-HALF_W - 0.5, ARENA_H / 2, -1.5 + i * 0.6);
      scene.add(ll);
      const rl = new Mesh(lineGeo, lineMat.clone());
      rl.position.set(HALF_W + 0.5, ARENA_H / 2, -1.5 + i * 0.6);
      scene.add(rl);
    }
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
    gameState.waveTransition = false;
    gameState.waveTransitionTimer = 0;
    gameState.speedTimer = 120;
    gameState.playerAlive = true;
    gameState.respawnTimer = 0;
    gameState.invincibleTimer = INVINCIBILITY_TIME;
    gameState.activePowerUp = null;
    gameState.powerUpTimer = 0;
    gameState.shieldActive = false;
    gameState.lavaEruptionTimer = LAVA_ERUPTION_INTERVAL;
    gameState.lavaEruptionsDodged = 0;
    gameState.powerUpsThisGame = 0;
    gameState.waveStartTime = 0;
    gameState.waveBonusAwarded = false;
    gameState.killStreak = 0;
    gameState.bestKillStreak = 0;
    gameState.killStreakBonus = 0;
    gameState.windForce = 0;
    gameState.windTimer = 5 + Math.random() * 10;
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
    this.removeShieldVisual();
  }

  private clearEntities() {
    for (const e of this.enemies) this.world.scene.remove(e.mesh);
    for (const e of this.eggs) this.world.scene.remove(e.mesh);
    for (const p of this.powerUps) this.world.scene.remove(p.mesh);
    for (const s of this.scorePopups) this.world.scene.remove(s.mesh);
    for (const f of this.fireballs) this.world.scene.remove(f.mesh);
    for (const l of this.lavaEruptions) this.world.scene.remove(l.mesh);
    this.enemies = [];
    this.eggs = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.fireballs = [];
    this.lavaEruptions = [];
    if (this.pteroMesh) { this.world.scene.remove(this.pteroMesh); this.pteroMesh = null; }
    gameState.pteroActive = false;
    gameState.bossWave = false;
  }

  private spawnWave() {
    gameState.waveStarting = true;
    gameState.waveClearTimer = 0;
    gameState.waveTimer = 0;
    gameState.noDeathThisWave = true;
    gameState.waveStartTime = gameState.gameTime;
    gameState.waveBonusAwarded = false;
    // Boss wave every BOSS_WAVE_INTERVAL waves
    if (gameState.wave > 1 && gameState.wave % BOSS_WAVE_INTERVAL === 0) {
      gameState.bossWave = true;
      this.spawnDragon();
      // Spawn fewer regular enemies alongside
      const escorts = Math.floor(gameState.wave / 5);
      for (let i = 0; i < Math.min(escorts, 4); i++) {
        this.spawnEnemy(i < escorts / 2 ? 'shadow' : 'hunter');
      }
    } else {
      gameState.bossWave = false;
      const spec = waveEnemies(gameState.wave);
      for (const s of spec) {
        for (let i = 0; i < s.count; i++) {
          this.spawnEnemy(s.type as any);
        }
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
      hp: ENEMY_HP[type] ?? 1, maxHp: ENEMY_HP[type] ?? 1,
      hitFlashTimer: 0, fireTimer: 0,
    });
  }

  private spawnEgg(x: number, y: number, sourceType?: string) {
    const mesh = createEggMesh();
    mesh.position.set(x, y, 0);
    this.world.scene.add(mesh);
    this.eggs.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: 1, hatchTimer: HATCH_TIME, mesh, onGround: false,
      sourceType: (sourceType ?? 'bounder') as any });
  }

  private spawnPowerUp(x: number, y: number) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const mesh = createPowerUpMesh(type);
    mesh.position.set(x, y, 0);
    this.world.scene.add(mesh);
    this.powerUps.push({ x, y, vy: 2, type, mesh, age: 0 });
  }

  private spawnScorePopup(x: number, y: number, points: number, label?: string) {
    const text = label ?? `+${points}`;
    // Create a small visual marker (sphere with color indicating score tier)
    const color = points >= 500 ? 0xffcc00 : points >= 200 ? 0x44ff88 : 0x00ffff;
    const geo = new SphereGeometry(0.08, 4, 3);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y + 0.5, 0);
    this.world.scene.add(mesh);
    this.scorePopups.push({ x, y: y + 0.5, text, life: 1.2, mesh });
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

  private spawnDragon() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (HALF_W + 0.5);
    const y = 8 + Math.random() * 3;
    const { group, wingL, wingR } = createDragonMesh();
    group.position.set(x, y, 0);
    group.scale.x = -side;
    this.world.scene.add(group);
    const hp = ENEMY_HP.dragon + Math.floor(gameState.wave / 10);
    this.enemies.push({
      x, y, vx: -side * 2, vy: 0,
      type: 'dragon', facing: -side, flapTimer: 1.0,
      mesh: group, wingL, wingR, alive: true,
      hp, maxHp: hp, hitFlashTimer: 0,
      fireTimer: 2.5 + Math.random(),
    });
  }

  private spawnFireball(x: number, y: number, facing: number) {
    const mesh = createFireballMesh();
    mesh.position.set(x + facing * 0.8, y, 0);
    this.world.scene.add(mesh);
    const dx = gameState.playerX - x;
    const dy = gameState.playerY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dist > 0.1 ? dx / dist : facing;
    const ny = dist > 0.1 ? dy / dist : 0;
    this.fireballs.push({
      x: x + facing * 0.8, y,
      vx: nx * FIREBALL_SPEED, vy: ny * FIREBALL_SPEED,
      mesh, life: 3.0,
    });
    gameState.sfxAction = 'fireball';
  }

  private addShieldVisual() {
    if (this.shieldMesh) return;
    this.shieldMesh = createShieldVisual(POWERUP_COLORS.shield);
    this.playerMesh.add(this.shieldMesh);
  }

  private removeShieldVisual() {
    if (this.shieldMesh) {
      this.playerMesh.remove(this.shieldMesh);
      this.shieldMesh = null;
    }
  }

  update(delta: number, _time: number) {
    if (gameState.screen !== 'playing') return;
    const dt = Math.min(delta, 0.05);
    gameState.gameTime += dt;
    gameState.totalPlayTime += dt;

    // Color scheme changes
    if (gameState.colorScheme !== this.prevColorScheme) {
      gameState.colorChanged = true;
      this.updateAllColors();
      this.prevColorScheme = gameState.colorScheme;
    }

    // Combo timer
    if (gameState.comboTimer > 0) {
      gameState.comboTimer -= dt;
      if (gameState.comboTimer <= 0) { gameState.combo = 0; gameState.comboTimer = 0; }
    }

    // Invincibility timer
    if (gameState.invincibleTimer > 0) {
      gameState.invincibleTimer -= dt;
      // Blink player during invincibility
      this.playerMesh.visible = Math.floor(_time * 10) % 2 === 0;
      if (gameState.invincibleTimer <= 0) {
        gameState.invincibleTimer = 0;
        this.playerMesh.visible = true;
      }
    }

    // Power-up timer
    if (gameState.activePowerUp && gameState.powerUpTimer > 0) {
      gameState.powerUpTimer -= dt;
      if (gameState.powerUpTimer <= 0) {
        this.deactivatePowerUp();
      }
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

    // Wave transition
    if (gameState.waveTransition) {
      gameState.waveTransitionTimer -= dt;
      if (gameState.waveTransitionTimer <= 0) {
        gameState.waveTransition = false;
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
          gameState.invincibleTimer = INVINCIBILITY_TIME;
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
    // Power-ups
    this.updatePowerUps(dt);
    // Score popups
    this.updateScorePopups(dt);
    // Pterodactyl
    this.updatePtero(dt);
    // Fireballs
    this.updateFireballs(dt);
    // Lava eruptions
    this.updateLavaEruptions(dt, _time);

    // Wave check
    if (!gameState.waveStarting && this.enemies.length === 0 && this.eggs.length === 0) {
      gameState.waveClearTimer += dt;
      if (gameState.waveClearTimer >= 1.0) {
        // Wave clear bonus
        if (!gameState.waveBonusAwarded) {
          gameState.waveBonusAwarded = true;
          const waveDuration = gameState.gameTime - gameState.waveStartTime;
          let bonus = 200 * gameState.wave; // Base wave bonus
          if (gameState.noDeathThisWave) {
            bonus += 500; // No-death bonus
          }
          if (waveDuration < WAVE_QUICK_CLEAR_TIME) {
            bonus += 1000; // Quick clear bonus
            if (!gameState.achievements['quick_clear']) {
              gameState.achievements['quick_clear'] = true;
              gameState.sfxAction = 'achievement';
              gameState.saveStats();
            }
          }
          this.addScore(bonus);
          this.spawnScorePopup(gameState.playerX, gameState.playerY + 1.5, bonus, `WAVE BONUS`);
          gameState.waveBonus = bonus;
        }
        if (gameState.noDeathThisWave) gameState.noDeathStreak++;
        gameState.totalWavesAll++;
        gameState.wave++;
        if (gameState.wave > gameState.bestWave) gameState.bestWave = gameState.wave;
        gameState.sfxAction = 'levelup';
        gameState.waveTransition = true;
        gameState.waveTransitionTimer = 2.0;
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

    // Wind gusts — push player and enemies periodically at higher waves
    if (gameState.wave >= 4) {
      gameState.windTimer -= dt;
      if (gameState.windTimer <= 0) {
        gameState.windForce = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2);
        gameState.windTimer = 6 + Math.random() * 8;
        gameState.sfxAction = 'wind';
      }
      if (gameState.windForce !== 0) {
        // Apply wind to player
        if (gameState.playerAlive && !gameState.playerOnGround) {
          gameState.playerVX += gameState.windForce * dt * 2;
        }
        // Apply wind to enemies
        for (const e of this.enemies) {
          if (e.alive) e.vx += gameState.windForce * dt * 1.5;
        }
        // Decay wind
        gameState.windForce *= (1 - dt * 1.5);
        if (Math.abs(gameState.windForce) < 0.1) gameState.windForce = 0;
      }
    }

    // Camera shake
    if (gameState.cameraShake > 0) {
      gameState.cameraShake -= dt;
      const intensity = gameState.cameraShake * 3;
      const sx = (Math.random() - 0.5) * intensity;
      const sy = (Math.random() - 0.5) * intensity;
      this.world.camera.position.set(
        this.cameraBasePos.x + sx,
        this.cameraBasePos.y + sy,
        this.cameraBasePos.z,
      );
      if (gameState.cameraShake <= 0) {
        gameState.cameraShake = 0;
        this.world.camera.position.set(
          this.cameraBasePos.x, this.cameraBasePos.y, this.cameraBasePos.z,
        );
      }
    }

    // Shield visual animation
    if (this.shieldMesh) {
      this.shieldMesh.rotation.y += dt * 2;
      (this.shieldMesh.material as MeshBasicMaterial).opacity = 0.1 + 0.08 * Math.sin(_time * 4);
    }

    // Wing flap animation
    const flapAngle = Math.sin(_time * 12) * 0.4;
    if (gameState.playerAlive && this.playerMesh.visible) {
      this.playerWingL.rotation.x = gameState.playerOnGround ? 0 : flapAngle;
      this.playerWingR.rotation.x = gameState.playerOnGround ? 0 : -flapAngle;
    }

    gameState.checkAchievements();
  }

  private updatePlayer(dt: number) {
    const gs = gameState;
    const speedMul = gs.activePowerUp === 'speed' ? 1.5 : 1.0;
    // Input
    if (this.inputState.left) { gs.playerVX -= MOVE_SPEED * dt * 5 * speedMul; gs.playerFacing = -1; }
    if (this.inputState.right) { gs.playerVX += MOVE_SPEED * dt * 5 * speedMul; gs.playerFacing = 1; }
    // Flap
    gs.playerFlapCooldown -= dt;
    if (this.inputState.flapPressed && gs.playerFlapCooldown <= 0) {
      gs.playerVY = Math.min(gs.playerVY + FLAP_IMPULSE * speedMul, MAX_VY * speedMul);
      gs.playerFlapCooldown = FLAP_COOLDOWN;
      gs.playerOnGround = false;
      gs.sfxAction = 'flap';
    }
    // Physics
    if (!gs.playerOnGround) gs.playerVY += GRAVITY * dt;
    gs.playerVX *= DRAG;
    const maxSpd = MOVE_SPEED * speedMul;
    gs.playerVX = Math.max(-maxSpd, Math.min(maxSpd, gs.playerVX));
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
      // Reset kill streak on landing
      if (gs.killStreak > 0) {
        if (gs.killStreak >= 3) {
          // Award streak bonus
          const streakBonus = gs.killStreak * 150;
          this.addScore(streakBonus);
          gs.killStreakBonus = streakBonus;
          this.spawnScorePopup(gs.playerX, gs.playerY + 1, streakBonus, `${gs.killStreak}x STREAK`);
          gs.sfxAction = 'wave_bonus';
        }
        gs.killStreak = 0;
      }
    } else {
      gs.playerOnGround = false;
    }
    // Lava death
    if (gs.playerY < LAVA_Y) {
      if (gs.shieldActive) {
        gs.playerVY = 8;
        gs.playerY = LAVA_Y + 0.5;
        this.deactivatePowerUp();
        gs.sfxAction = 'shield_break';
      } else if (!gs.isInvincible) {
        this.playerDeath();
        return;
      } else {
        gs.playerVY = 5;
        gs.playerY = LAVA_Y + 0.5;
      }
    }
    // Update mesh
    this.playerMesh.position.set(gs.playerX, gs.playerY, 0);
    this.playerMesh.scale.x = gs.playerFacing;

    // Magnet — attract eggs
    if (gs.activePowerUp === 'magnet') {
      for (const egg of this.eggs) {
        const dx = gs.playerX - egg.x;
        const dy = gs.playerY - egg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAGNET_RANGE && dist > 0.1) {
          const pull = 6 / dist;
          egg.vx += (dx / dist) * pull * dt * 20;
          egg.vy += (dy / dist) * pull * dt * 20;
        }
      }
    }

    // Joust collision with enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const dx = gs.playerX - e.x;
      const dy = gs.playerY - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < JOUST_DIST) {
        if (gs.playerY > e.y + 0.15 || gs.shieldActive) {
          this.defeatEnemy(i);
        } else if (e.y > gs.playerY + 0.15) {
          if (gs.isInvincible) {
            // Bounce away during invincibility
            gs.playerVX = dx > 0 ? 4 : -4;
            gs.playerVY = 3;
          } else {
            this.playerDeath();
            return;
          }
        } else {
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

    // Power-up collection
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      const dx = gs.playerX - pu.x;
      const dy = gs.playerY - pu.y;
      if (Math.sqrt(dx * dx + dy * dy) < POWERUP_COLLECT_DIST) {
        this.collectPowerUp(i);
      }
    }

    // Ptero collision
    if (gs.pteroActive && this.pteroMesh) {
      const dx = gs.playerX - gs.pteroX;
      const dy = gs.playerY - gs.pteroY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PTERO_HIT_DIST) {
        if (gs.playerY > gs.pteroY + 0.3 || gs.shieldActive) {
          this.addScore(PTERO_SCORE);
          this.spawnScorePopup(gs.pteroX, gs.pteroY, PTERO_SCORE);
          gs.totalPterosAll++;
          gs.sfxAction = 'joust_win';
          this.world.scene.remove(this.pteroMesh);
          this.pteroMesh = null;
          gs.pteroActive = false;
          gs.checkAchievements();
          gs.saveStats();
        } else if (!gs.isInvincible) {
          this.playerDeath();
        } else {
          gs.playerVX = dx > 0 ? 5 : -5;
          gs.playerVY = 4;
        }
      }
    }
  }

  private defeatEnemy(idx: number) {
    const e = this.enemies[idx];
    e.hp--;
    if (e.hp > 0) {
      // Hit but not killed — bounce and flash
      e.hitFlashTimer = 0.3;
      e.vy = 4;
      e.vx = (gameState.playerX > e.x ? -3 : 3);
      gameState.sfxAction = 'joust_win';
      gameState.cameraShake = 0.15;
      // Score for hit
      const hitScore = 50 * (e.type === 'dragon' ? 2 : 1);
      this.addScore(hitScore);
      this.spawnScorePopup(e.x, e.y, hitScore, 'HIT!');
      return;
    }
    // Fully defeated
    e.alive = false;
    this.world.scene.remove(e.mesh);
    this.spawnEgg(e.x, e.y, e.type === 'dragon' ? 'shadow' : e.type);
    // Power-up drop chance (higher for bosses)
    const dropChance = e.type === 'dragon' ? 1.0 : POWERUP_DROP_CHANCE;
    if (Math.random() < dropChance) {
      this.spawnPowerUp(e.x, e.y + 0.5);
      if (e.type === 'dragon') {
        // Boss drops extra power-up
        this.spawnPowerUp(e.x + 1, e.y + 1);
      }
    }
    this.enemies.splice(idx, 1);
    gameState.combo++;
    gameState.killStreak++;
    if (gameState.killStreak > gameState.bestKillStreak) gameState.bestKillStreak = gameState.killStreak;
    if (gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;
    if (gameState.combo > gameState.bestCombo) gameState.bestCombo = gameState.combo;
    gameState.comboTimer = 3;
    const scoreMul = gameState.activePowerUp === 'double' ? 2 : 1;
    const points = (ENEMY_SCORES[e.type] ?? 100) * Math.max(1, gameState.combo) * scoreMul;
    this.addScore(points);
    this.spawnScorePopup(e.x, e.y, points);
    gameState.killsThisGame++;
    gameState.totalKillsAll++;
    if (e.type === 'dragon') {
      gameState.bossDefeated++;
      gameState.cameraShake = 0.5;
      gameState.sfxAction = 'boss_defeat';
    } else {
      gameState.sfxAction = 'joust_win';
    }
    gameState.checkAchievements();
    gameState.saveStats();
  }

  private collectEgg(idx: number) {
    const egg = this.eggs[idx];
    this.world.scene.remove(egg.mesh);
    this.eggs.splice(idx, 1);
    const scoreMul = gameState.activePowerUp === 'double' ? 2 : 1;
    const points = EGG_SCORE * scoreMul;
    this.addScore(points);
    this.spawnScorePopup(egg.x, egg.y, points);
    gameState.eggsThisGame++;
    gameState.totalEggsAll++;
    gameState.sfxAction = 'egg_collect';
    gameState.checkAchievements();
    gameState.saveStats();
  }

  private collectPowerUp(idx: number) {
    const pu = this.powerUps[idx];
    this.world.scene.remove(pu.mesh);
    this.powerUps.splice(idx, 1);
    this.activatePowerUp(pu.type);
    gameState.totalPowerUps++;
    gameState.powerUpsThisGame++;
    gameState.sfxAction = 'powerup';
    gameState.checkAchievements();
    gameState.saveStats();
  }

  private activatePowerUp(type: PowerUpType) {
    // Deactivate previous
    if (gameState.activePowerUp) {
      this.deactivatePowerUp();
    }
    gameState.activePowerUp = type;
    gameState.powerUpTimer = POWERUP_DURATION;
    if (type === 'shield') {
      gameState.shieldActive = true;
      this.addShieldVisual();
    }
  }

  private deactivatePowerUp() {
    if (gameState.activePowerUp === 'shield') {
      gameState.shieldActive = false;
      this.removeShieldVisual();
    }
    gameState.activePowerUp = null;
    gameState.powerUpTimer = 0;
  }

  private playerDeath() {
    gameState.playerAlive = false;
    gameState.lives--;
    gameState.noDeathThisWave = false;
    gameState.noDeathStreak = 0;
    gameState.combo = 0;
    gameState.respawnTimer = 2;
    gameState.sfxAction = 'death';
    gameState.cameraShake = 0.3;
    this.playerMesh.visible = false;
    this.deactivatePowerUp();
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
      // Hit flash
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        const body = e.mesh.children[0] as Mesh;
        if (body) {
          (body.material as MeshBasicMaterial).opacity = Math.floor(e.hitFlashTimer * 20) % 2 === 0 ? 0.9 : 0.2;
        }
        if (e.hitFlashTimer <= 0) {
          const body2 = e.mesh.children[0] as Mesh;
          if (body2) (body2.material as MeshBasicMaterial).opacity = 0.7;
        }
      }
      e.flapTimer -= dt;
      if (e.flapTimer <= 0) {
        const flapRate = e.type === 'shadow' ? 0.4 : e.type === 'dragon' ? 0.5 : e.type === 'hunter' ? 0.7 : 1.0;
        e.flapTimer = flapRate + Math.random() * flapRate;
        e.vy = Math.min(e.vy + FLAP_IMPULSE * 0.8, MAX_VY * 0.8);
      }
      if (e.type === 'hunter' || e.type === 'shadow' || e.type === 'dragon') {
        const spd = e.type === 'dragon' ? 3 : e.type === 'shadow' ? 4 : 2.5;
        const tx = gameState.playerAlive ? gameState.playerX : 0;
        if (tx > e.x + 0.5) e.vx += spd * dt * diffMul();
        else if (tx < e.x - 0.5) e.vx -= spd * dt * diffMul();
        // Dragon breathes fire
        if (e.type === 'dragon' && gameState.playerAlive) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.fireTimer = 2.0 + Math.random() * 1.5;
            this.spawnFireball(e.x, e.y, e.facing);
          }
          // Dragon swooping charge at higher waves
          if (gameState.wave >= 10) {
            const dxToPlayer = gameState.playerX - e.x;
            const dyToPlayer = gameState.playerY - e.y;
            const distToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
            // Swoop if above player and within horizontal range
            if (e.y > gameState.playerY + 2 && distToPlayer < 8 && Math.abs(dxToPlayer) < 5) {
              e.vy -= 15 * dt; // Dive toward player
              e.vx += (dxToPlayer > 0 ? 1 : -1) * 8 * dt; // Track horizontally
            }
          }
        }
      } else {
        if (Math.random() < 0.02) e.vx += (Math.random() - 0.5) * 3;
      }
      e.vy += GRAVITY * dt;
      e.vx *= DRAG;
      const maxSpd = e.type === 'dragon' ? MOVE_SPEED * 0.7 : MOVE_SPEED;
      e.vx = Math.max(-maxSpd, Math.min(maxSpd, e.vx));
      e.vy = Math.max(-MAX_VY, Math.min(MAX_VY * 0.8, e.vy));
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = wrapX(e.x);
      if (e.y > ARENA_H - 0.5) { e.y = ARENA_H - 0.5; e.vy = -1; }
      const land = landOnPlatform(e.x, e.y, e.vy, 0.4);
      if (land.landed) { e.y = land.py; e.vy = 0; }
      if (e.y < LAVA_Y + 0.3) { e.y = LAVA_Y + 0.3; e.vy = 5; }
      e.facing = e.vx >= 0 ? 1 : -1;
      e.mesh.position.set(e.x, e.y, 0);
      e.mesh.scale.x = e.facing * (e.type === 'dragon' ? 1.5 : 1);
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
      const land = landOnPlatform(egg.x, egg.y, egg.vy, 0.2);
      if (land.landed) {
        egg.y = land.py;
        egg.vy = Math.abs(egg.vy) > 1 ? -egg.vy * 0.3 : 0;
        egg.onGround = true;
      }
      if (egg.y < LAVA_Y) {
        this.world.scene.remove(egg.mesh);
        this.eggs.splice(i, 1);
        continue;
      }
      egg.hatchTimer -= dt;
      const mat = egg.mesh.material as MeshBasicMaterial;
      if (egg.hatchTimer < 2) {
        mat.opacity = 0.4 + 0.4 * Math.sin(performance.now() * 0.02);
      }
      if (egg.hatchTimer <= 0) {
        this.world.scene.remove(egg.mesh);
        this.eggs.splice(i, 1);
        const hatchType = egg.sourceType === 'dragon' ? 'shadow' : egg.sourceType;
        const { group, wingL, wingR } = createBirdMesh(ENEMY_COLORS[hatchType] ?? 0x44ff44);
        group.position.set(egg.x, egg.y, 0);
        this.world.scene.add(group);
        this.enemies.push({
          x: egg.x, y: egg.y, vx: (Math.random() - 0.5) * 3, vy: 4,
          type: hatchType, facing: 1, flapTimer: 0.5,
          mesh: group, wingL, wingR, alive: true,
          hp: ENEMY_HP[hatchType] ?? 1, maxHp: ENEMY_HP[hatchType] ?? 1,
          hitFlashTimer: 0, fireTimer: 0,
        });
        gameState.sfxAction = 'hatch';
        continue;
      }
      egg.mesh.position.set(egg.x, egg.y, 0);
      egg.mesh.rotation.z += dt * 2;
    }
  }

  private updatePowerUps(dt: number) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.age += dt;
      // Float down initially, then hover
      if (pu.vy > 0) {
        pu.vy -= 3 * dt;
        if (pu.vy < 0) pu.vy = 0;
      }
      pu.y += pu.vy * dt;
      // Gravity if not hovering
      if (pu.age > 1 && pu.vy === 0) {
        pu.vy = -0.5;
      }
      if (pu.vy < 0) {
        const land = landOnPlatform(pu.x, pu.y, pu.vy, 0.2);
        if (land.landed) {
          pu.y = land.py + 0.3;
          pu.vy = 0;
        }
      }
      // Remove if fallen to lava
      if (pu.y < LAVA_Y) {
        this.world.scene.remove(pu.mesh);
        this.powerUps.splice(i, 1);
        continue;
      }
      // Expire after 15 seconds
      if (pu.age > 15) {
        this.world.scene.remove(pu.mesh);
        this.powerUps.splice(i, 1);
        continue;
      }
      // Spin and bob animation
      pu.mesh.rotation.y += dt * 3;
      pu.mesh.position.set(pu.x, pu.y + Math.sin(pu.age * 3) * 0.15, 0);
      // Blink when expiring soon
      if (pu.age > 12) {
        pu.mesh.visible = Math.floor(pu.age * 6) % 2 === 0;
      }
    }
  }

  private updateScorePopups(dt: number) {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      sp.life -= dt;
      sp.y += dt * 2;
      if (sp.life <= 0) {
        this.world.scene.remove(sp.mesh);
        this.scorePopups.splice(i, 1);
        continue;
      }
      sp.mesh.position.y = sp.y;
      const mat = sp.mesh.material as MeshBasicMaterial;
      mat.opacity = sp.life / 1.2;
      sp.mesh.scale.setScalar(0.5 + sp.life * 0.5);
    }
  }

  private updatePtero(dt: number) {
    if (!gameState.pteroActive || !this.pteroMesh) return;
    gameState.pteroX += gameState.pteroVX * dt;
    const wingAngle = Math.sin(performance.now() * 0.015) * 0.3;
    if (this.pteroMesh.children[3]) this.pteroMesh.children[3].rotation.x = wingAngle;
    if (this.pteroMesh.children[4]) this.pteroMesh.children[4].rotation.x = -wingAngle;
    this.pteroMesh.position.set(gameState.pteroX, gameState.pteroY, 0);
    if (Math.abs(gameState.pteroX) > HALF_W + 4) {
      this.world.scene.remove(this.pteroMesh);
      this.pteroMesh = null;
      gameState.pteroActive = false;
    }
  }

  private updateFireballs(dt: number) {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.mesh.position.set(f.x, f.y, 0);
      f.mesh.rotation.z += dt * 8;
      // Scale pulsing
      const scale = 0.9 + Math.sin(f.life * 15) * 0.15;
      f.mesh.scale.setScalar(scale);
      // Remove if expired or out of bounds
      if (f.life <= 0 || Math.abs(f.x) > HALF_W + 3 || f.y < -1 || f.y > ARENA_H + 2) {
        this.world.scene.remove(f.mesh);
        this.fireballs.splice(i, 1);
        continue;
      }
      // Hit player
      if (gameState.playerAlive && !gameState.isInvincible) {
        const dx = gameState.playerX - f.x;
        const dy = gameState.playerY - f.y;
        if (Math.sqrt(dx * dx + dy * dy) < FIREBALL_HIT_DIST) {
          if (gameState.shieldActive) {
            this.deactivatePowerUp();
            gameState.sfxAction = 'shield_break';
            gameState.playerVY = 4;
          } else {
            this.playerDeath();
          }
          this.world.scene.remove(f.mesh);
          this.fireballs.splice(i, 1);
          gameState.cameraShake = 0.2;
        }
      }
    }
  }

  private spawnLavaEruption() {
    const x = (Math.random() - 0.5) * (ARENA_W - 2);
    const geo = new CylinderGeometry(0.15, 0.3, 0.6, 6);
    const mat = new MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, LAVA_Y, 0);
    this.world.scene.add(mesh);
    // Add glow particles around base
    const glowGeo = new SphereGeometry(0.2, 6, 4);
    const glowMat = new MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.5 });
    const glow = new Mesh(glowGeo, glowMat);
    mesh.add(glow);
    this.lavaEruptions.push({ x, y: LAVA_Y, vy: LAVA_ERUPTION_SPEED, mesh, life: 2.5, rising: true });
    gameState.sfxAction = 'fireball';
  }

  private updateLavaEruptions(dt: number, time: number) {
    // Eruption timer — starts at wave 3+
    if (gameState.wave >= 3 && gameState.playerAlive) {
      gameState.lavaEruptionTimer -= dt;
      const interval = Math.max(4, LAVA_ERUPTION_INTERVAL - gameState.wave * 0.5);
      if (gameState.lavaEruptionTimer <= 0) {
        gameState.lavaEruptionTimer = interval;
        this.spawnLavaEruption();
        // Multiple eruptions at higher waves
        if (gameState.wave >= 8) {
          setTimeout(() => this.spawnLavaEruption(), 300);
        }
        if (gameState.wave >= 15) {
          setTimeout(() => this.spawnLavaEruption(), 600);
        }
      }
    }

    for (let i = this.lavaEruptions.length - 1; i >= 0; i--) {
      const e = this.lavaEruptions[i];
      e.life -= dt;
      if (e.rising) {
        e.y += e.vy * dt;
        e.vy -= 18 * dt; // Gravity pulls it back
        if (e.vy <= 0) e.rising = false;
      } else {
        e.vy -= 12 * dt;
        e.y += e.vy * dt;
      }
      e.mesh.position.set(e.x, e.y, 0);
      e.mesh.rotation.y += dt * 6;
      // Fade as it falls
      const mat = e.mesh.material as MeshBasicMaterial;
      mat.opacity = Math.max(0.1, e.life / 2.5 * 0.85);
      // Scale pulsing
      const s = 0.8 + Math.sin(time * 12) * 0.2;
      e.mesh.scale.set(s, 1, s);

      // Remove if expired or below lava
      if (e.life <= 0 || e.y < LAVA_Y - 0.5) {
        this.world.scene.remove(e.mesh);
        this.lavaEruptions.splice(i, 1);
        continue;
      }

      // Hit player
      if (gameState.playerAlive) {
        const dx = gameState.playerX - e.x;
        const dy = gameState.playerY - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LAVA_ERUPTION_HIT_DIST) {
          if (gameState.isInvincible || gameState.shieldActive) {
            // Dodged / blocked
            gameState.lavaEruptionsDodged++;
            gameState.playerVY = 5;
            gameState.playerVX = dx > 0 ? 3 : -3;
            if (gameState.shieldActive) {
              this.deactivatePowerUp();
              gameState.sfxAction = 'shield_break';
            }
            this.world.scene.remove(e.mesh);
            this.lavaEruptions.splice(i, 1);
            gameState.cameraShake = 0.15;
            gameState.checkAchievements();
          } else {
            this.playerDeath();
            this.world.scene.remove(e.mesh);
            this.lavaEruptions.splice(i, 1);
            gameState.cameraShake = 0.3;
          }
          continue;
        }
        // Count as dodged if it passes close but misses
        if (dist < LAVA_ERUPTION_HIT_DIST * 2.5 && !e.rising && e.vy < -3) {
          gameState.lavaEruptionsDodged++;
          gameState.checkAchievements();
        }
      }
    }
  }

  private updateAllColors() {
    const color = gameState.accentColor;
    // Platforms
    for (const g of this.platformMeshes) {
      const mesh = g.children[0] as Mesh;
      (mesh.material as MeshBasicMaterial).color.setHex(color);
      const edges = g.children[1] as LineSegments;
      (edges.material as LineBasicMaterial).color.setHex(color);
    }
    // Player
    const body = this.playerMesh.children[0] as Mesh;
    (body.material as MeshBasicMaterial).color.setHex(color);
    const edges = this.playerMesh.children[1] as LineSegments;
    (edges.material as LineBasicMaterial).color.setHex(color);
    (this.playerWingL.material as MeshBasicMaterial).color.setHex(color);
    (this.playerWingR.material as MeshBasicMaterial).color.setHex(color);
    // Walls
    for (const w of this.wallMeshes) {
      (w.material as MeshBasicMaterial).color.setHex(color);
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
