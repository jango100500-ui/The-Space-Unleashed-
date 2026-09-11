import * as THREE from 'three';

export interface GeneratorScreenTarget {
  id: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface ShieldGenerator {
  id: number;
  localPos: THREE.Vector3;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface Enemy {
  mesh: THREE.Group;
  state: 'attacking' | 'looping_out' | 'looping_back' | 'disabled';
  pos: THREE.Vector3;
  targetX: number;
  targetY: number;
  speed: number;
  shootCooldown: number;
  side: number;
  loopProgress: number;
  seed: number;
  hp: number;
  isElite: boolean;
  isRaid: boolean;
  disabledTimer?: number;
}

export interface Laser {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  isEnemy: boolean;
}

export interface ExplosionPart {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: THREE.Vector3;
}

export interface ShockwaveRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  scaleSpeed: number;
}

export interface FlashCore {
  mesh: THREE.Mesh;
  light?: THREE.PointLight;
  life: number;
  maxLife: number;
}

export interface ShieldImpactEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface DatapadItem {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  healPercent: number;
}

export interface BossDebris {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  radius: number;
}

export interface BossZoneAttack {
  active: boolean;
  timer: number;
  duration: number;
  xMin: number;
  xMax: number;
  fired: boolean;
}

export interface BossTractorBeam {
  active: boolean;
  timer: number;
  duration: number;
  xMin: number;
  xMax: number;
  fired: boolean;
}

export interface BossState {
  group: THREE.Group;
  generators: ShieldGenerator[];
  pos: THREE.Vector3;
  hullHp: number;
  maxHullHp: number;
  shootCooldown: number;
  squadCooldown: number;
  bombardCooldown: number;
  zoneCooldown: number;
  tractorCooldown: number;
  destroyed: boolean;
  phase2Active: boolean;
  raidActive: boolean;
  raidCompleted: boolean;
}

export interface PlanetItem {
  name: string;
  url: string;
}

export type BiomeType = 'deep_space' | 'planet' | 'ionic_vapors' | 'nebula_storm';

export interface BiomeRunStep {
  type: BiomeType;
  title: string;
  fogColor: number;
  planet?: PlanetItem;
}

export const globPlanetFiles = import.meta.glob<string>(
  ['/public/planets/*.{png,PNG,jpg,jpeg,webp}', '../../public/planets/*.{png,PNG,jpg,jpeg,webp}'],
  { eager: true, query: '?url', import: 'default' }
);

export const discoveredPlanets: PlanetItem[] = Object.entries(globPlanetFiles).map(([filePath, assetUrl]) => {
  const file = filePath.split('/').pop() || '';
  const name = file.replace(/\.[^/.]+$/, '');
  return {
    name,
    url: typeof assetUrl === 'string' ? assetUrl : `/planets/${file}`
  };
});

export const defaultPlanets: PlanetItem[] = [
  { name: 'ТАРИС', url: '/planets/taris.png' },
  { name: 'КОРУСАНТ', url: '/planets/coruscant.png' },
  { name: 'ТАТУИН', url: '/planets/tatooine.png' },
  { name: 'МУСТАФАР', url: '/planets/mustafar.png' },
  { name: 'ЭНДОР', url: '/planets/endor.png' }
];

export const availablePlanets: PlanetItem[] = discoveredPlanets.length > 0 ? discoveredPlanets : defaultPlanets;

export function generateBiomeRun(planets: PlanetItem[]): BiomeRunStep[] {
  const shuffledPlanets = [...planets].sort(() => Math.random() - 0.5);
  let pIdx = 0;
  const run: BiomeRunStep[] = [];
  let deepSpaceCount = 0;
  const maxDeepSpace = Math.random() < 0.6 ? 2 : 1;

  for (let i = 0; i < 5; i++) {
    const isAllowedDeepSpace = (i === 0 || i === 2 || i === 3) && deepSpaceCount < maxDeepSpace;
    const prevType = i > 0 ? run[i - 1].type : null;

    let chosenType: BiomeType = 'planet';

    if (i === 0) {
      if (Math.random() < 0.5 && isAllowedDeepSpace) {
        chosenType = 'deep_space';
      } else {
        chosenType = 'planet';
      }
    } else {
      const candidates: BiomeType[] = ['planet', 'ionic_vapors', 'nebula_storm'];
      if (isAllowedDeepSpace && prevType !== 'deep_space') {
        candidates.push('deep_space');
      }
      const filtered = candidates.filter((c) => c !== prevType);
      chosenType = filtered[Math.floor(Math.random() * filtered.length)];
    }

    if (chosenType === 'deep_space') {
      deepSpaceCount++;
      run.push({ type: 'deep_space', title: 'ГЛУБОКИЙ КОСМОС', fogColor: 0x000103 });
    } else if (chosenType === 'ionic_vapors') {
      run.push({ type: 'ionic_vapors', title: 'ИОННЫЕ ИСПАРЕНИЯ', fogColor: 0x240620 });
    } else if (chosenType === 'nebula_storm') {
      run.push({ type: 'nebula_storm', title: 'ТУМАННОСТЬ', fogColor: 0x0d121c });
    } else {
      const p = shuffledPlanets[pIdx % shuffledPlanets.length];
      pIdx++;
      run.push({ type: 'planet', title: `СИСТЕМА ${p.name.toUpperCase()}`, fogColor: 0x000206, planet: p });
    }
  }

  return run;
}

export function createProceduralPlanetTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const baseHue = Math.abs(hash % 360);

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, `hsl(${baseHue}, 50%, 40%)`);
  grad.addColorStop(0.5, `hsl(${(baseHue + 40) % 360}, 65%, 55%)`);
  grad.addColorStop(1, `hsl(${(baseHue + 80) % 360}, 45%, 30%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 18; i++) {
    const y = Math.random() * 512;
    const h = 10 + Math.random() * 40;
    ctx.fillStyle = `hsla(${(baseHue + i * 15) % 360}, 60%, ${30 + (i % 4) * 15}%, 0.4)`;
    ctx.fillRect(0, y, 1024, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
