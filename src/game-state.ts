// Neon Joust VR — Shared game state
export type GameMode = 'arcade' | 'speed' | 'zen' | 'challenge';
export type Difficulty = 'normal' | 'hard' | 'insane';
export type EnemyType = 'bounder' | 'hunter' | 'shadow';
export type PowerUpType = 'shield' | 'speed' | 'magnet' | 'double';

export const COLOR_SCHEMES = [0x00ffff, 0x44ff88, 0xff44aa, 0xffcc00];
export const COLOR_NAMES = ['CYAN', 'GREEN', 'MAGENTA', 'GOLD'];

export const ARENA_W = 20;
export const ARENA_H = 14;
export const GRAVITY = -12;
export const FLAP_IMPULSE = 6.5;
export const FLAP_COOLDOWN = 0.12;
export const MOVE_SPEED = 6;
export const MAX_VY = 10;
export const DRAG = 0.97;
export const LAVA_Y = 0.5;

export const INVINCIBILITY_TIME = 2.5;
export const POWERUP_DURATION = 8;
export const POWERUP_DROP_CHANCE = 0.2;
export const MAGNET_RANGE = 4;

export interface PlatformDef { x: number; y: number; w: number; }
export const PLATFORMS: PlatformDef[] = [
  { x: -5.5, y: 3, w: 5 },
  { x: 5.5, y: 3, w: 5 },
  { x: 0, y: 6.5, w: 6 },
  { x: -4.5, y: 9.5, w: 5 },
  { x: 4.5, y: 9.5, w: 5 },
];

export interface EnemyData {
  x: number; y: number; vx: number; vy: number;
  type: EnemyType; facing: number; flapTimer: number;
  mesh: any; wingL: any; wingR: any; alive: boolean;
}

export interface EggData {
  x: number; y: number; vx: number; vy: number;
  hatchTimer: number; mesh: any; onGround: boolean;
}

export interface PowerUpData {
  x: number; y: number; vy: number;
  type: PowerUpType; mesh: any; age: number;
}

export interface ScorePopup {
  x: number; y: number; text: string; life: number; mesh: any;
}

export interface AchievementDef { id: string; name: string; desc: string; }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_kill', name: 'First Blood', desc: 'Defeat your first enemy' },
  { id: 'first_egg', name: 'Egg Hunter', desc: 'Collect your first egg' },
  { id: 'wave5', name: 'Wave Rider', desc: 'Clear wave 5' },
  { id: 'wave10', name: 'Wave Master', desc: 'Clear wave 10' },
  { id: 'wave20', name: 'Centurion', desc: 'Clear wave 20' },
  { id: 'kill50', name: 'Bird Brain', desc: 'Defeat 50 enemies total' },
  { id: 'kill200', name: 'Extinction', desc: 'Defeat 200 enemies total' },
  { id: 'eggs25', name: 'Egg Scramble', desc: 'Collect 25 eggs in one game' },
  { id: 'combo5', name: 'Combo King', desc: 'Reach 5x combo' },
  { id: 'combo10', name: 'Combo God', desc: 'Reach 10x combo' },
  { id: 'score1k', name: 'Scorekeeper', desc: 'Score 1,000 points' },
  { id: 'score5k', name: 'High Flyer', desc: 'Score 5,000 points' },
  { id: 'score25k', name: 'Sky Champion', desc: 'Score 25,000 points' },
  { id: 'score100k', name: 'Legend', desc: 'Score 100,000 points' },
  { id: 'ptero', name: 'Ptero Slayer', desc: 'Defeat a pterodactyl' },
  { id: 'flawless', name: 'Flawless Wave', desc: 'Clear a wave without dying' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Clear 5 waves without dying' },
  { id: 'speed_win', name: 'Speed Demon', desc: 'Survive Speed mode' },
  { id: 'marathon', name: 'Marathon', desc: 'Play for 10 minutes' },
  { id: 'five_games', name: 'Regular', desc: 'Play 5 games' },
];

export const POWERUP_COLORS: Record<PowerUpType, number> = {
  shield: 0x4488ff,
  speed: 0x44ff44,
  magnet: 0xff44ff,
  double: 0xffcc00,
};

export const POWERUP_NAMES: Record<PowerUpType, string> = {
  shield: 'SHIELD',
  speed: 'SPEED',
  magnet: 'MAGNET',
  double: '2x SCORE',
};

