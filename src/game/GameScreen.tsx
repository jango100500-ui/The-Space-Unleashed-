import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PreloadedModels } from '../App.tsx';

const SOUNDS = {
  xwingEngine: '/sounds/xwingengine.mp3',
  explode: '/sounds/explode.mp3',
  xwingShot: '/sounds/xwingshot.mp3',
  tieShot: '/sounds/tieshot.mp3',
  tieEngine: '/sounds/tieengine.mp3'
};

interface GameScreenProps {
  models: PreloadedModels;
  onExit: () => void;
}

interface Enemy {
  mesh: THREE.Group;
  state: 'attacking' | 'looping_out' | 'looping_back';
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
}

interface Laser {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  isEnemy: boolean;
}

interface ExplosionPart {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: THREE.Vector3;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  scaleSpeed: number;
}

interface FlashCore {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  life: number;
  maxLife: number;
}

interface ShieldGenerator {
  mesh: THREE.Mesh;
  localPos: THREE.Vector3;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

interface BossState {
  group: THREE.Group;
  generators: ShieldGenerator[];
  pos: THREE.Vector3;
  speed: number;
  shootCooldown: number;
  squadCooldown: number;
  bombardCooldown: number;
  destroyed: boolean;
}

interface PlanetItem {
  name: string;
  url: string;
}

const globPlanetFiles = import.meta.glob<string>(
  ['/public/planets/*.{png,PNG,jpg,jpeg,webp}', '../../public/planets/*.{png,PNG,jpg,jpeg,webp}'],
  { eager: true, query: '?url', import: 'default' }
);

const discoveredPlanets: PlanetItem[] = Object.entries(globPlanetFiles).map(([filePath, assetUrl]) => {
  const file = filePath.split('/').pop() || '';
  const name = file.replace(/\.[^/.]+$/, '');
  return {
    name,
    url: typeof assetUrl === 'string' ? assetUrl : `/planets/${file}`
  };
});

const defaultPlanets: PlanetItem[] = [
  { name: 'ТАРИС', url: '/planets/taris.png' },
  { name: 'КОРУСАНТ', url: '/planets/coruscant.png' },
  { name: 'ТАТУИН', url: '/planets/tatooine.png' },
  { name: 'МУСТАФАР', url: '/planets/mustafar.png' },
  { name: 'ЭНДОР', url: '/planets/endor.png' }
];

const availablePlanets: PlanetItem[] = discoveredPlanets.length > 0 ? discoveredPlanets : defaultPlanets;

function createProceduralPlanetTexture(name: string): THREE.CanvasTexture {
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

export default function GameScreen({ models, onExit }: GameScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);
  const [hp, setHp] = useState<number>(100);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [inBiomeTransition, setInBiomeTransition] = useState<boolean>(false);
  const [biomeTitle, setBiomeTitle] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [bossCutsceneActive, setBossCutsceneActive] = useState<boolean>(false);
  const [bossVictoryActive, setBossVictoryActive] = useState<boolean>(false);

  const isPausedRef = useRef<boolean>(false);
  const inputRef = useRef<{ x: number; y: number; fire: boolean }>({ x: 0, y: 0, fire: false });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const xwingGainRef = useRef<GainNode | null>(null);
  const tieEngineGainRef = useRef<GainNode | null>(null);
  const spaceMuffleFilterRef = useRef<BiquadFilterNode | null>(null);

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (xwingGainRef.current && tieEngineGainRef.current) {
      if (isPaused) {
        xwingGainRef.current.gain.value = 0;
        tieEngineGainRef.current.gain.value = 0;
      }
    }
  }, [isPaused]);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 460;
    muffle.connect(ctx.destination);
    spaceMuffleFilterRef.current = muffle;

    const loadSound = async (key: string, url: string) => {
      try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        audioBuffersRef.current[key] = decoded;

        if (key === 'xwingEngine') {
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          const gain = ctx.createGain();
          gain.gain.value = 0.14;
          src.connect(gain);
          gain.connect(muffle);
          src.start(0);
          xwingGainRef.current = gain;
        }

        if (key === 'tieEngine') {
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(gain);
          gain.connect(muffle);
          src.start(0);
          tieEngineGainRef.current = gain;
        }
      } catch {
        return;
      }
    };

    loadSound('xwingEngine', SOUNDS.xwingEngine);
    loadSound('explode', SOUNDS.explode);
    loadSound('xwingShot', SOUNDS.xwingShot);
    loadSound('tieShot', SOUNDS.tieShot);
    loadSound('tieEngine', SOUNDS.tieEngine);

    return () => {
      ctx.close();
    };
  }, []);

  const playBuffer = (buffer: AudioBuffer | undefined, volume: number, useMuffle = false) => {
    if (!buffer || !audioCtxRef.current || isPausedRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      src.connect(gain);
      if (useMuffle && spaceMuffleFilterRef.current) {
        gain.connect(spaceMuffleFilterRef.current);
      } else {
        gain.connect(ctx.destination);
      }

      src.start(0);
    } catch {
      return;
    }
  };

  useEffect(() => {
    inputRef.current.fire = isFiring;
  }, [isFiring]);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000103, 0.00035);

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 7000);
    const cameraBase = new THREE.Vector3(0, 3.2, 13.0);
    camera.position.copy(cameraBase);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000103);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const flatAmbient = new THREE.AmbientLight(0x555555, 1.6);
    scene.add(flatAmbient);

    const mainSun = new THREE.DirectionalLight(0xffffff, 4.0);
    mainSun.position.set(40, 180, 80);
    scene.add(mainSun);

    const fillLight = new THREE.DirectionalLight(0x222222, 0.4);
    fillLight.position.set(-40, -120, -50);
    scene.add(fillLight);

    const tuneTextures = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          if (m.material) {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.roughness = 0.6;
            mat.metalness = 0.1;
            mat.needsUpdate = true;
          }
        }
      });
    };

    const starCount = 2400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 1600;
      starPos[i + 1] = (Math.random() - 0.5) * 1000;
      starPos[i + 2] = -Math.random() * 2200 + 20;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.15, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const textureLoader = new THREE.TextureLoader();
    const planetMeshes: THREE.Mesh[] = [];
    let lastPlanetName = '';

    const spawnPlanet = (planetItem: PlanetItem) => {
      const radius = 280 + Math.random() * 180;
      const geo = new THREE.SphereGeometry(radius, 64, 48);

      const mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        flatShading: false
      });

      const fallbackTex = createProceduralPlanetTexture(planetItem.name);
      mat.map = fallbackTex;

      textureLoader.load(
        planetItem.url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          mat.map = tex;
          mat.needsUpdate = true;
        },
        undefined,
        () => {
          mat.map = fallbackTex;
          mat.needsUpdate = true;
        }
      );

      const planet = new THREE.Mesh(geo, mat);
      const side = Math.random() > 0.5 ? 1 : -1;
      planet.position.set(
        side * (480 + Math.random() * 200),
        -160 - Math.random() * 80,
        -1800 - Math.random() * 400
      );
      planet.userData = { radius, speed: 38 };
      scene.add(planet);
      planetMeshes.push(planet);
    };

    const getUniquePlanet = (): PlanetItem => {
      const candidates = availablePlanets.filter((p) => p.name !== lastPlanetName);
      const pool = candidates.length > 0 ? candidates : availablePlanets;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      lastPlanetName = picked.name;
      return picked;
    };

    const defaultShipPos = new THREE.Vector3(0, -1.2, 0);
    const shipPos = defaultShipPos.clone();
    let shipVx = 0;
    let shipVy = 0;
    let shipBank = 0;
    let shipPitch = 0;

    const playerShip = models.xwing.clone();
    playerShip.scale.setScalar(0.48);
    playerShip.position.copy(shipPos);
    playerShip.rotation.set(0, 0, 0);
    tuneTextures(playerShip);
    scene.add(playerShip);

    const crosshairTex = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.32, 16),
      new THREE.MeshBasicMaterial({ color: 0x64b5f6, wireframe: true, transparent: true, opacity: 0.55 })
    );
    crosshairTex.position.set(0, 0, -50);
    scene.add(crosshairTex);

    const redLaserGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 4);
    redLaserGeo.rotateX(Math.PI / 2);
    const redLaserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    const greenLaserGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 4);
    greenLaserGeo.rotateX(Math.PI / 2);
    const greenLaserMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });

    const flashCoreGeo = new THREE.IcosahedronGeometry(1.8, 1);
    const flashCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const shockRingGeo = new THREE.RingGeometry(0.5, 1.4, 18);
    const shockRingMat = new THREE.MeshBasicMaterial({ color: 0xff8822, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });

    const debrisPieceGeo = new THREE.DodecahedronGeometry(0.65, 0);
    const debrisMats = [
      new THREE.MeshBasicMaterial({ color: 0xffdd44 }),
      new THREE.MeshBasicMaterial({ color: 0xff5522 }),
      new THREE.MeshBasicMaterial({ color: 0xd32f2f }),
      new THREE.MeshBasicMaterial({ color: 0x8a9ba8 })
    ];

    const lasers: Laser[] = [];
    const enemies: Enemy[] = [];
    const debrisList: ExplosionPart[] = [];
    const shockwaves: ShockwaveRing[] = [];
    const flashCores: FlashCore[] = [];

    const spawnRetroExplosion = (pos: THREE.Vector3, scale = 1.0) => {
      const flashMesh = new THREE.Mesh(flashCoreGeo, flashCoreMat);
      flashMesh.position.copy(pos);
      flashMesh.scale.setScalar(2.2 * scale);
      scene.add(flashMesh);

      const expLight = new THREE.PointLight(0xff6622, 6.0 * scale, 65 * scale);
      expLight.position.copy(pos);
      scene.add(expLight);

      flashCores.push({ mesh: flashMesh, light: expLight, life: 0.14, maxLife: 0.14 });

      const ringMesh = new THREE.Mesh(shockRingGeo, shockRingMat.clone());
      ringMesh.position.copy(pos);
      ringMesh.rotation.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, Math.random() * Math.PI);
      scene.add(ringMesh);
      shockwaves.push({ mesh: ringMesh, life: 0.42, maxLife: 0.42, scaleSpeed: 32.0 * scale });

      const debrisCount = Math.floor(22 * scale);
      for (let i = 0; i < debrisCount; i++) {
        const mat = debrisMats[i % debrisMats.length];
        const dMesh = new THREE.Mesh(debrisPieceGeo, mat);
        dMesh.position.copy(pos);
        dMesh.scale.setScalar((0.7 + Math.random() * 1.1) * scale);

        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 75 * scale,
          (Math.random() - 0.5) * 75 * scale,
          (Math.random() - 0.5) * 75 * scale
        );

        const spin = new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        );

        scene.add(dMesh);
        debrisList.push({ mesh: dMesh, vel, life: 0.75, maxLife: 0.75, spin });
      }

      playBuffer(audioBuffersRef.current.explode, 0.42, true);
    };

    let enemySpawnCounter = 0;

    const spawnEnemy = (forcedSide?: number) => {
      const side = forcedSide !== undefined ? forcedSide : (Math.random() > 0.5 ? 1 : -1);
      const startX = side * (65 + Math.random() * 25);
      const startY = (Math.random() - 0.5) * 12;
      const startZ = -240 - Math.random() * 40;

      const mesh = models.tie.clone();
      mesh.scale.setScalar(0.42);
      tuneTextures(mesh);
      scene.add(mesh);

      const lateralLane = (Math.random() > 0.5 ? 1 : -1) * (13 + Math.random() * 12);
      const vertLane = defaultShipPos.y + (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5);

      enemySpawnCounter++;
      const isElite = enemySpawnCounter % 2 === 0;
      const baseHp = isElite ? 6 : 4;

      enemies.push({
        mesh,
        state: 'attacking',
        pos: new THREE.Vector3(startX, startY, startZ),
        targetX: lateralLane,
        targetY: vertLane,
        speed: 40 + stageRef.current * 2 + Math.random() * 6,
        shootCooldown: isElite ? 0.7 + Math.random() * 0.5 : 1.0 + Math.random() * 0.7,
        side,
        loopProgress: 0,
        seed: Math.random() * 10,
        hp: baseHp,
        isElite
      });
    };

    let bossData: BossState | null = null;
    let bossSpawned = false;
    let bossCutsceneTimer = 0;
    let bossVictoryTimer = 0;

    const initBoss = () => {
      const grp = models.destroyer.clone();
      grp.scale.setScalar(0.001);
      grp.position.set(0, 16, -260);
      grp.rotation.set(0, Math.PI, 0);
      tuneTextures(grp);
      scene.add(grp);

      const genGeo = new THREE.SphereGeometry(1.6, 16, 12);
      const genMat1 = new THREE.MeshBasicMaterial({ color: 0x33ccff, wireframe: true });
      const genMat2 = new THREE.MeshBasicMaterial({ color: 0x33ccff, wireframe: true });

      const gen1Mesh = new THREE.Mesh(genGeo, genMat1);
      const gen2Mesh = new THREE.Mesh(genGeo, genMat2);

      const gen1Pos = new THREE.Vector3(-4.5, 9.5, -4);
      const gen2Pos = new THREE.Vector3(4.5, 9.5, -4);

      gen1Mesh.position.copy(gen1Pos);
      gen2Mesh.position.copy(gen2Pos);

      grp.add(gen1Mesh);
      grp.add(gen2Mesh);

      bossData = {
        group: grp,
        generators: [
          { mesh: gen1Mesh, localPos: gen1Pos, hp: 12, maxHp: 12, destroyed: false },
          { mesh: gen2Mesh, localPos: gen2Pos, hp: 12, maxHp: 12, destroyed: false }
        ],
        pos: new THREE.Vector3(0, 16, -260),
        speed: 12,
        shootCooldown: 1.2,
        squadCooldown: 6.0,
        bombardCooldown: 4.0,
        destroyed: false
      };
    };

    let stageIdx = 0;
    const stageRef = { current: 0 };
    let stageTimer = 0;
    const STAGE_DURATION = 135;

    let spawnTimer = 0;
    let fireCooldown = 0;
    let shakeIntensity = 0;
    let currentHp = 100;

    let isTransitionActive = false;
    let transitionDuration = 0;

    setTimeout(() => {
      if (!isDisposed) setCurtainVisible(false);
    }, 50);

    let lastTime = performance.now();

    const gameLoop = (timestamp: number) => {
      if (isDisposed) return;

      const realDt = Math.min((timestamp - lastTime) / 1000, 0.045);
      lastTime = timestamp;

      if (isPausedRef.current) {
        renderer.render(scene, camera);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const dt = realDt;

      let closestTieDistance = 999;
      for (const e of enemies) {
        const d = e.pos.distanceTo(camera.position);
        if (d < closestTieDistance) {
          closestTieDistance = d;
        }
      }

      if (tieEngineGainRef.current) {
        if (closestTieDistance < 70) {
          const factor = Math.max(0, 1 - closestTieDistance / 70);
          tieEngineGainRef.current.gain.value = factor * 0.18;
        } else {
          tieEngineGainRef.current.gain.value = 0;
        }
      }

      if (xwingGainRef.current) {
        xwingGainRef.current.gain.value = 0.14;
      }

      if (!bossSpawned && stageIdx < 4) {
        stageTimer += dt;
        if (stageTimer >= STAGE_DURATION) {
          stageTimer = 0;
          stageIdx++;
          stageRef.current = stageIdx;
          setCurrentStage(stageIdx);

          isTransitionActive = true;
          transitionDuration = 0;

          if (stageIdx % 2 === 1) {
            setBiomeTitle('ГЛУБОКИЙ КОСМОС');
          } else {
            const nextP = getUniquePlanet();
            setBiomeTitle(`СИСТЕМА ${nextP.name.toUpperCase()}`);
            spawnPlanet(nextP);
          }

          setInBiomeTransition(true);
        }
      } else if (!bossSpawned && stageIdx >= 4 && !bossCutsceneActive) {
        bossSpawned = true;
        setBossCutsceneActive(true);
        initBoss();
        bossCutsceneTimer = 0;
      }

      if (bossCutsceneActive) {
        bossCutsceneTimer += dt;

        shipPos.z -= 45 * dt;
        playerShip.position.copy(shipPos);

        camera.lookAt(playerShip.position.x, playerShip.position.y, playerShip.position.z - 20);

        if (bossData) {
          const growProgress = THREE.MathUtils.clamp((bossCutsceneTimer - 1.2) / 1.8, 0, 1);
          const easeScale = 1 - Math.pow(1 - growProgress, 3);
          bossData.group.scale.setScalar(0.001 + easeScale * 2.8);
          bossData.group.position.z += 6 * dt;
        }

        if (bossCutsceneTimer >= 4.0) {
          setBossCutsceneActive(false);
          shipPos.set(0, -1.2, 0);
          playerShip.position.copy(shipPos);
          camera.position.copy(cameraBase);
        }

        renderer.render(scene, camera);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      if (bossVictoryActive) {
        bossVictoryTimer += dt;

        shipPos.z -= 160 * dt;
        playerShip.position.copy(shipPos);

        camera.position.set(
          cameraBase.x + 18,
          cameraBase.y + 14,
          shipPos.z + 18
        );
        camera.lookAt(playerShip.position);

        if (bossData) {
          if (Math.random() < 0.3) {
            const expPos = bossData.group.position.clone().add(
              new THREE.Vector3((Math.random() - 0.5) * 35, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 50)
            );
            spawnRetroExplosion(expPos, 1.6);
          }
        }

        if (bossVictoryTimer >= 2.5 && !curtainVisible) {
          setCurtainVisible(true);
        }

        if (bossVictoryTimer >= 3.8) {
          onExit();
          return;
        }

        renderer.render(scene, camera);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      if (isTransitionActive) {
        transitionDuration += dt;
        if (transitionDuration >= 3.0) {
          isTransitionActive = false;
          setInBiomeTransition(false);
        }
      }

      const activeSpeed = 160;
      for (let k = 0; k < starCount; k++) {
        const idx = k * 3 + 2;
        starPos[idx] += activeSpeed * dt;
        if (starPos[idx] > camera.position.z + 10) {
          starPos[idx] = -1600;
          starPos[k * 3] = (Math.random() - 0.5) * 1400;
          starPos[k * 3 + 1] = (Math.random() - 0.5) * 900;
        }
      }
      starGeo.attributes.position.needsUpdate = true;

      for (let i = planetMeshes.length - 1; i >= 0; i--) {
        const pl = planetMeshes[i];
        const pSpeed = pl.userData.speed || 38;
        pl.position.z += pSpeed * dt;
        pl.rotation.y += 0.001 * dt;
        if (pl.position.z > camera.position.z + pl.userData.radius + 60) {
          scene.remove(pl);
          pl.geometry.dispose();
          planetMeshes.splice(i, 1);
        }
      }

      const input = isTransitionActive ? { x: 0, y: 0, fire: false } : inputRef.current;
      const aspect = window.innerWidth / window.innerHeight;
      const xRange = Math.max(5.2, Math.min(16.0, 10.0 * aspect * 1.05));
      const yRange = 8.5;

      const targetX = input.x * xRange;
      const targetY = defaultShipPos.y + input.y * yRange;

      const followDamp = 1 - Math.exp(-5.2 * dt);
      const nextX = THREE.MathUtils.lerp(shipPos.x, targetX, followDamp);
      const nextY = THREE.MathUtils.lerp(shipPos.y, targetY, followDamp);

      shipVx = (nextX - shipPos.x) / Math.max(dt, 0.001);
      shipVy = (nextY - shipPos.y) / Math.max(dt, 0.001);

      shipPos.x = nextX;
      shipPos.y = nextY;

      playerShip.position.copy(shipPos);

      const bankTarget = Math.max(-0.65, Math.min(0.65, -shipVx * 0.038));
      const pitchTarget = Math.max(-0.4, Math.min(0.4, -shipVy * 0.024));

      shipBank = THREE.MathUtils.lerp(shipBank, bankTarget, 1 - Math.exp(-6.5 * dt));
      shipPitch = THREE.MathUtils.lerp(shipPitch, pitchTarget, 1 - Math.exp(-6.5 * dt));

      playerShip.rotation.set(shipPitch, 0, shipBank);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraBase.x + shipPos.x * 0.32, 1 - Math.exp(-6.0 * dt));
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraBase.y + (shipPos.y - defaultShipPos.y) * 0.32, 1 - Math.exp(-6.0 * dt));

      let autoTargetPos: THREE.Vector3 | null = null;
      let minLockDist = 240;

      for (const e of enemies) {
        if (e.state === 'attacking' && e.pos.z < shipPos.z - 2) {
          const d = e.pos.distanceTo(shipPos);
          if (d < minLockDist) {
            minLockDist = d;
            autoTargetPos = e.pos;
          }
        }
      }

      if (bossData && !bossData.destroyed) {
        for (const gen of bossData.generators) {
          if (!gen.destroyed) {
            const worldGPos = new THREE.Vector3();
            gen.mesh.getWorldPosition(worldGPos);
            const d = worldGPos.distanceTo(shipPos);
            if (d < minLockDist) {
              minLockDist = d;
              autoTargetPos = worldGPos;
            }
          }
        }
      }

      const shipForward = new THREE.Vector3(0, 0, -1).applyEuler(playerShip.rotation).normalize();
      const defaultAimDistance = 140;
      let bulletAimTarget = shipPos.clone().addScaledVector(shipForward, defaultAimDistance);

      if (autoTargetPos) {
        bulletAimTarget.copy(autoTargetPos);
        const crossZ = -50;
        const crossT = (crossZ - camera.position.z) / (autoTargetPos.z - camera.position.z);
        const lockX = camera.position.x + (autoTargetPos.x - camera.position.x) * crossT;
        const lockY = camera.position.y + (autoTargetPos.y - camera.position.y) * crossT;

        crosshairTex.position.set(lockX, lockY, crossZ);
        (crosshairTex.material as THREE.MeshBasicMaterial).color.setHex(0xff3838);
        crosshairTex.scale.setScalar(0.72);
      } else {
        const crossZ = -50;
        const crossT = (crossZ - shipPos.z) / (bulletAimTarget.z - shipPos.z);
        const crossX = shipPos.x + (bulletAimTarget.x - shipPos.x) * crossT;
        const crossY = shipPos.y + (bulletAimTarget.y - shipPos.y) * crossT;

        crosshairTex.position.set(crossX, crossY, crossZ);
        (crosshairTex.material as THREE.MeshBasicMaterial).color.setHex(0x64b5f6);
        crosshairTex.scale.setScalar(1.0);
      }

      fireCooldown -= dt;

      if (input.fire && fireCooldown <= 0) {
        fireCooldown = 0.25;

        const leftOffset = new THREE.Vector3(-0.46, 0, -0.3).applyQuaternion(playerShip.quaternion);
        const rightOffset = new THREE.Vector3(0.46, 0, -0.3).applyQuaternion(playerShip.quaternion);

        const leftPos = shipPos.clone().add(leftOffset);
        const rightPos = shipPos.clone().add(rightOffset);

        const leftDir = new THREE.Vector3().subVectors(bulletAimTarget, leftPos).normalize();
        const rightDir = new THREE.Vector3().subVectors(bulletAimTarget, rightPos).normalize();

        const lMesh1 = new THREE.Mesh(redLaserGeo, redLaserMat);
        lMesh1.position.copy(leftPos);
        lMesh1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), leftDir);
        scene.add(lMesh1);
        lasers.push({ mesh: lMesh1, vel: leftDir.multiplyScalar(640), life: 1.0, isEnemy: false });

        const lMesh2 = new THREE.Mesh(redLaserGeo, redLaserMat);
        lMesh2.position.copy(rightPos);
        lMesh2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), rightDir);
        scene.add(lMesh2);
        lasers.push({ mesh: lMesh2, vel: rightDir.multiplyScalar(640), life: 1.0, isEnemy: false });

        playBuffer(audioBuffersRef.current.xwingShot, 0.28);
      }

      const maxSimultaneousEnemies = Math.min(6, 2 + stageIdx);

      if (!isTransitionActive && !bossData) {
        spawnTimer += dt;
        if (spawnTimer > Math.max(2.4, 4.5 - stageIdx * 0.45)) {
          spawnTimer = 0;
          if (enemies.length < maxSimultaneousEnemies) {
            spawnEnemy();
          }
        }
      }

      if (bossData && !bossData.destroyed) {
        bossData.pos.z += bossData.speed * dt;
        bossData.group.position.copy(bossData.pos);

        bossData.shootCooldown -= dt;
        if (bossData.shootCooldown <= 0) {
          bossData.shootCooldown = 1.4;
          for (const s of [-8, 8]) {
            const origin = bossData.pos.clone().add(new THREE.Vector3(s, 2, 20));
            const targetWithSpread = shipPos.clone().add(
              new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, 0)
            );
            const bDir = new THREE.Vector3().subVectors(targetWithSpread, origin).normalize();
            const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
            lMesh.position.copy(origin);
            lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), bDir);
            scene.add(lMesh);
            lasers.push({ mesh: lMesh, vel: bDir.multiplyScalar(170), life: 2.5, isEnemy: true });
          }
          playBuffer(audioBuffersRef.current.tieShot, 0.22, true);
        }

        bossData.squadCooldown -= dt;
        if (bossData.squadCooldown <= 0) {
          bossData.squadCooldown = 14.0;
          const squadCount = Math.min(6, 4 + Math.floor(Math.random() * 3));
          for (let k = 0; k < squadCount; k++) {
            setTimeout(() => {
              if (!isDisposed && !bossVictoryActive) {
                spawnEnemy(k % 2 === 0 ? -1 : 1);
              }
            }, k * 280);
          }
        }

        bossData.bombardCooldown -= dt;
        if (bossData.bombardCooldown <= 0) {
          bossData.bombardCooldown = 6.5;
          for (let b = 0; b < 4; b++) {
            setTimeout(() => {
              if (!isDisposed && !bossVictoryActive) {
                const bOrigin = bossData!.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, 4, 10));
                const bDir = new THREE.Vector3().subVectors(shipPos, bOrigin).normalize();
                const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
                lMesh.position.copy(bOrigin);
                lMesh.scale.set(1.6, 1.6, 1.4);
                lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), bDir);
                scene.add(lMesh);
                lasers.push({ mesh: lMesh, vel: bDir.multiplyScalar(190), life: 2.2, isEnemy: true });
                shakeIntensity = Math.max(shakeIntensity, 0.4);
              }
            }, b * 160);
          }
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const jitterX = Math.sin(timestamp * 0.015 + e.seed) * 0.12;
        const jitterY = Math.cos(timestamp * 0.018 + e.seed * 2) * 0.09;
        const jitterRoll = Math.sin(timestamp * 0.012 + e.seed) * 0.06;

        if (e.state === 'attacking') {
          e.pos.z += e.speed * dt;
          e.pos.x = THREE.MathUtils.lerp(e.pos.x, e.targetX, dt * 0.95);
          e.pos.y = THREE.MathUtils.lerp(e.pos.y, e.targetY, dt * 0.95);

          const moveDir = new THREE.Vector3(e.targetX - e.pos.x, e.targetY - e.pos.y, 40).normalize();
          e.mesh.position.set(e.pos.x + jitterX, e.pos.y + jitterY, e.pos.z);
          e.mesh.lookAt(e.pos.clone().add(moveDir));
          e.mesh.rotation.z = -(e.targetX - e.pos.x) * 0.05 + jitterRoll;

          const distToCam = e.pos.distanceTo(camera.position);
          if (distToCam < 18) {
            const flybyFactor = Math.pow(1 - distToCam / 18, 2);
            shakeIntensity = Math.max(shakeIntensity, flybyFactor * 0.7);
          }

          e.shootCooldown -= dt;
          if (e.shootCooldown <= 0 && e.pos.z < shipPos.z - 18 && e.pos.z > -160) {
            e.shootCooldown = e.isElite ? 0.8 + Math.random() * 0.5 : 1.1 + Math.random() * 0.7;
            const spreadX = (Math.random() - 0.5) * (e.isElite ? 3.0 : 4.5);
            const spreadY = (Math.random() - 0.5) * (e.isElite ? 2.0 : 3.0);
            const targetWithSpread = shipPos.clone().add(new THREE.Vector3(spreadX, spreadY, 0));

            const baseLaserDir = new THREE.Vector3().subVectors(targetWithSpread, e.pos).normalize();

            for (const s of [-0.32, 0.32]) {
              const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
              lMesh.position.set(e.pos.x + s, e.pos.y - 0.05, e.pos.z + 0.8);
              lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), baseLaserDir);
              scene.add(lMesh);
              lasers.push({ mesh: lMesh, vel: baseLaserDir.clone().multiplyScalar(155), life: 2.2, isEnemy: true });
            }

            const distVolume = Math.max(0, Math.min(0.24, (1 - distToCam / 85) * 0.24));
            if (distVolume > 0.02) {
              playBuffer(audioBuffersRef.current.tieShot, distVolume, true);
            }
          }

          if (e.pos.z > camera.position.z + 16) {
            e.state = 'looping_out';
            e.loopProgress = 0;
          }
        } else if (e.state === 'looping_out') {
          e.loopProgress += dt * 0.7;
          e.pos.x += e.side * 36 * dt;
          e.pos.y += Math.sin(e.loopProgress * 3) * 4 * dt;
          e.pos.z += 18 * (1 - e.loopProgress) * dt;

          e.mesh.position.set(e.pos.x + jitterX, e.pos.y + jitterY, e.pos.z);
          e.mesh.rotation.z = e.side * 0.6 + jitterRoll;
          e.mesh.rotation.y = e.side * e.loopProgress * 1.5;

          if (e.loopProgress >= 1.0) {
            e.state = 'looping_back';
            e.loopProgress = 0;
          }
        } else if (e.state === 'looping_back') {
          e.loopProgress += dt * 0.65;
          e.pos.z -= 90 * dt;
          e.pos.x = THREE.MathUtils.lerp(e.pos.x, e.side * 42, dt * 1.2);

          e.mesh.position.set(e.pos.x + jitterX, e.pos.y + jitterY, e.pos.z);
          e.mesh.rotation.y = Math.PI;
          e.mesh.rotation.z = -e.side * 0.4 + jitterRoll;

          if (e.pos.z < -220) {
            e.state = 'attacking';
            e.pos.z = -230;
            e.pos.x = e.side * (65 + Math.random() * 20);
            e.targetX = (Math.random() > 0.5 ? 1 : -1) * (13 + Math.random() * 12);
            e.targetY = defaultShipPos.y + (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5);
            e.shootCooldown = 1.0 + Math.random() * 0.7;
          }
        }
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.life -= dt;
        l.mesh.position.addScaledVector(l.vel, dt);

        if (l.isEnemy) {
          if (l.mesh.position.distanceTo(shipPos) < 1.1) {
            l.life = 0;
            shakeIntensity = 0.5;
            currentHp = Math.max(0, currentHp - 5);
            setHp(currentHp);
            if (currentHp <= 0) {
              setCurtainVisible(true);
              setTimeout(() => onExit(), 500);
            }
          }
        } else {
          let hitAny = false;

          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (l.mesh.position.distanceTo(e.pos) < 3.8) {
              l.life = 0;
              hitAny = true;
              e.hp -= 1;

              if (e.hp <= 0) {
                spawnRetroExplosion(e.pos);
                shakeIntensity = Math.max(shakeIntensity, 0.8);
                scene.remove(e.mesh);
                enemies.splice(j, 1);
              }
              break;
            }
          }

          if (!hitAny && bossData && !bossData.destroyed) {
            for (const gen of bossData.generators) {
              if (!gen.destroyed) {
                const worldGPos = new THREE.Vector3();
                gen.mesh.getWorldPosition(worldGPos);
                if (l.mesh.position.distanceTo(worldGPos) < 4.2) {
                  l.life = 0;
                  hitAny = true;
                  gen.hp -= 1;

                  if (gen.hp <= 0) {
                    gen.destroyed = true;
                    spawnRetroExplosion(worldGPos, 1.8);
                    gen.mesh.visible = false;

                    const allGensDown = bossData.generators.every((g) => g.destroyed);
                    if (allGensDown) {
                      bossData.destroyed = true;
                      setBossVictoryActive(true);
                      bossVictoryTimer = 0;
                    }
                  }
                  break;
                }
              }
            }
          }
        }

        if (l.life <= 0) {
          scene.remove(l.mesh);
          lasers.splice(i, 1);
        }
      }

      for (let i = flashCores.length - 1; i >= 0; i--) {
        const f = flashCores[i];
        f.life -= dt;
        const progress = 1 - f.life / f.maxLife;
        f.mesh.scale.setScalar(2.2 + progress * 3.5);
        f.light.intensity = (f.life / f.maxLife) * 6.0;
        if (f.life <= 0) {
          scene.remove(f.mesh);
          scene.remove(f.light);
          flashCores.splice(i, 1);
        }
      }

      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];
        s.life -= dt;
        const progress = 1 - s.life / s.maxLife;
        s.mesh.scale.setScalar(1.0 + progress * s.scaleSpeed);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (s.life / s.maxLife) * 0.95);
        if (s.life <= 0) {
          scene.remove(s.mesh);
          shockwaves.splice(i, 1);
        }
      }

      for (let i = debrisList.length - 1; i >= 0; i--) {
        const d = debrisList[i];
        d.life -= dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.vel.multiplyScalar(1 - 2.2 * dt);
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
        d.mesh.rotation.z += d.spin.z * dt;
        const scaleProgress = Math.max(0, d.life / d.maxLife);
        d.mesh.scale.setScalar(scaleProgress);
        if (d.life <= 0) {
          scene.remove(d.mesh);
          debrisList.splice(i, 1);
        }
      }

      if (shakeIntensity > 0) {
        camera.position.set(
          camera.position.x + (Math.random() - 0.5) * shakeIntensity,
          camera.position.y + (Math.random() - 0.5) * shakeIntensity,
          cameraBase.z + (Math.random() - 0.5) * shakeIntensity
        );
        shakeIntensity = Math.max(0, shakeIntensity - dt * 2.8);
      } else {
        camera.position.z = cameraBase.z;
      }

      camera.lookAt(shipPos.x * 0.18, shipPos.y * 0.18 + 0.3, -45);
      camera.rotateZ(-shipBank * 0.1);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(gameLoop);
    };

    const handleResize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(gameLoop);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      lasers.forEach((l) => scene.remove(l.mesh));
      enemies.forEach((e) => scene.remove(e.mesh));
      planetMeshes.forEach((pl) => scene.remove(pl));
      debrisList.forEach((d) => scene.remove(d.mesh));
      shockwaves.forEach((s) => scene.remove(s.mesh));
      flashCores.forEach((f) => {
        scene.remove(f.mesh);
        scene.remove(f.light);
      });
      if (bossData) {
        scene.remove(bossData.group);
      }
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [models, onExit]);

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransition || isPaused || bossCutsceneActive || bossVictoryActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickTouchId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickActive(true);
    handleStickMove(e);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransition || isPaused || bossCutsceneActive || bossVictoryActive || stickTouchId.current !== e.pointerId) return;
    const dx = e.clientX - stickCenter.current.x;
    const dy = e.clientY - stickCenter.current.y;
    const maxRadius = 55;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const normDist = Math.pow(clampedDist / maxRadius, 1.25);
    const nx = Math.cos(angle) * normDist;
    const ny = -Math.sin(angle) * normDist;

    setJoystickOffset({ x: Math.cos(angle) * clampedDist, y: Math.sin(angle) * clampedDist });
    inputRef.current.x = nx;
    inputRef.current.y = ny;
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickTouchId.current !== e.pointerId) return;
    stickTouchId.current = null;
    setJoystickActive(false);
    setJoystickOffset({ x: 0, y: 0 });
    inputRef.current.x = 0;
    inputRef.current.y = 0;
  };

  const handleTogglePause = () => {
    setIsFiring(false);
    setIsPaused((prev) => !prev);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleQuit = () => {
    setCurtainVisible(true);
    setTimeout(() => {
      onExit();
    }, 450);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <style>{`
        .game-curtain {
          position: absolute;
          inset: 0;
          background-color: #000000;
          pointer-events: none;
          transition: opacity 0.5s ease-in-out;
          z-index: 50;
        }
        .curtain-black {
          opacity: 1;
        }
        .curtain-clear {
          opacity: 0;
        }
        .tfu-hud {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
          transition: opacity 0.4s ease;
        }
        .tfu-hud.hidden-hud {
          opacity: 0;
        }
        .tfu-hp-container {
          position: absolute;
          top: 14px;
          left: 18px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .tfu-hp-label {
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #ff4757;
          text-shadow: 0 1px 3px #000;
        }
        .tfu-hp-frame {
          width: min(220px, 30vw);
          height: 13px;
          background-color: rgba(58, 5, 8, 0.75);
          border: 1px solid #ff4757;
          box-shadow: 0 0 0 1px #000, 0 4px 10px rgba(0, 0, 0, 0.85);
          padding: 1px;
          clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%);
        }
        .tfu-hp-fill {
          height: 100%;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%);
          transition: width 0.15s ease-out;
        }
        .tfu-progress-tracker {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tracker-node {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1.5px solid #5a738e;
          background: #09131d;
          transition: all 0.3s;
        }
        .tracker-node.active {
          border-color: #64b5f6;
          background: #2196f3;
          box-shadow: 0 0 8px #2196f3;
        }
        .tracker-line {
          width: 18px;
          height: 2px;
          background: #233446;
        }
        .tracker-line.active {
          background: #64b5f6;
        }
        .tracker-boss {
          width: 12px;
          height: 12px;
          transform: rotate(45deg);
          border: 1.5px solid #ff4757;
          background: #200508;
          transition: all 0.3s;
        }
        .tracker-boss.active {
          border-color: #ff3838;
          background: #ff3838;
          box-shadow: 0 0 10px #ff3838;
        }
        .tfu-pause-btn {
          position: absolute;
          top: 12px;
          right: 18px;
          background: linear-gradient(180deg, #3d586e 0%, #15202b 100%);
          border: 1px solid #6e8fa8;
          color: #8faec4;
          padding: 4px 22px;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          height: 28px;
          pointer-events: auto;
        }
        .tfu-pause-btn:active {
          filter: brightness(1.2);
        }
        .tfu-pause-btn svg {
          width: 14px;
          height: 14px;
          fill: currentColor;
        }
        .tfu-joystick-zone {
          position: absolute;
          left: 25px;
          bottom: 20px;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(20, 35, 55, 0.4) 0%, rgba(5, 12, 20, 0.2) 70%, transparent 100%);
          border: 2px solid rgba(120, 160, 200, 0.35);
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          touch-action: none;
          opacity: 0.35;
          transition: opacity 0.2s ease;
        }
        .tfu-joystick-zone.active {
          opacity: 0.95;
          border-color: rgba(120, 180, 255, 0.8);
        }
        .tfu-joystick-knob {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: linear-gradient(180deg, #415b76 0%, #1a2735 100%);
          border: 2px solid #8faec4;
          box-shadow: 0 4px 10px rgba(0,0,0,0.9);
          pointer-events: none;
        }
        .tfu-fire-btn {
          position: absolute;
          right: 30px;
          bottom: 25px;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          border: 2px solid #ff6b81;
          box-shadow: 0 0 0 1px #000, 0 6px 14px rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          cursor: pointer;
          touch-action: none;
        }
        .tfu-fire-btn:active {
          transform: scale(0.94);
          filter: brightness(1.2);
        }
        .tfu-fire-btn svg {
          width: 32px;
          height: 32px;
          fill: #ffffff;
          filter: drop-shadow(0 2px 4px #000);
        }
        .letterbox-bar {
          position: absolute;
          left: 0;
          right: 0;
          background-color: #000000;
          z-index: 40;
          transition: height 0.45s ease-out;
          pointer-events: none;
        }
        .letterbox-top {
          top: 0;
          height: 0;
        }
        .letterbox-bottom {
          bottom: 0;
          height: 0;
        }
        .letterbox-active.letterbox-top,
        .letterbox-active.letterbox-bottom {
          height: 18%;
        }
        .biome-banner {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          pointer-events: none;
          z-index: 45;
          opacity: 0;
          transition: opacity 0.5s ease-in-out;
        }
        .biome-banner.show-banner {
          opacity: 1;
        }
        .biome-text {
          font-family: Arial, sans-serif;
          font-size: clamp(20px, 4vw, 30px);
          font-weight: 800;
          letter-spacing: 6px;
          color: #ffffff;
          text-transform: uppercase;
        }
        .biome-subtext {
          font-family: Arial, sans-serif;
          font-size: clamp(10px, 2vw, 13px);
          font-weight: bold;
          letter-spacing: 4px;
          color: #ff6b81;
          text-transform: uppercase;
        }
        .victory-text {
          font-family: Arial, sans-serif;
          font-size: clamp(28px, 6vw, 46px);
          font-weight: 900;
          letter-spacing: 8px;
          color: #2ed573;
          text-transform: uppercase;
        }
        .pause-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          z-index: 46;
          pointer-events: auto;
        }
        .pause-title {
          font-family: Arial, sans-serif;
          font-size: clamp(22px, 4.5vw, 32px);
          font-weight: 900;
          letter-spacing: 5px;
          color: #ffffff;
          text-transform: uppercase;
        }
        .pause-menu-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: min(340px, 75vw);
        }
        .pause-button {
          width: 100%;
          height: 38px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .pause-btn-primary {
          border: 2px solid #e2e8f0;
          box-shadow: 0 0 0 1px #200000, 0 4px 10px rgba(0, 0, 0, 0.9);
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          color: #ffffff;
        }
        .pause-btn-secondary {
          border: 2px solid #b2c2d4;
          box-shadow: 0 0 0 1px #111a24, 0 3px 8px rgba(0, 0, 0, 0.75);
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%);
          color: #0b141e;
        }
      `}</style>

      <div className={`game-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />

      <div
        className={`letterbox-bar letterbox-top ${
          inBiomeTransition || isPaused || bossCutsceneActive || bossVictoryActive ? 'letterbox-active' : ''
        }`}
      />
      <div
        className={`letterbox-bar letterbox-bottom ${
          inBiomeTransition || isPaused || bossCutsceneActive || bossVictoryActive ? 'letterbox-active' : ''
        }`}
      />

      <div className={`biome-banner ${inBiomeTransition && !isPaused ? 'show-banner' : ''}`}>
        <div className="biome-text">{biomeTitle}</div>
      </div>

      <div className={`biome-banner ${bossCutsceneActive ? 'show-banner' : ''}`}>
        <div className="biome-text">ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ</div>
        <div className="biome-subtext">ВЫХОДИТ ИЗ ГИПЕРПРОСТРАНСТВА</div>
      </div>

      <div className={`biome-banner ${bossVictoryActive ? 'show-banner' : ''}`}>
        <div className="victory-text">ПОБЕДА!</div>
      </div>

      {isPaused && (
        <div className="pause-overlay">
          <div className="pause-title">ИГРА НА ПАУЗЕ</div>
          <div className="pause-menu-list">
            <button type="button" className="pause-button pause-btn-primary" onClick={handleResume}>
              ПРОДОЛЖИТЬ
            </button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={handleQuit}>
              ВЫЙТИ
            </button>
          </div>
        </div>
      )}

      <div
        className={`tfu-hud ${
          inBiomeTransition || isPaused || bossCutsceneActive || bossVictoryActive ? 'hidden-hud' : ''
        }`}
      >
        <div className="tfu-hp-container">
          <div className="tfu-hp-label">HULL INTEGRITY</div>
          <div className="tfu-hp-frame">
            <div className="tfu-hp-fill" style={{ width: `${hp}%` }} />
          </div>
        </div>

        <div className="tfu-progress-tracker">
          <div className={`tracker-node ${currentStage >= 0 ? 'active' : ''}`} />
          <div className={`tracker-line ${currentStage >= 1 ? 'active' : ''}`} />
          <div className={`tracker-node ${currentStage >= 1 ? 'active' : ''}`} />
          <div className={`tracker-line ${currentStage >= 2 ? 'active' : ''}`} />
          <div className={`tracker-node ${currentStage >= 2 ? 'active' : ''}`} />
          <div className={`tracker-line ${currentStage >= 3 ? 'active' : ''}`} />
          <div className={`tracker-node ${currentStage >= 3 ? 'active' : ''}`} />
          <div className={`tracker-line ${currentStage >= 4 ? 'active' : ''}`} />
          <div className={`tracker-boss ${currentStage >= 4 ? 'active' : ''}`} />
        </div>

        <button type="button" className="tfu-pause-btn" onClick={handleTogglePause}>
          <svg viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>

        <div
          className={`tfu-joystick-zone ${joystickActive ? 'active' : ''}`}
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickPointerUp}
          onPointerCancel={handleStickPointerUp}
        >
          <div
            className="tfu-joystick-knob"
            style={{
              transform: `translate(${joystickOffset.x}px, ${joystickOffset.y}px)`,
            }}
          />
        </div>

        <button
          type="button"
          className="tfu-fire-btn"
          onPointerDown={() => {
            if (!inBiomeTransition && !isPaused && !bossCutsceneActive && !bossVictoryActive) setIsFiring(true);
          }}
          onPointerUp={() => setIsFiring(false)}
          onPointerCancel={() => setIsFiring(false)}
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 2C9.5 2 7.5 4 7.5 6.5v9l4.5 4.5 4.5-4.5v-9C16.5 4 14.5 2 12 2zm0 3c.8 0 1.5.7 1.5 1.5v6h-3v-6c0-.8.7-1.5 1.5-1.5z" />
          </svg>
        </button>
      </div>

      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
