// Neon Joust VR — UI system (PanelUI management)
import { createSystem, World, PanelUI, Follower, ScreenSpace } from '@iwsdk/core';
import { gameState, ACHIEVEMENTS, COLOR_NAMES, GameMode } from './game-state.js';
import { GameSystem } from './game-system.js';

type PanelName = 'menu' | 'hud' | 'pause' | 'results' | 'settings' | 'tutorial' | 'stats' | 'achievements';
const PANEL_CONFIGS: Record<PanelName, string> = {
  menu: './ui/menu.json',
  hud: './ui/hud.json',
  pause: './ui/pause.json',
  results: './ui/results.json',
  settings: './ui/settings.json',
  tutorial: './ui/tutorial.json',
  stats: './ui/stats.json',
  achievements: './ui/achievements.json',
};

function screenToPanel(screen: string): PanelName {
  if (screen === 'playing') return 'hud';
  if (screen === 'paused') return 'pause';
  if (screen === 'gameover') return 'results';
  return screen as PanelName;
}

export class UISystem extends createSystem({}) {

  private panels: Map<PanelName, any> = new Map();
  private panelEntities: Map<PanelName, any> = new Map();
  private activePanel: PanelName = 'menu';
  private prevScreen = '';
  private achPage = 0;

  init() {
    for (const [name, config] of Object.entries(PANEL_CONFIGS)) {
      this.createPanel(name as PanelName, config);
    }
  }

  private createPanel(name: PanelName, config: string) {
    const entity = (this.world as any).ecs.createEntity();
    entity.addComponent(PanelUI, { config });
    if (name === 'hud') {
      entity.addComponent(ScreenSpace);
    }
    entity.addEventListener('qualify', () => {
      const panel = entity.getComponent(PanelUI);
      if (!panel) return;
      this.panels.set(name, panel);
      this.panelEntities.set(name, entity);
      this.wirePanel(name, panel);
      // Initial visibility
      const vis = screenToPanel(gameState.screen) === name;
      panel.setProperties({ visible: vis });
    });
  }

  private wirePanel(name: PanelName, panel: any) {
    const findEl = (id: string) => {
      try { return panel.querySelector('#' + id); } catch { return null; }
    };

    if (name === 'menu') {
      this.wireBtn(findEl('btn-arcade'), () => this.startMode('arcade'));
      this.wireBtn(findEl('btn-speed'), () => this.startMode('speed'));
      this.wireBtn(findEl('btn-zen'), () => this.startMode('zen'));
      this.wireBtn(findEl('btn-challenge'), () => this.startMode('challenge'));
      this.wireBtn(findEl('btn-settings'), () => { gameState.screen = 'settings'; });
      this.wireBtn(findEl('btn-tutorial'), () => { gameState.screen = 'tutorial'; });
      this.wireBtn(findEl('btn-stats'), () => { gameState.screen = 'stats'; });
      this.wireBtn(findEl('btn-achievements'), () => { gameState.screen = 'achievements'; });
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
      const old = this.panels.get(this.activePanel);
      if (old) old.setProperties({ visible: false });
      const cur = this.panels.get(currentPanel);
      if (cur) cur.setProperties({ visible: true });
      this.activePanel = currentPanel;
    }
    this.updatePanelContent(currentPanel);
    this.prevScreen = gameState.screen;
  }

  private updatePanelContent(panel: PanelName) {
    const p = this.panels.get(panel);
    if (!p) return;
    const findEl = (id: string) => {
      try { return p.querySelector('#' + id); } catch { return null; }
    };

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
    } else if (panel === 'results') {
      this.setText(findEl('txt-final-score'), `SCORE: ${gameState.score}`);
      this.setText(findEl('txt-final-wave'), `WAVE: ${gameState.wave}`);
      this.setText(findEl('txt-final-kills'), `ENEMIES: ${gameState.killsThisGame}`);
      this.setText(findEl('txt-final-eggs'), `EGGS: ${gameState.eggsThisGame}`);
      this.setText(findEl('txt-final-combo'), `BEST COMBO: x${gameState.maxCombo}`);
      this.setText(findEl('txt-best'), `HIGH SCORE: ${gameState.bestScore}`);
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
      const end = Math.min(start + 5, ACHIEVEMENTS.length);
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
    }
  }

  private setText(el: any, text: string) {
    if (el) {
      try { el.setProperties({ content: text }); } catch {}
    }
  }
}