export const gameState = {
  screen: 'menu' as string,
  mode: 'arcade' as GameMode,
  difficulty: 'normal' as Difficulty,
  score: 0,
  lives: 3,
  wave: 1,
  combo: 0,
  maxCombo: 0,
  comboTimer: 0,
  playerX: 0,
  playerY: 7,
  playerVX: 0,
  playerVY: 0,
  playerFacing: 1,
  playerOnGround: false,
  playerAlive: true,
  playerFlapCooldown: 0,
  respawnTimer: 0,
  invincibleTimer: 0,
  waveClearTimer: 0,
  waveStarting: false,
  waveTimer: 0,
  waveTransition: false,
  waveTransitionTimer: 0,
  pteroActive: false,
  pteroX: 0,
  pteroY: 0,
  pteroVX: 0,
  noDeathThisWave: true,
  noDeathStreak: 0,
  eggsThisGame: 0,
  killsThisGame: 0,
  gameTime: 0,
  speedTimer: 120,
  challengeLives: 5,
  colorScheme: 0,
  soundEnabled: true,
  musicEnabled: true,
  sfxAction: '' as string,
  colorChanged: false,

  // Power-ups
  activePowerUp: null as PowerUpType | null,
  powerUpTimer: 0,
  shieldActive: false,

  // Stats
  totalGames: 0,
  totalScoreAll: 0,
  bestScore: 0,
  bestWave: 0,
  bestCombo: 0,
  totalKillsAll: 0,
  totalEggsAll: 0,
  totalWavesAll: 0,
  totalPterosAll: 0,
  totalPlayTime: 0,
  totalPowerUps: 0,
  achievements: {} as Record<string, boolean>,

  get accentColor(): number {
    return COLOR_SCHEMES[this.colorScheme] ?? 0x00ffff;
  },

  get isInvincible(): boolean {
    return this.invincibleTimer > 0;
  },

  loadStats() {
    try {
      const s = localStorage.getItem('neon-joust-stats');
      if (s) {
        const d = JSON.parse(s);
        this.totalGames = d.totalGames ?? 0;
        this.totalScoreAll = d.totalScoreAll ?? 0;
        this.bestScore = d.bestScore ?? 0;
        this.bestWave = d.bestWave ?? 0;
        this.bestCombo = d.bestCombo ?? 0;
        this.totalKillsAll = d.totalKillsAll ?? 0;
        this.totalEggsAll = d.totalEggsAll ?? 0;
        this.totalWavesAll = d.totalWavesAll ?? 0;
        this.totalPterosAll = d.totalPterosAll ?? 0;
        this.totalPlayTime = d.totalPlayTime ?? 0;
        this.totalPowerUps = d.totalPowerUps ?? 0;
        this.achievements = d.achievements ?? {};
        this.soundEnabled = d.soundEnabled ?? true;
        this.musicEnabled = d.musicEnabled ?? true;
        this.colorScheme = d.colorScheme ?? 0;
      }
    } catch {}
  },

  saveStats() {
    try {
      localStorage.setItem('neon-joust-stats', JSON.stringify({
        totalGames: this.totalGames, totalScoreAll: this.totalScoreAll,
        bestScore: this.bestScore, bestWave: this.bestWave,
        bestCombo: this.bestCombo, totalKillsAll: this.totalKillsAll,
        totalEggsAll: this.totalEggsAll, totalWavesAll: this.totalWavesAll,
        totalPterosAll: this.totalPterosAll, totalPlayTime: this.totalPlayTime,
        totalPowerUps: this.totalPowerUps,
        achievements: this.achievements, soundEnabled: this.soundEnabled,
        musicEnabled: this.musicEnabled, colorScheme: this.colorScheme,
      }));
    } catch {}
  },

  checkAchievements() {
    const ck = (id: string, cond: boolean) => {
      if (!this.achievements[id] && cond) {
        this.achievements[id] = true;
        this.sfxAction = 'achievement';
        this.saveStats();
      }
    };
    ck('first_kill', this.totalKillsAll >= 1);
    ck('first_egg', this.totalEggsAll >= 1);
    ck('wave5', this.bestWave >= 5);
    ck('wave10', this.bestWave >= 10);
    ck('wave20', this.bestWave >= 20);
    ck('kill50', this.totalKillsAll >= 50);
    ck('kill200', this.totalKillsAll >= 200);
    ck('eggs25', this.eggsThisGame >= 25);
    ck('combo5', this.bestCombo >= 5);
    ck('combo10', this.bestCombo >= 10);
    ck('score1k', this.bestScore >= 1000);
    ck('score5k', this.bestScore >= 5000);
    ck('score25k', this.bestScore >= 25000);
    ck('score100k', this.bestScore >= 100000);
    ck('ptero', this.totalPterosAll >= 1);
    ck('flawless', this.noDeathStreak >= 1);
    ck('untouchable', this.noDeathStreak >= 5);
    ck('marathon', this.totalPlayTime >= 600);
    ck('five_games', this.totalGames >= 5);
  },
};
