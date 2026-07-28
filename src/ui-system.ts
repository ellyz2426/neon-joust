// Neon Joust VR — UI system (PanelUI management)
import { createSystem, World, PanelUI, PanelDocument, UIKit, ScreenSpace } from '@iwsdk/core';
import { gameState, ACHIEVEMENTS, COLOR_NAMES, GameMode, POWERUP_NAMES, LeaderboardEntry, DIFFICULTY_MULTIPLIER } from './game-state.js';
import { GameSystem } from './game-system.js';

type PanelName = 'menu' | 'hud' | 'pause' | 'results' | 'settings' | 'tutorial' | 'stats' | 'achievements' | 'leaderboard';
const PANEL_CONFIGS: Record<PanelName, string> = {
  menu: './ui/menu.json',
  hud: './ui/hud.json',
  pause: './ui/pause.json',
  results: './ui/results.json',
  settings: './ui/settings.json',
  tutorial: './ui/tutorial.json',
  stats: './ui/stats.json',
  achievements: './ui/achievements.json',
  leaderboard: './ui/leaderboard.json',
};

const CONFIG_TO_NAME: Record<string, PanelName> = {};
for (const [n, c] of Object.entries(PANEL_CONFIGS)) CONFIG_TO_NAME[c] = n as PanelName;

function screenToPanel(screen: string): PanelName {
  if (screen === 'playing') return 'hud';
  if (screen === 'paused') return 'pause';
  if (screen === 'gameover') return 'results';
  return screen as PanelName;
}

