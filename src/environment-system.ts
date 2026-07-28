// Neon Joust VR — Holodeck environment with dynamic wave intensity
import { createSystem, World, Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry,
  MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, AmbientLight, PointLight,
  FogExp2, Color } from '@iwsdk/core';
import { gameState, ARENA_W } from './game-state.js';

export class EnvironmentSystem extends createSystem({}) {

  private pillars: Group[] = [];
  private ceilingLights: Mesh[] = [];
  private floorGlow: Mesh | null = null;
  private stars: Mesh[] = [];
  private ambientLight: AmbientLight | null = null;
  private accentLight: PointLight | null = null;
  private lavaLight: PointLight | null = null;
  private fog: FogExp2 | null = null;
  private prevIntensity = 0;

  init() {
    const scene = this.world.scene;
    const ac = gameState.accentColor;

    // Fog
    this.fog = new FogExp2(0x000811, 0.02);
    scene.fog = this.fog;

    // Lighting
    this.ambientLight = new AmbientLight(0x112233, 0.3);
    scene.add(this.ambientLight);
    this.accentLight = new PointLight(ac, 0.5, 30);
    this.accentLight.position.set(0, 10, 5);
    scene.add(this.accentLight);
    this.lavaLight = new PointLight(0xff4400, 0.3, 20);
    this.lavaLight.position.set(0, 0.5, 3);
    scene.add(this.lavaLight);

    // Grid floor
    const floorGeo = new BoxGeometry(30, 0.02, 20);
    const floorMat = new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.05 });
    const floor = new Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    scene.add(floor);
    const floorEdges = new LineSegments(new EdgesGeometry(floorGeo), new LineBasicMaterial({ color: ac, transparent: true, opacity: 0.2 }));
    floor.add(floorEdges);

    // Grid ceiling
    const ceilGeo = new BoxGeometry(30, 0.02, 20);
    const ceil = new Mesh(ceilGeo, new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.03 }));
    ceil.position.set(0, 15, 0);
    scene.add(ceil);
    ceil.add(new LineSegments(new EdgesGeometry(ceilGeo), new LineBasicMaterial({ color: ac, transparent: true, opacity: 0.15 })));

    // Floor glow pool
    const glowGeo = new BoxGeometry(16, 0.01, 6);
    const glowMat = new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.08 });
    this.floorGlow = new Mesh(glowGeo, glowMat);
    this.floorGlow.position.set(0, -0.15, 0);
    scene.add(this.floorGlow);

    // Pillars
    const pillarPositions = [
      [-12, -2], [12, -2], [-12, 2], [12, 2], [-6, -3], [6, -3],
    ];
    for (const [px, pz] of pillarPositions) {
      const g = new Group();
      const pGeo = new CylinderGeometry(0.12, 0.12, 15, 6);
      const pMat = new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.1 });
      const pillar = new Mesh(pGeo, pMat);
      pillar.position.y = 7.5;
      g.add(pillar);
      g.add(new LineSegments(new EdgesGeometry(pGeo), new LineBasicMaterial({ color: ac, transparent: true, opacity: 0.3 })));
      // Cap
      const capGeo = new SphereGeometry(0.2, 6, 4);
      const cap = new Mesh(capGeo, new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.4 }));
      cap.position.y = 15;
      g.add(cap);
      g.position.set(px, 0, pz);
      scene.add(g);
      this.pillars.push(g);
    }

    // Ceiling light strips
    for (let i = 0; i < 4; i++) {
      const lGeo = new BoxGeometry(8, 0.08, 0.08);
      const lMat = new MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.3 });
      const light = new Mesh(lGeo, lMat);
      light.position.set((i - 1.5) * 5, 14.8, 0);
      scene.add(light);
      this.ceilingLights.push(light);
    }

    // Stars
    for (let i = 0; i < 60; i++) {
      const sGeo = new SphereGeometry(0.02 + Math.random() * 0.02, 4, 3);
      const sMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 + Math.random() * 0.4 });
      const star = new Mesh(sGeo, sMat);
      star.position.set(
        (Math.random() - 0.5) * 40,
        10 + Math.random() * 8,
        -5 - Math.random() * 10,
      );
      scene.add(star);
      this.stars.push(star);
    }
  }

  update(_delta: number, time: number) {
    // Ceiling light pulse
    for (let i = 0; i < this.ceilingLights.length; i++) {
      const mat = this.ceilingLights[i].material as MeshBasicMaterial;
      mat.opacity = 0.2 + 0.15 * Math.sin(time * 1.5 + i * 1.2);
    }
    // Floor glow
    if (this.floorGlow) {
      (this.floorGlow.material as MeshBasicMaterial).opacity = 0.06 + 0.03 * Math.sin(time * 2);
    }
    // Star twinkle
    for (let i = 0; i < this.stars.length; i++) {
      const mat = this.stars[i].material as MeshBasicMaterial;
      mat.opacity = 0.1 + 0.3 * Math.sin(time * (0.5 + i * 0.1) + i);
    }

    // Wave intensity atmosphere — fog thickens, lava light brightens, ambient darkens
    const intensity = gameState.waveIntensity;
    if (Math.abs(intensity - this.prevIntensity) > 0.01) {
      this.prevIntensity = intensity;
      // Fog: denser at high waves (more menacing)
      if (this.fog) {
        this.fog.density = 0.02 + intensity * 0.015;
      }
      // Lava light: brighter and wider at higher waves
      if (this.lavaLight) {
        this.lavaLight.intensity = 0.3 + intensity * 0.5;
        this.lavaLight.distance = 20 + intensity * 15;
      }
      // Ambient: slightly darker at higher waves
      if (this.ambientLight) {
        this.ambientLight.intensity = 0.3 - intensity * 0.1;
      }
      // Accent light: brighter at higher waves
      if (this.accentLight) {
        this.accentLight.intensity = 0.5 + intensity * 0.3;
      }
      // Pillar opacity increases with intensity
      for (const p of this.pillars) {
        const pillarMesh = p.children[0] as Mesh;
        if (pillarMesh) {
          (pillarMesh.material as MeshBasicMaterial).opacity = 0.1 + intensity * 0.08;
        }
      }
    }
  }
}
