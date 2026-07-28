// Neon Joust VR — Input system (keyboard + VR)
import { createSystem, World } from '@iwsdk/core';
import { gameState } from './game-state.js';
import { GameSystem } from './game-system.js';

export class InputSystem extends createSystem({}) {

  private keys: Record<string, boolean> = {};
  private prevFlap = false;

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (gameState.screen === 'playing') gameState.screen = 'paused';
        else if (gameState.screen === 'paused') gameState.screen = 'playing';
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  update(_delta: number, _time: number) {
    const game = ((this.world as any).getSystem(GameSystem) as GameSystem);
    if (!game) return;
    const left = !!(this.keys['arrowleft'] || this.keys['a']);
    const right = !!(this.keys['arrowright'] || this.keys['d']);
    const flap = !!(this.keys['arrowup'] || this.keys['w'] || this.keys[' ']);
    const flapPressed = flap && !this.prevFlap;
    this.prevFlap = flap;

    // VR controller input
    let vrLeft = false, vrRight = false, vrFlap = false, vrFlapPressed = false;
    try {
      const input = this.world.input;
      if (input) {
        const axes = (input as any).getAxesValues?.('ThumbstickX');
        if (axes && typeof axes === 'object') {
          const x = (axes as any).x ?? axes;
          if (typeof x === 'number') {
            if (x < -0.3) vrLeft = true;
            if (x > 0.3) vrRight = true;
          }
        }
        const trigger = (input as any).getButtonValue?.('Trigger');
        if (typeof trigger === 'number' && trigger > 0.5) vrFlap = true;
        const btnA = (input as any).getButtonValue?.('ButtonA');
        if (typeof btnA === 'number' && btnA > 0.5) vrFlap = true;
        const btnB = (input as any).getButtonValue?.('ButtonB');
        if (typeof btnB === 'number' && btnB > 0.5) {
          if (gameState.screen === 'playing') gameState.screen = 'paused';
        }
      }
    } catch {}

    game.setInput(
      left || vrLeft,
      right || vrRight,
      flap || vrFlap,
      flapPressed || (vrFlap && !this.prevFlap),
    );
  }
}