export class UISystem extends createSystem({
  panels: { required: [PanelUI, PanelDocument] },
}) {

  private docs: Map<PanelName, any> = new Map();
  private panelEntities: Map<PanelName, any> = new Map();
  private activePanel: PanelName = 'menu';
  private prevScreen = '';
  private achPage = 0;

  init() {
    // Create all panel entities
    for (const [name, config] of Object.entries(PANEL_CONFIGS)) {
      const entity = this.world.createEntity();
      entity.addComponent(PanelUI, { config });
      if (name === 'hud') {
        entity.addComponent(ScreenSpace);
      }
    }

    // Listen for qualify events on the panels query
    this.queries.panels.subscribe('qualify', (entity) => {
      const config = entity.getValue(PanelUI, 'config') as string;
      const name = CONFIG_TO_NAME[config];
      if (!name) return;
      const doc = PanelDocument.data.document[entity.index] as any;
      if (!doc) return;
      this.docs.set(name, doc);
      this.panelEntities.set(name, entity);
      this.wirePanel(name, doc);
      // Show/hide based on current screen
      const vis = screenToPanel(gameState.screen) === name;
      (doc as any).setProperties?.({ visible: vis });
      // For non-active panels, hide via root
      const root = doc.children?.[0];
      if (root && !vis) {
        root.setProperties?.({ visibility: 'hidden' });
      }
    });
  }

  private findEl(doc: any, id: string): any {
    try { return doc.getElementById(id); } catch { return null; }
  }

  private wirePanel(name: PanelName, doc: any) {
    const findEl = (id: string) => this.findEl(doc, id);

    if (name === 'menu') {
      this.wireBtn(findEl('btn-arcade'), () => this.startMode('arcade'));
      this.wireBtn(findEl('btn-speed'), () => this.startMode('speed'));
      this.wireBtn(findEl('btn-zen'), () => this.startMode('zen'));
      this.wireBtn(findEl('btn-challenge'), () => this.startMode('challenge'));
      this.wireBtn(findEl('btn-settings'), () => { gameState.screen = 'settings'; });
      this.wireBtn(findEl('btn-tutorial'), () => { gameState.screen = 'tutorial'; });
      this.wireBtn(findEl('btn-stats'), () => { gameState.screen = 'stats'; });
      this.wireBtn(findEl('btn-achievements'), () => { gameState.screen = 'achievements'; });
      this.wireBtn(findEl('btn-leaderboard'), () => { gameState.screen = 'leaderboard'; });
    } else if (name === 'pause') {
      this.wireBtn(findEl('btn-resume'), () => { gameState.screen = 'playing'; });
      this.wireBtn(findEl('btn-quit'), () => { gameState.screen = 'menu'; });
    } else if (name === 'results') {
      this.wireBtn(findEl('btn-retry'), () => this.startMode(gameState.mode));
      this.wireBtn(findEl('btn-menu'), () => { gameState.screen = 'menu'; });
    } else if (name === 'settings') {
      this.wireBtn(findEl('btn-sound'), () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        gameState.saveStats();
      });
      this.wireBtn(findEl('btn-music'), () => {
        gameState.musicEnabled = !gameState.musicEnabled;
        gameState.saveStats();
      });
      this.wireBtn(findEl('btn-color'), () => {
        gameState.colorScheme = (gameState.colorScheme + 1) % 4;
        gameState.saveStats();
      });
      this.wireBtn(findEl('btn-diff'), () => {
        const diffs: Array<'normal' | 'hard' | 'insane'> = ['normal', 'hard', 'insane'];
        const idx = diffs.indexOf(gameState.difficulty);
        gameState.difficulty = diffs[(idx + 1) % 3];
      });
      this.wireBtn(findEl('btn-back'), () => { gameState.screen = 'menu'; });
    } else if (name === 'tutorial') {
      this.wireBtn(findEl('btn-back'), () => { gameState.screen = 'menu'; });
    } else if (name === 'stats') {
      this.wireBtn(findEl('btn-back'), () => { gameState.screen = 'menu'; });
    } else if (name === 'achievements') {
      this.wireBtn(findEl('btn-back'), () => { gameState.screen = 'menu'; });
      this.wireBtn(findEl('btn-prev'), () => { this.achPage = Math.max(0, this.achPage - 1); });
      this.wireBtn(findEl('btn-next'), () => { this.achPage = Math.min(Math.floor((ACHIEVEMENTS.length - 1) / 5), this.achPage + 1); });
    } else if (name === 'leaderboard') {
      this.wireBtn(findEl('btn-back'), () => { gameState.screen = 'menu'; });
    }
  }

  private wireBtn(el: any, fn: () => void) {
    if (!el) return;
    el.addEventListener('click', fn);
  }

  private startMode(mode: string) {
    const game = ((this.world as any).getSystem(GameSystem) as GameSystem);
    if (game) game.startGame(mode);
  }

  update(_delta: number, _time: number) {
    const currentPanel = screenToPanel(gameState.screen);
    if (currentPanel !== this.activePanel) {
      // Hide old panel
      const oldDoc = this.docs.get(this.activePanel);
      if (oldDoc) {
        const root = oldDoc.children?.[0];
        if (root) root.setProperties?.({ visibility: 'hidden' });
      }
      // Show new panel
      const curDoc = this.docs.get(currentPanel);
      if (curDoc) {
        const root = curDoc.children?.[0];
        if (root) root.setProperties?.({ visibility: 'visible' });
      }
      this.activePanel = currentPanel;
    }
    this.updatePanelContent(currentPanel);
    this.prevScreen = gameState.screen;
  }

  private updatePanelContent(panel: PanelName) {
    const doc = this.docs.get(panel);
    if (!doc) return;
    const findEl = (id: string) => this.findEl(doc, id);

    if (panel === 'hud') {
      this.setText(findEl('txt-score'), `SCORE: ${gameState.score}`);
      this.setText(findEl('txt-wave'), `WAVE ${gameState.wave}`);
      this.setText(findEl('txt-lives'), `LIVES: ${gameState.lives}`);
      if (gameState.combo > 1) {
        this.setText(findEl('txt-combo'), `x${gameState.combo} COMBO`);
      } else {
        this.setText(findEl('txt-combo'), '');
      }
      if (gameState.mode === 'speed') {
        this.setText(findEl('txt-timer'), `TIME: ${Math.ceil(gameState.speedTimer)}s`);
      } else {
        this.setText(findEl('txt-timer'), '');
      }
      // Power-up indicator
      if (gameState.activePowerUp) {
        const name = POWERUP_NAMES[gameState.activePowerUp] ?? '';
        const secs = Math.ceil(gameState.powerUpTimer);
        this.setText(findEl('txt-powerup'), `${name} ${secs}s`);
      } else {
        this.setText(findEl('txt-powerup'), '');
      }
      // Wave announcement
      if (gameState.waveTransition && gameState.waveTransitionTimer > 1.0) {
        const bossMsg = gameState.bossWave ? 'BOSS WAVE' : `WAVE ${gameState.wave} START!`;
        const bonusMsg = gameState.waveBonus > 0 ? ` +${gameState.waveBonus}` : '';
        this.setText(findEl('txt-wave-announce'), bossMsg + bonusMsg);
      } else {
        this.setText(findEl('txt-wave-announce'), '');
      }
      // Boss HP indicator
      if (gameState.bossWave) {
        this.setText(findEl('txt-boss-hp'), this.getBossHpText());
      } else {
        this.setText(findEl('txt-boss-hp'), '');
      }
      // Kill streak
      if (gameState.killStreak >= 2) {
        this.setText(findEl('txt-streak'), `${gameState.killStreak}x AIR STREAK`);
      } else {
        this.setText(findEl('txt-streak'), '');
      }
      // Wind indicator
      if (Math.abs(gameState.windForce) > 0.3) {
        const dir = gameState.windForce > 0 ? '>>>' : '<<<';
        this.setText(findEl('txt-wind'), `WIND ${dir}`);
      } else {
        this.setText(findEl('txt-wind'), '');
      }
      // Wave preview (incoming enemies)
      if (gameState.wavePreviewTimer > 0 && gameState.wavePreviewText) {
        this.setText(findEl('txt-wave-preview'), gameState.wavePreviewText);
      } else {
        this.setText(findEl('txt-wave-preview'), '');
      }
      // Difficulty multiplier
      if (gameState.diffMultiplier > 1) {
        this.setText(findEl('txt-diff-mul'), `${gameState.diffMultiplier}x`);
      } else {
        this.setText(findEl('txt-diff-mul'), '');
      }
    } else if (panel === 'results') {
      this.setText(findEl('txt-final-score'), `SCORE: ${gameState.score}`);
      this.setText(findEl('txt-final-wave'), `WAVE: ${gameState.wave}`);
      this.setText(findEl('txt-final-kills'), `ENEMIES: ${gameState.killsThisGame}`);
      this.setText(findEl('txt-final-eggs'), `EGGS: ${gameState.eggsThisGame}`);
      this.setText(findEl('txt-final-combo'), `BEST COMBO: x${gameState.maxCombo}`);
      this.setText(findEl('txt-best'), `HIGH SCORE: ${gameState.bestScore}`);
      this.setText(findEl('txt-powerups'), `POWER-UPS: ${gameState.powerUpsThisGame}`);
      this.setText(findEl('txt-kill-streak'), `BEST STREAK: ${gameState.bestKillStreak}x`);
      // Leaderboard rank
      const rank = gameState.leaderboard.findIndex(e => e.score === gameState.score);
      if (rank >= 0 && rank < 10) {
        this.setText(findEl('txt-lb-rank'), `#${rank + 1} ON LEADERBOARD!`);
      } else {
        this.setText(findEl('txt-lb-rank'), '');
      }
      // Difficulty bonus
      if (gameState.diffMultiplier > 1) {
        this.setText(findEl('txt-diff-bonus'), `${gameState.difficulty.toUpperCase()} BONUS: ${gameState.diffMultiplier}x SCORE`);
      } else {
        this.setText(findEl('txt-diff-bonus'), '');
      }
    } else if (panel === 'settings') {
      this.setText(findEl('txt-sound'), `SOUND: ${gameState.soundEnabled ? 'ON' : 'OFF'}`);
      this.setText(findEl('txt-music'), `MUSIC: ${gameState.musicEnabled ? 'ON' : 'OFF'}`);
      this.setText(findEl('txt-color'), `COLOR: ${COLOR_NAMES[gameState.colorScheme]}`);
      this.setText(findEl('txt-diff'), `DIFFICULTY: ${gameState.difficulty.toUpperCase()}`);
    } else if (panel === 'stats') {
      this.setText(findEl('txt-games'), `GAMES: ${gameState.totalGames}`);
      this.setText(findEl('txt-kills'), `ENEMIES DEFEATED: ${gameState.totalKillsAll}`);
      this.setText(findEl('txt-eggs'), `EGGS COLLECTED: ${gameState.totalEggsAll}`);
      this.setText(findEl('txt-waves'), `WAVES CLEARED: ${gameState.totalWavesAll}`);
      this.setText(findEl('txt-pteros'), `PTERODACTYLS: ${gameState.totalPterosAll}`);
      this.setText(findEl('txt-best-score'), `BEST SCORE: ${gameState.bestScore}`);
      this.setText(findEl('txt-best-wave'), `BEST WAVE: ${gameState.bestWave}`);
      this.setText(findEl('txt-best-combo'), `BEST COMBO: x${gameState.bestCombo}`);
    } else if (panel === 'achievements') {
      const start = this.achPage * 5;
      for (let i = 0; i < 5; i++) {
        const a = ACHIEVEMENTS[start + i];
        const el = findEl(`ach-${i}`);
        if (el && a) {
          const unlocked = gameState.achievements[a.id];
          this.setText(el, `${unlocked ? '[*]' : '[ ]'} ${a.name} - ${a.desc}`);
        } else if (el) {
          this.setText(el, '');
        }
      }
      this.setText(findEl('txt-page'), `${this.achPage + 1}/${Math.ceil(ACHIEVEMENTS.length / 5)}`);
      const unlocked = Object.keys(gameState.achievements).filter(k => gameState.achievements[k]).length;
      this.setText(findEl('txt-total'), `${unlocked}/${ACHIEVEMENTS.length} UNLOCKED`);
    } else if (panel === 'leaderboard') {
      const lb = gameState.leaderboard;
      for (let i = 0; i < 10; i++) {
        const el = findEl(`lb-${i}`);
        if (!el) continue;
        if (i < lb.length) {
          const e = lb[i];
          const modeStr = e.mode.toUpperCase().padEnd(8);
          const diffStr = (e.difficulty ?? 'normal').toUpperCase();
          this.setText(el, `${(i + 1).toString().padStart(2)}. ${String(e.score).padStart(8)}  W${String(e.wave).padStart(3)}  ${modeStr} ${diffStr}`);
        } else {
          this.setText(el, `${(i + 1).toString().padStart(2)}. ---`);
        }
      }
      this.setText(findEl('txt-empty'), lb.length === 0 ? 'No scores yet. Play a game!' : '');
    }
  }

  private setText(el: any, text: string) {
    if (el) {
      try { el.setProperties({ content: text }); } catch {}
    }
  }

  private getBossHpText(): string {
    try {
      const game = ((this.world as any).getSystem(GameSystem) as GameSystem);
      if (!game) return '';
      const enemies = (game as any).enemies as any[];
      const dragon = enemies?.find((e: any) => e.type === 'dragon' && e.alive);
      if (dragon) {
        const filled = '#'.repeat(dragon.hp);
        const empty = '-'.repeat(dragon.maxHp - dragon.hp);
        return `DRAGON [${filled}${empty}]`;
      }
    } catch {}
    return '';
  }
}
