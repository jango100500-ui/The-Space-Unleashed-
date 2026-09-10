import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PreloadedModels } from '../App.tsx';

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
}

interface Laser {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  isEnemy: boolean;
}

interface GifExplosion {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
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
  const [gifExplosions, setGifExplosions] = useState<GifExplosion[]>([]);

  const inputRef = useRef<{ x: number; y: number; fire: boolean }>({ x: 0, y: 0, fire: false });
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    } catch {
      return;
    }
  }, []);

  const playTone = (freq: number, endFreq: number, dur: number, vol = 0.15, type: OscillatorType = 'sawtooth') => {
    if (!audioCtxRef.current) return;
    try {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      const t = audioCtxRef.current.currentTime;
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start(t);
      osc.stop(t + dur);
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

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 5500);
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

    const firstPlanet = availablePlanets[Math.floor(Math.random() * availablePlanets.length)];
    spawnPlanet(firstPlanet);

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

    const redLaserGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.6, 4);
    redLaserGeo.rotateX(Math.PI / 2);
    const redLaserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    const greenLaserGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 4);
    greenLaserGeo.rotateX(Math.PI / 2);
    const greenLaserMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });

    const lasers: Laser[] = [];
    const enemies: Enemy[] = [];

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

      enemies.push({
        mesh,
        state: 'attacking',
        pos: new THREE.Vector3(startX, startY, startZ),
        targetX: lateralLane,
        targetY: vertLane,
        speed: 42 + Math.random() * 8,
        shootCooldown: 0.8 + Math.random() * 0.8,
        side,
        loopProgress: 0,
        seed: Math.random() * 10,
        hp: 4
      });
    };

    spawnEnemy(-1);
    spawnEnemy(1);

    let spawnTimer = 0;
    let fireCooldown = 0;
    let shakeIntensity = 0;
    let currentHp = 100;

    let biomeTimer = 0;
    let biomeInterval = 65 + Math.random() * 10;
    let isTransitionActive = false;
    let transitionDuration = 0;

    setTimeout(() => {
      if (!isDisposed) setCurtainVisible(false);
    }, 50);

    let lastTime = performance.now();

    const triggerGifExplosion = (worldPos: THREE.Vector3) => {
      const p = worldPos.clone().project(camera);
      const screenX = (p.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-p.y * 0.5 + 0.5) * window.innerHeight;
      const dist = Math.max(10, worldPos.distanceTo(camera.position));
      const size = Math.max(90, Math.min(280, (900 / dist) * 12));
      const rotation = Math.floor(Math.random() * 360);
      const id = Date.now() + Math.random();

      setGifExplosions((prev) => [...prev, { id, x: screenX, y: screenY, size, rotation }]);

      setTimeout(() => {
        setGifExplosions((prev) => prev.filter((exp) => exp.id !== id));
      }, 750);
    };

    const gameLoop = (timestamp: number) => {
      if (isDisposed) return;

      const dt = Math.min((timestamp - lastTime) / 1000, 0.045);
      lastTime = timestamp;

      biomeTimer += dt;
      if (!isTransitionActive && biomeTimer >= biomeInterval) {
        isTransitionActive = true;
        transitionDuration = 0;

        const nextPlanet = availablePlanets[Math.floor(Math.random() * availablePlanets.length)];
        setBiomeTitle(`СИСТЕМА ${nextPlanet.name.toUpperCase()}`);
        setInBiomeTransition(true);

        spawnPlanet(nextPlanet);
      }

      if (isTransitionActive) {
        transitionDuration += dt;
        if (transitionDuration >= 3.0) {
          isTransitionActive = false;
          biomeTimer = 0;
          biomeInterval = 60 + Math.random() * 15;
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

      let autoTargetEnemy: Enemy | null = null;
      let minLockDist = 240;

      for (const e of enemies) {
        if (e.state === 'attacking' && e.pos.z < shipPos.z - 2) {
          const d = e.pos.distanceTo(shipPos);
          if (d < minLockDist) {
            minLockDist = d;
            autoTargetEnemy = e;
          }
        }
      }

      const shipForward = new THREE.Vector3(0, 0, -1).applyEuler(playerShip.rotation).normalize();
      const defaultAimDistance = 140;
      let bulletAimTarget = shipPos.clone().addScaledVector(shipForward, defaultAimDistance);

      if (autoTargetEnemy) {
        bulletAimTarget.copy(autoTargetEnemy.pos);
        const crossZ = -50;
        const crossT = (crossZ - camera.position.z) / (autoTargetEnemy.pos.z - camera.position.z);
        const lockX = camera.position.x + (autoTargetEnemy.pos.x - camera.position.x) * crossT;
        const lockY = camera.position.y + (autoTargetEnemy.pos.y - camera.position.y) * crossT;

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
        lasers.push({ mesh: lMesh1, vel: leftDir.multiplyScalar(320), life: 1.2, isEnemy: false });

        const lMesh2 = new THREE.Mesh(redLaserGeo, redLaserMat);
        lMesh2.position.copy(rightPos);
        lMesh2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), rightDir);
        scene.add(lMesh2);
        lasers.push({ mesh: lMesh2, vel: rightDir.multiplyScalar(320), life: 1.2, isEnemy: false });

        playTone(920, 260, 0.075, 0.12, 'sawtooth');
      }

      if (!isTransitionActive) {
        spawnTimer += dt;
        if (spawnTimer > 4.5) {
          spawnTimer = 0;
          if (enemies.length < 2) {
            spawnEnemy();
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
            e.shootCooldown = 1.0 + Math.random() * 0.7;
            const spreadX = (Math.random() - 0.5) * 4.5;
            const spreadY = (Math.random() - 0.5) * 3.0;
            const targetWithSpread = shipPos.clone().add(new THREE.Vector3(spreadX, spreadY, 0));

            const baseLaserDir = new THREE.Vector3().subVectors(targetWithSpread, e.pos).normalize();

            for (const s of [-0.32, 0.32]) {
              const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
              lMesh.position.set(e.pos.x + s, e.pos.y - 0.05, e.pos.z + 0.8);
              lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), baseLaserDir);
              scene.add(lMesh);
              lasers.push({ mesh: lMesh, vel: baseLaserDir.clone().multiplyScalar(155), life: 2.2, isEnemy: true });
            }
            playTone(460, 130, 0.1, 0.07, 'square');
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
            playTone(160, 40, 0.2, 0.2, 'sawtooth');
            if (currentHp <= 0) {
              setCurtainVisible(true);
              setTimeout(() => onExit(), 500);
            }
          }
        } else {
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (l.mesh.position.distanceTo(e.pos) < 1.8) {
              l.life = 0;
              e.hp -= 1;
              playTone(300, 150, 0.08, 0.15, 'sawtooth');

              if (e.hp <= 0) {
                triggerGifExplosion(e.pos);
                playTone(180, 40, 0.3, 0.25, 'sawtooth');
                scene.remove(e.mesh);
                enemies.splice(j, 1);
              }
              break;
            }
          }
        }

        if (l.life <= 0) {
          scene.remove(l.mesh);
          lasers.splice(i, 1);
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
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [models, onExit]);

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransition) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickTouchId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickActive(true);
    handleStickMove(e);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransition || stickTouchId.current !== e.pointerId) return;
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
          height: 16%;
        }
        .biome-banner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
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
        .gif-explosion {
          position: absolute;
          pointer-events: none;
          z-index: 25;
          object-fit: contain;
        }
      `}</style>

      <div className={`game-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />

      {gifExplosions.map((exp) => (
        <img
          key={exp.id}
          src={`/mocs/explode.gif?t=${exp.id}`}
          alt="Explosion"
          className="gif-explosion"
          style={{
            left: `${exp.x}px`,
            top: `${exp.y}px`,
            width: `${exp.size}px`,
            height: `${exp.size}px`,
            transform: `translate(-50%, -50%) rotate(${exp.rotation}deg)`
          }}
        />
      ))}

      <div className={`letterbox-bar letterbox-top ${inBiomeTransition ? 'letterbox-active' : ''}`} />
      <div className={`letterbox-bar letterbox-bottom ${inBiomeTransition ? 'letterbox-active' : ''}`} />

      <div className={`biome-banner ${inBiomeTransition ? 'show-banner' : ''}`}>
        <div className="biome-text">{biomeTitle}</div>
      </div>

      <div className={`tfu-hud ${inBiomeTransition ? 'hidden-hud' : ''}`}>
        <div className="tfu-hp-container">
          <div className="tfu-hp-label">HULL INTEGRITY</div>
          <div className="tfu-hp-frame">
            <div className="tfu-hp-fill" style={{ width: `${hp}%` }} />
          </div>
        </div>

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
            if (!inBiomeTransition) setIsFiring(true);
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
