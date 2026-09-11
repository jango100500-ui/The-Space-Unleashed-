import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { PreloadedAssets } from '../App.tsx';
import {
  Enemy, Laser, ExplosionPart, ShockwaveRing, FlashCore, ShieldImpactEffect,
  DatapadItem, ShieldGenerator, BossZoneAttack, BossTractorBeam, BossState,
  PlanetItem, BiomeRunStep, generateBiomeRun, createProceduralPlanetTexture,
  availablePlanets, globPlanetFiles, defaultPlanets, BiomeType, GeneratorScreenTarget
} from './GameData.ts';
import GameUI from './GameUI.tsx';

interface GameScreenProps {
  assets: PreloadedAssets;
  onExit: () => void;
}

export default function GameScreen({ assets, onExit }: GameScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);
  const [hp, setHp] = useState<number>(100);
  const [healBonus, setHealBonus] = useState<number>(0);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [inBiomeTransition, setInBiomeTransition] = useState<boolean>(false);
  const [biomeTitle, setBiomeTitle] = useState<string>('');
  const [biomeSubtext, setBiomeSubtext] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [consoleInput, setConsoleInput] = useState<string>('');
  const [consoleFeedback, setConsoleFeedback] = useState<string>('');
  const [showHallwayCutscene, setShowHallwayCutscene] = useState<boolean>(false);

  const [currentStage, setCurrentStage] = useState<number>(0);
  const [stageProgressPercent, setStageProgressPercent] = useState<number>(0);
  const [bossActive, setBossActive] = useState<boolean>(false);
  const [bossShieldsDown, setBossShieldsDown] = useState<boolean>(false);
  const [bossBarMode, setBossBarMode] = useState<'shield' | 'hull' | 'raid'>('shield');
  const [bossBarPercent, setBossBarPercent] = useState<number>(100);
  const [bossCutsceneActive, setBossCutsceneActive] = useState<boolean>(false);
  const [bossVictoryActive, setBossVictoryActive] = useState<boolean>(false);
  const [showVictoryText, setShowVictoryText] = useState<boolean>(false);
  const [playerStunned, setPlayerStunned] = useState<boolean>(false);

  const [generatorTargets, setGeneratorTargets] = useState<GeneratorScreenTarget[]>([]);
  const [zoneAttackUi, setZoneAttackUi] = useState<{ visible: boolean; leftPct: number; widthPct: number }>({ visible: false, leftPct: 40, widthPct: 20 });
  const [tractorBeamUi, setTractorBeamUi] = useState<{ visible: boolean; leftPct: number; widthPct: number }>({ visible: false, leftPct: 35, widthPct: 30 });

  const isPausedRef = useRef<boolean>(false);
  const inBiomeTransitionRef = useRef<boolean>(false);
  const bossCutsceneActiveRef = useRef<boolean>(false);
  const bossVictoryActiveRef = useRef<boolean>(false);
  const inHallwayRef = useRef<boolean>(false);

  const inputRef = useRef<{ x: number; y: number; fire: boolean }>({ x: 0, y: 0, fire: false });
  const godModeRef = useRef<boolean>(false);
  const skipToStage4Ref = useRef<boolean>(false);
  const forceLightningPlayerRef = useRef<boolean>(false);
  const forceBiomeRef = useRef<BiomeType | null>(null);

  const xwingGainRef = useRef<GainNode | null>(null);
  const tieEngineGainRef = useRef<GainNode | null>(null);
  const spaceMuffleFilterRef = useRef<BiquadFilterNode | null>(null);
  const bossSoundtrackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const biomeRunRef = useRef<BiomeRunStep[]>(generateBiomeRun(availablePlanets));

  useEffect(() => {
    isPausedRef.current = isPaused || showHallwayCutscene;
    inHallwayRef.current = showHallwayCutscene;
    
    if (xwingGainRef.current && tieEngineGainRef.current) {
      if (isPaused || showHallwayCutscene) {
        xwingGainRef.current.gain.value = 0;
        tieEngineGainRef.current.gain.value = 0;
      }
    }
    
    if (bossSoundtrackSourceRef.current && assets.audioCtx) {
      if (isPaused || showHallwayCutscene) {
        if (assets.audioCtx.state === 'running') {
           assets.audioCtx.suspend();
        }
      } else {
        if (assets.audioCtx.state === 'suspended') {
           assets.audioCtx.resume();
        }
      }
    }
  }, [isPaused, showHallwayCutscene, assets.audioCtx]);

  useEffect(() => {
    const { audioCtx, audioBuffers } = assets;

    const muffle = audioCtx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 460;
    muffle.connect(audioCtx.destination);
    spaceMuffleFilterRef.current = muffle;

    let xwingSource: AudioBufferSourceNode | null = null;
    let tieSource: AudioBufferSourceNode | null = null;

    if (audioBuffers.xwingEngine) {
      xwingSource = audioCtx.createBufferSource();
      xwingSource.buffer = audioBuffers.xwingEngine;
      xwingSource.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.14;
      xwingSource.connect(gain);
      gain.connect(muffle);
      xwingSource.start(0);
      xwingGainRef.current = gain;
    }

    if (audioBuffers.tieEngine) {
      tieSource = audioCtx.createBufferSource();
      tieSource.buffer = audioBuffers.tieEngine;
      tieSource.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      tieSource.connect(gain);
      gain.connect(muffle);
      tieSource.start(0);
      tieEngineGainRef.current = gain;
    }

    return () => {
      if (xwingSource) xwingSource.stop();
      if (tieSource) tieSource.stop();
      if (bossSoundtrackSourceRef.current) {
        try {
          bossSoundtrackSourceRef.current.stop();
        } catch {}
      }
    };
  }, [assets]);

  const playBuffer = (buffer: AudioBuffer | undefined, volume: number, useMuffle = false) => {
    if (!buffer || isPausedRef.current) return;
    try {
      const { audioCtx } = assets;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const src = audioCtx.createBufferSource();
      src.buffer = buffer;

      const gain = audioCtx.createGain();
      gain.gain.value = volume;

      src.connect(gain);
      if (useMuffle && spaceMuffleFilterRef.current) {
        gain.connect(spaceMuffleFilterRef.current);
      } else {
        gain.connect(audioCtx.destination);
      }

      src.start(0);
    } catch {
      return;
    }
  };

  const playUiSound = () => {
    playBuffer(assets.audioBuffers.click, 0.55);
  };

  useEffect(() => {
    inputRef.current.fire = isFiring;
  }, [isFiring]);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const { models, audioBuffers } = assets;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(biomeRunRef.current[0].fogColor, 0.00035);

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 8000);
    const cameraBase = new THREE.Vector3(0, 3.2, 13.0);
    camera.position.copy(cameraBase);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(biomeRunRef.current[0].fogColor);

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

    const clearAllPlanets = () => {
      for (let i = planetMeshes.length - 1; i >= 0; i--) {
        const pl = planetMeshes[i];
        scene.remove(pl);
        pl.geometry.dispose();
        planetMeshes.splice(i, 1);
      }
    };

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

    const firstStep = biomeRunRef.current[0];
    if (firstStep.type === 'planet' && firstStep.planet) {
      spawnPlanet(firstStep.planet);
    }

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
    const shockRingGreenMat = new THREE.MeshBasicMaterial({ color: 0x22ff44, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });

    const debrisPieceGeo = new THREE.DodecahedronGeometry(0.65, 0);
    const debrisMats = [
      new THREE.MeshBasicMaterial({ color: 0xffdd44 }),
      new THREE.MeshBasicMaterial({ color: 0xff5522 }),
      new THREE.MeshBasicMaterial({ color: 0xd32f2f }),
      new THREE.MeshBasicMaterial({ color: 0x8a9ba8 })
    ];
    const debrisMatsGreen = [
      new THREE.MeshBasicMaterial({ color: 0x33ff44 }),
      new THREE.MeshBasicMaterial({ color: 0x88ff66 }),
      new THREE.MeshBasicMaterial({ color: 0x11cc33 }),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    ];

    const shieldSphereGeo = new THREE.SphereGeometry(1.4, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x40c4ff,
      transparent: true,
      opacity: 0.7,
      wireframe: true
    });

    const lasers: Laser[] = [];
    const enemies: Enemy[] = [];
    const debrisList: ExplosionPart[] = [];
    const shockwaves: ShockwaveRing[] = [];
    const flashCores: FlashCore[] = [];
    const shieldImpacts: ShieldImpactEffect[] = [];
    const datapads: DatapadItem[] = [];

    const zoneAttack: BossZoneAttack = { active: false, timer: 0, duration: 1.6, xMin: -4, xMax: 4, fired: false };
    const tractorBeam: BossTractorBeam = { active: false, timer: 0, duration: 1.8, xMin: -6, xMax: 6, fired: false };

    const spawnShieldImpact = (worldPos: THREE.Vector3) => {
      const sMesh = new THREE.Mesh(shieldSphereGeo, shieldMat.clone());
      sMesh.position.copy(worldPos);
      sMesh.scale.setScalar(0.7);
      scene.add(sMesh);
      shieldImpacts.push({ mesh: sMesh, life: 0.28, maxLife: 0.28 });
    };

    const spawnRetroExplosion = (pos: THREE.Vector3, scale = 1.0, withLight = true, isGreen = false) => {
      const flashMesh = new THREE.Mesh(flashCoreGeo, flashCoreMat);
      flashMesh.position.copy(pos);
      flashMesh.scale.setScalar(2.2 * scale);
      scene.add(flashMesh);

      let expLight: THREE.PointLight | undefined = undefined;
      if (withLight) {
        expLight = new THREE.PointLight(isGreen ? 0x22ff44 : 0xff6622, 5.0 * scale, 55 * scale);
        expLight.position.copy(pos);
        scene.add(expLight);
      }

      flashCores.push({ mesh: flashMesh, light: expLight, life: 0.14, maxLife: 0.14 });

      const ringMesh = new THREE.Mesh(shockRingGeo, isGreen ? shockRingGreenMat.clone() : shockRingMat.clone());
      ringMesh.position.copy(pos);
      ringMesh.rotation.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, Math.random() * Math.PI);
      scene.add(ringMesh);
      shockwaves.push({ mesh: ringMesh, life: 0.38, maxLife: 0.38, scaleSpeed: 28.0 * scale });

      const currentDebrisMats = isGreen ? debrisMatsGreen : debrisMats;
      const debrisCount = withLight ? 16 : 8;
      for (let i = 0; i < debrisCount; i++) {
        const mat = currentDebrisMats[i % currentDebrisMats.length];
        const dMesh = new THREE.Mesh(debrisPieceGeo, mat);
        dMesh.position.copy(pos);
        dMesh.scale.setScalar((0.6 + Math.random() * 0.8) * scale);
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 60 * scale,
          (Math.random() - 0.5) * 60 * scale,
          (Math.random() - 0.5) * 60 * scale
        );
        const spin = new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
        scene.add(dMesh);
        debrisList.push({ mesh: dMesh, vel, life: 0.65, maxLife: 0.65, spin });
      }

      playBuffer(audioBuffers.explode, 0.42, true);
    };

    const spawnDatapad = (dropPos: THREE.Vector3) => {
      let dModel: THREE.Group;
      if (models.datapad) {
        dModel = models.datapad.clone();
      } else {
        dModel = new THREE.Group();
        dModel.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x3399ff, emissive: 0x113355 })));
      }
      dModel.scale.setScalar(0.45);
      dModel.position.copy(dropPos);
      scene.add(dModel);

      const healAmt = Math.floor(15 + Math.random() * 11);
      datapads.push({
        mesh: dModel,
        pos: dropPos.clone(),
        rotSpeed: new THREE.Vector3(0.5 + Math.random() * 0.5, 1.2 + Math.random() * 0.8, 0.4),
        healPercent: healAmt,
        locked: false,
        searchTimer: 1.0
      });
    };

    let enemySpawnCounter = 0;

    const spawnEnemy = (forcedSide?: number, isRaid = false) => {
      const side = forcedSide !== undefined ? forcedSide : (Math.random() > 0.5 ? 1 : -1);
      const startX = side * (65 + Math.random() * 25);
      const startY = (Math.random() - 0.5) * 12;
      const startZ = -240 - Math.random() * 40;

      const baseMesh = isRaid ? (models.tie2 ? models.tie2.clone() : models.tie.clone()) : models.tie.clone();
      baseMesh.scale.setScalar(0.42);
      tuneTextures(baseMesh);
      scene.add(baseMesh);

      const lateralLane = (Math.random() > 0.5 ? 1 : -1) * (13 + Math.random() * 12);
      const vertLane = defaultShipPos.y + (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5);

      enemySpawnCounter++;
      const isElite = !isRaid && enemySpawnCounter % 2 === 0;
      const baseHp = isRaid ? 7 : isElite ? 6 : 4;

      enemies.push({
        mesh: baseMesh,
        state: 'attacking',
        pos: new THREE.Vector3(startX, startY, startZ),
        targetX: lateralLane,
        targetY: vertLane,
        speed: 40 + stageRef.current * 2 + Math.random() * 6,
        shootCooldown: isRaid ? 0.9 : isElite ? 0.7 + Math.random() * 0.5 : 1.0 + Math.random() * 0.7,
        side,
        loopProgress: 0,
        seed: Math.random() * 10,
        hp: baseHp,
        isElite,
        isRaid
      });
    };

    let bossData: BossState | null = null;
    let bossSpawned = false;
    let bossCutsceneTimer = 0;
    let bossCutsceneCamPos = new THREE.Vector3();
    let isBossExecutingSpecial = false;
    let raidCountdown = 0;
    let isRaidPreludeActive = false;

    const initBoss = () => {
      const grp = models.destroyer.clone();
      grp.scale.setScalar(0.00025);
      grp.position.set(0, 18, -380);
      grp.rotation.set(0, Math.PI, 0);
      tuneTextures(grp);
      scene.add(grp);

      const candidatePositions = [
        new THREE.Vector3(-2.2, 0.6, 3.5),
        new THREE.Vector3(2.2, 0.6, 3.5),
        new THREE.Vector3(-1.8, 1.2, 0.5),
        new THREE.Vector3(1.8, 1.2, 0.5),
        new THREE.Vector3(0, 2.2, 1.0),
        new THREE.Vector3(0, 1.6, 4.0)
      ];

      const shuffledIdx = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3);
      const generators: ShieldGenerator[] = [];

      for (let i = 0; i < 3; i++) {
        const spot = candidatePositions[shuffledIdx[i]];
        generators.push({
          id: i,
          localPos: spot,
          hp: 16,
          maxHp: 16,
          destroyed: false
        });
      }

      bossData = {
        group: grp,
        generators,
        pos: new THREE.Vector3(0, 18, -380),
        hullHp: 420,
        maxHullHp: 420,
        shootCooldown: 1.2,
        squadCooldown: 16.0,
        bombardCooldown: 5.5,
        zoneCooldown: 10.0,
        tractorCooldown: 14.0,
        destroyed: false,
        phase2Active: false,
        raidActive: false,
        raidCompleted: false
      };
    };

    let stageIdx = 0;
    const stageRef = { current: 0 };
    let stageTimer = 0;
    const STAGE_DURATION = 140;

    let spawnTimer = 0;
    let fireCooldown = 0;
    let shakeIntensity = 0;
    let currentHp = 100;

    let transitionDuration = 0;
    let lightningTimer = 0;
    let lightningInterval = 13 + Math.random() * 2;
    let playerHitByLightningOnce = false;
    let playerStunDuration = 0;
    let activeLightningMesh: THREE.Line | null = null;
    let activeLightningLife = 0;

    const triggerLightning = (forcePlayer = false) => {
      const startL = new THREE.Vector3((Math.random() - 0.5) * 120, 50 + Math.random() * 25, -120 - Math.random() * 150);
      let endL = new THREE.Vector3((Math.random() - 0.5) * 140, -40 - Math.random() * 25, -70 - Math.random() * 140);

      if (forcePlayer) {
        endL.copy(shipPos);
        playerStunDuration = 4.5;
        setPlayerStunned(true);
        shakeIntensity = 1.2;
        if (!godModeRef.current) {
          currentHp = Math.max(0, currentHp - 8);
          setHp(currentHp);
          if (currentHp <= 0) {
            setCurtainVisible(true);
            setTimeout(() => onExit(), 500);
          }
        }
      } else {
        const roll = Math.random();
        if (roll < 0.15 && enemies.length > 0) {
          const liveEnemies = enemies.filter((e) => e.state === 'attacking');
          if (liveEnemies.length > 0) {
            const victim = liveEnemies[Math.floor(Math.random() * liveEnemies.length)];
            victim.state = 'disabled';
            victim.disabledTimer = 1.4;
            endL.copy(victim.pos);
          }
        } else if (roll < 0.30 && !playerHitByLightningOnce) {
          playerHitByLightningOnce = true;
          endL.copy(shipPos);
          playerStunDuration = 4.5;
          setPlayerStunned(true);
          shakeIntensity = 1.2;
          if (!godModeRef.current) {
            currentHp = Math.max(0, currentHp - 8);
            setHp(currentHp);
            if (currentHp <= 0) {
              setCurtainVisible(true);
              setTimeout(() => onExit(), 500);
            }
          }
        }
      }

      const points: THREE.Vector3[] = [];
      const segments = 10;
      for (let s = 0; s <= segments; s++) {
        const frac = s / segments;
        const pt = new THREE.Vector3().lerpVectors(startL, endL, frac);
        if (s > 0 && s < segments) {
          pt.x += (Math.random() - 0.5) * 8;
          pt.y += (Math.random() - 0.5) * 8;
          pt.z += (Math.random() - 0.5) * 8;
        }
        points.push(pt);
      }

      if (activeLightningMesh) {
        scene.remove(activeLightningMesh);
        activeLightningMesh.geometry.dispose();
      }

      const lGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lMat = new THREE.LineBasicMaterial({ color: 0xbee8ff, linewidth: 2 });
      activeLightningMesh = new THREE.Line(lGeo, lMat);
      scene.add(activeLightningMesh);
      activeLightningLife = 0.18;
    };

    setTimeout(() => {
      if (!isDisposed) setCurtainVisible(false);
    }, 50);

    let lastTime = performance.now();

    const gameLoop = (timestamp: number) => {
      if (isDisposed) return;

      const realDt = Math.min((timestamp - lastTime) / 1000, 0.045);
      lastTime = timestamp;

      if (isPausedRef.current || inHallwayRef.current) {
        renderer.render(scene, camera);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const dt = realDt;

      if (skipToStage4Ref.current) {
        skipToStage4Ref.current = false;
        stageIdx = 3;
        stageRef.current = 3;
        setCurrentStage(3);
        stageTimer = STAGE_DURATION * 0.95;
      }

      if (forceLightningPlayerRef.current) {
        forceLightningPlayerRef.current = false;
        triggerLightning(true);
      }

      if (forceBiomeRef.current) {
        const forcedType = forceBiomeRef.current;
        forceBiomeRef.current = null;
        const targetColor = forcedType === 'ionic_vapors' ? 0x240620 : 0x0d121c;
        const titleText = forcedType === 'ionic_vapors' ? 'ИОННЫЕ ИСПАРЕНИЯ' : 'ТУМАННОСТЬ';
        biomeRunRef.current[stageIdx] = { type: forcedType, title: titleText, fogColor: targetColor };
        clearAllPlanets();
        (scene.fog as THREE.FogExp2).color.setHex(targetColor);
        renderer.setClearColor(targetColor);
        setBiomeTitle(titleText);
        setBiomeSubtext('');
        inBiomeTransitionRef.current = true;
        setInBiomeTransition(true);
        transitionDuration = 0;
      }

      if (activeLightningLife > 0) {
        activeLightningLife -= dt;
        if (activeLightningLife <= 0 && activeLightningMesh) {
          scene.remove(activeLightningMesh);
          activeLightningMesh.geometry.dispose();
          activeLightningMesh = null;
        }
      }

      const currentStep = biomeRunRef.current[stageIdx] || biomeRunRef.current[0];
      const hasLightningBiome = !bossData && !bossCutsceneActiveRef.current && (currentStep.type === 'nebula_storm' || currentStep.type === 'ionic_vapors');

      if (hasLightningBiome) {
        lightningTimer += dt;
        if (lightningTimer >= lightningInterval) {
          lightningTimer = 0;
          lightningInterval = 12 + Math.random() * 3;
          triggerLightning();
        }
      }

      if (playerStunDuration > 0) {
        playerStunDuration -= dt;
        shipPitch += dt * 1.2;
        shipBank += dt * 1.5;
        playerShip.rotation.set(shipPitch, 0, shipBank);
        if (playerStunDuration <= 0) {
          setPlayerStunned(false);
        }
      }

      if (!bossSpawned && stageIdx < 4) {
        stageTimer += dt;
        const pFrac = Math.min(1, stageTimer / STAGE_DURATION);
        setStageProgressPercent(Math.floor(pFrac * 100));

        if (stageTimer >= STAGE_DURATION) {
          stageTimer = 0;
          stageIdx++;
          stageRef.current = stageIdx;
          setCurrentStage(stageIdx);
          setStageProgressPercent(0);

          if (stageIdx < 4) {
            inBiomeTransitionRef.current = true;
            setInBiomeTransition(true);
            transitionDuration = 0;

            const step = biomeRunRef.current[stageIdx];
            setBiomeTitle(step.title);
            setBiomeSubtext('');

            const fogTarget = new THREE.Color(step.fogColor);
            (scene.fog as THREE.FogExp2).color.lerp(fogTarget, 0.8);
            renderer.setClearColor(fogTarget);

            clearAllPlanets();
            if (step.type === 'planet' && step.planet) {
              spawnPlanet(step.planet);
            }
          }
        }
      } else if (!bossSpawned && stageIdx >= 4 && !bossCutsceneActiveRef.current) {
        bossSpawned = true;
        bossCutsceneActiveRef.current = true;
        setBossCutsceneActive(true);
        bossCutsceneCamPos.copy(camera.position);
        initBoss();
        bossCutsceneTimer = 0;

        if (assets.audioBuffers.destroyerSoundtrack && !bossSoundtrackSourceRef.current) {
          try {
            const { audioCtx } = assets;
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const src = audioCtx.createBufferSource();
            src.buffer = assets.audioBuffers.destroyerSoundtrack;
            src.loop = false;
            const gain = audioCtx.createGain();
            gain.gain.value = 0.65;
            src.connect(gain);
            gain.connect(audioCtx.destination);
            src.start(0);
            bossSoundtrackSourceRef.current = src;
          } catch {}
        }
      }

      if (bossCutsceneActiveRef.current) {
        bossCutsceneTimer += dt;

        shipPos.z -= 45 * dt;
        playerShip.position.copy(shipPos);

        camera.position.copy(bossCutsceneCamPos);
        camera.lookAt(playerShip.position.x, playerShip.position.y, playerShip.position.z - 20);

        if (bossData) {
          if (bossCutsceneTimer >= 1.5) {
            const growProgress = THREE.MathUtils.clamp((bossCutsceneTimer - 1.5) / 5.5, 0, 1);
            const easeScale = 1 - Math.pow(1 - growProgress, 3);
            bossData.group.scale.setScalar(0.0001 + easeScale * 14.0);
            bossData.pos.z -= 5 * dt;
            bossData.group.position.copy(bossData.pos);
          }
        }

        if (bossCutsceneTimer >= 7.0) {
          bossCutsceneActiveRef.current = false;
          setBossCutsceneActive(false);

          shipPos.set(0, -1.2, 0);
          playerShip.position.copy(shipPos);
          camera.position.copy(cameraBase);

          setBossActive(true);
        }

        renderer.render(scene, camera);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      if (inBiomeTransitionRef.current) {
        transitionDuration += dt;
        if (transitionDuration >= 3.0) {
          inBiomeTransitionRef.current = false;
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

      const input = inBiomeTransitionRef.current || playerStunDuration > 0 ? { x: 0, y: 0, fire: false } : inputRef.current;
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

      if (playerStunDuration <= 0) {
        const bankTarget = Math.max(-0.65, Math.min(0.65, -shipVx * 0.038));
        const pitchTarget = Math.max(-0.4, Math.min(0.4, -shipVy * 0.024));

        shipBank = THREE.MathUtils.lerp(shipBank, bankTarget, 1 - Math.exp(-6.5 * dt));
        shipPitch = THREE.MathUtils.lerp(shipPitch, pitchTarget, 1 - Math.exp(-6.5 * dt));

        playerShip.rotation.set(shipPitch, 0, shipBank);
      }

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraBase.x + shipPos.x * 0.32, 1 - Math.exp(-6.0 * dt));
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraBase.y + (shipPos.y - defaultShipPos.y) * 0.32, 1 - Math.exp(-6.0 * dt));

      let autoTargetPos: THREE.Vector3 | null = null;
      let bestScore = 9999;

      if (playerStunDuration <= 0) {
        for (const e of enemies) {
          if (e.state === 'attacking' && e.pos.z < shipPos.z - 2) {
            const d = e.pos.distanceTo(shipPos);
            if (d < 220) {
              const angleDist = Math.hypot(e.pos.x - shipPos.x, e.pos.y - shipPos.y);
              const score = d + angleDist * 8;
              if (score < bestScore) {
                bestScore = score;
                autoTargetPos = e.pos;
              }
            }
          }
        }

        if (bossData && !bossData.destroyed && !bossData.raidActive) {
          bossData.group.updateMatrixWorld(true);
          const hasGenerators = bossData.generators.some((g) => !g.destroyed);

          if (hasGenerators) {
            for (const gen of bossData.generators) {
              if (!gen.destroyed) {
                const worldGPos = gen.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
                const d = worldGPos.distanceTo(shipPos);
                const angleDist = Math.hypot(worldGPos.x - shipPos.x, worldGPos.y - shipPos.y);
                const score = d * 0.3 + angleDist * 4;
                if (score < bestScore) {
                  bestScore = score;
                  autoTargetPos = worldGPos;
                }
              }
            }
          } else {
            const hullTarget = bossData.pos.clone().add(new THREE.Vector3(0, 4, 30));
            const d = hullTarget.distanceTo(shipPos);
            if (d < bestScore) {
              bestScore = d;
              autoTargetPos = hullTarget;
            }
          }
        }
      }

      const shipForward = new THREE.Vector3(0, 0, -1).applyEuler(playerShip.rotation).normalize();
      const defaultAimDistance = 140;
      let bulletAimTarget = shipPos.clone().addScaledVector(shipForward, defaultAimDistance);

      if (playerStunDuration > 0) {
        crosshairTex.visible = false;
      } else {
        crosshairTex.visible = true;
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
      }

      fireCooldown -= dt;

      if (input.fire && fireCooldown <= 0 && playerStunDuration <= 0) {
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

        playBuffer(audioBuffers.xwingShot, 0.28);
      }

      const maxSimultaneousEnemies = Math.min(6, 2 + stageIdx);

      if (!inBiomeTransitionRef.current && !bossData) {
        spawnTimer += dt;
        if (spawnTimer > Math.max(2.4, 4.5 - stageIdx * 0.45)) {
          spawnTimer = 0;
          if (enemies.length < maxSimultaneousEnemies) {
            spawnEnemy();
          }
        }
      }

      if (bossData && !bossData.destroyed) {
        bossData.pos.z = THREE.MathUtils.lerp(bossData.pos.z, shipPos.z - 360, dt * 5.0);
        bossData.group.position.copy(bossData.pos);
        bossData.group.updateMatrixWorld(true);

        const activeGenHp = bossData.generators.reduce((acc, g) => acc + (g.destroyed ? 0 : g.hp), 0);
        const totalGenHp = bossData.generators.reduce((acc, g) => acc + g.maxHp, 0);

        if (activeGenHp > 0) {
          setBossShieldsDown(false);
          setBossBarMode('shield');
          setBossBarPercent(Math.floor((activeGenHp / totalGenHp) * 100));
        } else if (!bossData.phase2Active) {
          bossData.phase2Active = true;
          setBossShieldsDown(true);
          inBiomeTransitionRef.current = true;
          setInBiomeTransition(true);
          setBiomeTitle('ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ');
          setBiomeSubtext('ФАЗА II');
          transitionDuration = 0;

          isRaidPreludeActive = true;
          raidCountdown = 5.0;
          bossData.squadCooldown = 999;
          bossData.zoneCooldown = 999;
          bossData.tractorCooldown = 999;
        } else if (isRaidPreludeActive) {
          raidCountdown -= dt;
          if (raidCountdown <= 0) {
            isRaidPreludeActive = false;
            bossData.raidActive = true;
            setBossBarMode('raid');
            setBossBarPercent(100);

            bossData.group.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (m) {
                  m.transparent = true;
                  m.opacity = 0.32;
                  m.needsUpdate = true;
                }
              }
            });

            for (let k = 0; k < 7; k++) {
              setTimeout(() => {
                if (!isDisposed) spawnEnemy(k % 2 === 0 ? -1 : 1, false);
              }, k * 220);
            }

            for (let k = 0; k < 3; k++) {
              setTimeout(() => {
                if (!isDisposed) spawnEnemy(k % 2 === 0 ? 1 : -1, true);
              }, 1600 + k * 350);
            }
          }
        } else if (bossData.raidActive) {
          setBossShieldsDown(true);
          setBossBarMode('raid');
          const remainingRaid = enemies.filter((e) => e.isRaid).length;
          setBossBarPercent(Math.floor((remainingRaid / 3) * 100));

          if (remainingRaid === 0 && !bossData.raidCompleted) {
            bossData.raidActive = false;
            bossData.raidCompleted = true;
            setBossBarMode('hull');
            bossData.squadCooldown = 16.0;
            bossData.zoneCooldown = 12.0;
            bossData.tractorCooldown = 16.0;

            bossData.group.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (m) {
                  m.transparent = false;
                  m.opacity = 1.0;
                  m.needsUpdate = true;
                }
              }
            });
          }
        } else {
          setBossShieldsDown(true);
          setBossBarMode('hull');
          setBossBarPercent(Math.floor((bossData.hullHp / bossData.maxHullHp) * 100));
        }

        const newTargetList: GeneratorScreenTarget[] = [];
        if (!bossData.phase2Active) {
          for (const gen of bossData.generators) {
            if (!gen.destroyed) {
              const worldGPos = gen.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
              const proj = worldGPos.clone().project(camera);
              if (proj.z < 1.0) {
                const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
                const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;
                newTargetList.push({ id: gen.id, x: sx, y: sy, visible: true });
              }
            }
          }
        }
        setGeneratorTargets(newTargetList);

        if (!bossData.raidActive && !isRaidPreludeActive && !bossCutsceneActiveRef.current && !inBiomeTransitionRef.current) {
          const isSpecialBusy = zoneAttack.active || tractorBeam.active || isBossExecutingSpecial;

          if (!isSpecialBusy) {
            bossData.zoneCooldown -= dt;
            bossData.tractorCooldown -= dt;
            bossData.squadCooldown -= dt;
            bossData.bombardCooldown -= dt;

            if (bossData.zoneCooldown <= 0) {
              bossData.zoneCooldown = 14.0 + Math.random() * 4.0;
              const centerLane = (Math.random() - 0.5) * 12;
              const widthZone = 8.5;
              zoneAttack.active = true;
              zoneAttack.timer = 0;
              zoneAttack.duration = 1.6;
              zoneAttack.xMin = centerLane - widthZone / 2;
              zoneAttack.xMax = centerLane + widthZone / 2;
              zoneAttack.fired = false;

              const screenAspect = window.innerWidth / window.innerHeight;
              const currentXRange = Math.max(5.2, Math.min(16.0, 10.0 * screenAspect * 1.05));
              const leftNorm = (zoneAttack.xMin + currentXRange) / (currentXRange * 2);
              const widthNorm = widthZone / (currentXRange * 2);

              setZoneAttackUi({
                visible: true,
                leftPct: Math.max(0, Math.min(100, leftNorm * 100)),
                widthPct: Math.max(5, Math.min(100, widthNorm * 100))
              });
            } else if (bossData.tractorCooldown <= 0) {
              bossData.tractorCooldown = 18.0 + Math.random() * 4.0;
              const centerLane = (Math.random() - 0.5) * 8;
              const widthTractor = 13.0;
              tractorBeam.active = true;
              tractorBeam.timer = 0;
              tractorBeam.duration = 1.8;
              tractorBeam.xMin = centerLane - widthTractor / 2;
              tractorBeam.xMax = centerLane + widthTractor / 2;
              tractorBeam.fired = false;

              const screenAspect = window.innerWidth / window.innerHeight;
              const currentXRange = Math.max(5.2, Math.min(16.0, 10.0 * screenAspect * 1.05));
              const leftNorm = (tractorBeam.xMin + currentXRange) / (currentXRange * 2);
              const widthNorm = widthTractor / (currentXRange * 2);

              setTractorBeamUi({
                visible: true,
                leftPct: Math.max(0, Math.min(100, leftNorm * 100)),
                widthPct: Math.max(5, Math.min(100, widthNorm * 100))
              });
            } else if (bossData.squadCooldown <= 0 && enemies.length === 0) {
              bossData.squadCooldown = 18.0 + Math.random() * 4.0;
              isBossExecutingSpecial = true;
              const squadCount = Math.min(6, 4 + Math.floor(Math.random() * 3));
              for (let k = 0; k < squadCount; k++) {
                setTimeout(() => {
                  if (!isDisposed) {
                    spawnEnemy(k % 2 === 0 ? -1 : 1);
                  }
                  if (k === squadCount - 1) {
                    isBossExecutingSpecial = false;
                  }
                }, k * 280);
              }
            } else if (bossData.bombardCooldown <= 0) {
              bossData.bombardCooldown = 8.0;
              isBossExecutingSpecial = true;
              for (let b = 0; b < 4; b++) {
                setTimeout(() => {
                  if (!isDisposed) {
                    const bOrigin = bossData!.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 35, 8, 20));
                    const bDir = new THREE.Vector3().subVectors(shipPos, bOrigin).normalize();
                    const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
                    lMesh.position.copy(bOrigin);
                    lMesh.scale.set(1.6, 1.6, 1.4);
                    lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), bDir);
                    scene.add(lMesh);
                    lasers.push({ mesh: lMesh, vel: bDir.multiplyScalar(190), life: 2.2, isEnemy: true });
                    shakeIntensity = Math.max(shakeIntensity, 0.4);
                  }
                  if (b === 3) {
                    isBossExecutingSpecial = false;
                  }
                }, b * 160);
              }
            }
          }

          if (zoneAttack.active) {
            zoneAttack.timer += dt;
            if (zoneAttack.timer >= zoneAttack.duration && !zoneAttack.fired) {
              zoneAttack.fired = true;
              setZoneAttackUi((prev) => ({ ...prev, visible: false }));
              shakeIntensity = Math.max(shakeIntensity, 0.85);

              const laneCenter = (zoneAttack.xMin + zoneAttack.xMax) / 2;
              const blastZ = shipPos.z - 6;

              const yPoints = [10, 2, -6];
              yPoints.forEach((yPos, idx) => {
                setTimeout(() => {
                  if (!isDisposed) {
                    spawnRetroExplosion(new THREE.Vector3(laneCenter, yPos, blastZ), 1.6, false, true);
                  }
                }, idx * 75);
              });

              if (shipPos.x >= zoneAttack.xMin && shipPos.x <= zoneAttack.xMax) {
                if (godModeRef.current) {
                  spawnShieldImpact(shipPos);
                } else {
                  currentHp = Math.max(0, currentHp - 18);
                  setHp(currentHp);
                  if (currentHp <= 0) {
                    setCurtainVisible(true);
                    setTimeout(() => onExit(), 500);
                  }
                }
              }

              setTimeout(() => {
                zoneAttack.active = false;
              }, 350);
            }
          }

          if (tractorBeam.active) {
            tractorBeam.timer += dt;
            if (tractorBeam.timer >= tractorBeam.duration && !tractorBeam.fired) {
              tractorBeam.fired = true;
              setTractorBeamUi((prev) => ({ ...prev, visible: false }));

              if (shipPos.x >= tractorBeam.xMin && shipPos.x <= tractorBeam.xMax) {
                if (godModeRef.current) {
                  spawnShieldImpact(shipPos);
                } else {
                  playerStunDuration = 4.5;
                  setPlayerStunned(true);
                  shakeIntensity = 1.0;
                  playTone(180, 60, 0.4, 0.3, 'sawtooth');
                }
              }

              setTimeout(() => {
                tractorBeam.active = false;
              }, 350);
            }
          }

          bossData.shootCooldown -= dt;
          if (bossData.shootCooldown <= 0) {
            bossData.shootCooldown = 1.4;
            for (const s of [-16, 16]) {
              const origin = bossData.pos.clone().add(new THREE.Vector3(s, 6, 30));
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
            playBuffer(audioBuffers.tieShot, 0.22, true);
          }
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const jitterX = Math.sin(timestamp * 0.015 + e.seed) * 0.12;
        const jitterY = Math.cos(timestamp * 0.018 + e.seed * 2) * 0.09;
        const jitterRoll = Math.sin(timestamp * 0.012 + e.seed) * 0.06;

        if (e.state === 'disabled') {
          e.pos.z += e.speed * dt;
          e.mesh.rotation.x += dt * 8;
          e.mesh.rotation.y += dt * 5;
          e.mesh.rotation.z += dt * 7;
          e.mesh.position.copy(e.pos);

          if (e.disabledTimer !== undefined) {
            e.disabledTimer -= dt;
            if (e.disabledTimer <= 0) {
              spawnRetroExplosion(e.pos);
              scene.remove(e.mesh);
              enemies.splice(i, 1);
              continue;
            }
          }
          continue;
        }

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
            e.shootCooldown = e.isRaid ? 1.6 : e.isElite ? 0.8 + Math.random() * 0.5 : 1.1 + Math.random() * 0.7;
            const spreadX = (Math.random() - 0.5) * (e.isElite ? 3.0 : 4.5);
            const spreadY = (Math.random() - 0.5) * (e.isElite ? 2.0 : 3.0);
            const targetWithSpread = shipPos.clone().add(new THREE.Vector3(spreadX, spreadY, 0));

            const baseLaserDir = new THREE.Vector3().subVectors(targetWithSpread, e.pos).normalize();

            const fireSalvo = (offsetZ = 0) => {
              for (const s of [-0.32, 0.32]) {
                const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
                lMesh.position.set(e.pos.x + s, e.pos.y - 0.05, e.pos.z + 0.8 + offsetZ);
                lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), baseLaserDir);
                scene.add(lMesh);
                lasers.push({ mesh: lMesh, vel: baseLaserDir.clone().multiplyScalar(155), life: 2.2, isEnemy: true });
              }
            };

            fireSalvo(0);

            if (e.isRaid) {
              setTimeout(() => {
                if (!isDisposed && e.hp > 0 && !bossCutsceneActiveRef.current) {
                  fireSalvo(-0.5);
                }
              }, 110);
            }

            const distVolume = Math.max(0, Math.min(0.25, (1 - distToCam / 135) * 0.25));
            if (distVolume > 0.02) {
              playBuffer(audioBuffers.tieShot, distVolume, true);
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
          if (l.mesh.position.distanceTo(shipPos) < 1.3) {
            l.life = 0;

            const isInvulnerable =
              godModeRef.current ||
              inBiomeTransitionRef.current ||
              bossCutsceneActiveRef.current;

            if (isInvulnerable) {
              if (godModeRef.current) {
                spawnShieldImpact(l.mesh.position);
              }
            } else {
              shakeIntensity = 0.5;
              currentHp = Math.max(0, currentHp - 5);
              setHp(currentHp);
              if (currentHp <= 0) {
                setCurtainVisible(true);
                setTimeout(() => onExit(), 500);
              }
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

                if (Math.random() < 0.0745) {
                  spawnDatapad(e.pos);
                }

                scene.remove(e.mesh);
                enemies.splice(j, 1);
              }
              break;
            }
          }

          if (!hitAny && bossData && !bossData.destroyed && !bossData.raidActive) {
            bossData.group.updateMatrixWorld(true);
            const hasGenerators = bossData.generators.some((g) => !g.destroyed);

            if (hasGenerators) {
              for (const gen of bossData.generators) {
                if (!gen.destroyed) {
                  const worldGPos = gen.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
                  if (l.mesh.position.distanceTo(worldGPos) < 14.0) {
                    l.life = 0;
                    hitAny = true;
                    gen.hp -= 1;

                    if (gen.hp <= 0) {
                      gen.destroyed = true;
                      spawnRetroExplosion(worldGPos, 1.8);
                    }
                    break;
                  }
                }
              }
            } else {
              const dx = Math.abs(l.mesh.position.x - bossData.pos.x);
              const dy = Math.abs(l.mesh.position.y - bossData.pos.y);
              const dz = Math.abs(l.mesh.position.z - bossData.pos.z);

              if (dx < 32 && dy < 16 && dz < 55) {
                l.life = 0;
                hitAny = true;
                bossData.hullHp -= 1;

                bossHullHitCount++;
                if (bossHullHitCount >= nextExplosionThreshold) {
                  bossHullHitCount = 0;
                  nextExplosionThreshold = Math.floor(7 + Math.random() * 3);
                  spawnRetroExplosion(l.mesh.position, 0.8, false);
                }

                if (bossData.hullHp <= 0) {
                  bossData.destroyed = true;
                  spawnRetroExplosion(bossData.pos, 3.0, true);
                  setCurtainVisible(true);
                  setTimeout(() => {
                    onExit();
                  }, 650);
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

      for (let i = datapads.length - 1; i >= 0; i--) {
        const dp = datapads[i];
        dp.mesh.rotation.x += dp.rotSpeed.x * dt;
        dp.mesh.rotation.y += dp.rotSpeed.y * dt;

        if (!dp.locked) {
          dp.searchTimer -= dt;
          if (dp.searchTimer <= 0) {
            dp.searchTimer = 1.0;
            if (dp.pos.distanceTo(shipPos) < 180) {
              dp.locked = true;
            }
          }
          dp.pos.z += 10 * dt;
        } else {
          dp.pos.lerp(shipPos, dt * 8.5);
        }

        dp.mesh.position.copy(dp.pos);

        if (dp.pos.distanceTo(shipPos) < 2.5) {
          currentHp = Math.min(100, currentHp + dp.healPercent);
          setHp(currentHp);
          setHealBonus(dp.healPercent);
          setTimeout(() => setHealBonus(0), 450);

          playerShip.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (m) {
                const orig = m.color.getHex();
                m.color.setHex(0xff7777);
                setTimeout(() => m.color.setHex(orig), 180);
              }
            }
          });

          scene.remove(dp.mesh);
          datapads.splice(i, 1);
        }
      }

      for (let i = shieldImpacts.length - 1; i >= 0; i--) {
        const si = shieldImpacts[i];
        si.life -= dt;
        const progress = 1 - si.life / si.maxLife;
        si.mesh.scale.setScalar(0.7 + progress * 0.9);
        (si.mesh.material as THREE.MeshBasicMaterial).opacity = (si.life / si.maxLife) * 0.85;
        if (si.life <= 0) {
          scene.remove(si.mesh);
          si.mesh.geometry.dispose();
          shieldImpacts.splice(i, 1);
        }
      }

      for (let i = flashCores.length - 1; i >= 0; i--) {
        const f = flashCores[i];
        f.life -= dt;
        const progress = 1 - f.life / f.maxLife;
        f.mesh.scale.setScalar(2.2 + progress * 3.5);
        if (f.light) {
          f.light.intensity = (f.life / f.maxLife) * 5.0;
        }
        if (f.life <= 0) {
          scene.remove(f.mesh);
          if (f.light) scene.remove(f.light);
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
      datapads.forEach((dp) => scene.remove(dp.mesh));
      shieldImpacts.forEach((si) => scene.remove(si.mesh));
      flashCores.forEach((f) => {
        scene.remove(f.mesh);
        if (f.light) scene.remove(f.light);
      });
      if (bossData) {
        scene.remove(bossData.group);
      }
      if (activeLightningMesh) {
        scene.remove(activeLightningMesh);
      }
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets, onExit]);

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransition || isPaused || isConsoleOpen || bossCutsceneActive || playerStunned || showHallwayCutscene) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickTouchId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickActive(true);
    handleStickMove(e);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransition || isPaused || isConsoleOpen || bossCutsceneActive || playerStunned || showHallwayCutscene || stickTouchId.current !== e.pointerId) return;
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
    playUiSound();
    setIsFiring(false);
    setIsPaused((prev) => !prev);
    setIsConsoleOpen(false);
  };

  const handleResume = () => {
    playUiSound();
    setIsPaused(false);
    setIsConsoleOpen(false);
  };

  const handleQuit = () => {
    playUiSound();
    setCurtainVisible(true);
    setTimeout(() => {
      onExit();
    }, 450);
  };

  const handleOpenConsole = () => {
    playUiSound();
    setIsConsoleOpen(true);
  };

  const handleCloseConsole = () => {
    playUiSound();
    setIsConsoleOpen(false);
  };

  const handleApplyCheat = () => {
    playUiSound();
    const code = consoleInput.trim();
    if (code === 'wuvdjao45roqs') {
      skipToStage4Ref.current = true;
      setConsoleFeedback('ПЕРЕХОД К 95% ЭТАПА 4');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else if (code === 'hsjsi34einaoaop') {
      godModeRef.current = !godModeRef.current;
      setConsoleFeedback(godModeRef.current ? 'ЩИТ АКТИВИРОВАН' : 'ЩИТ ДЕАКТИВИРОВАН');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else if (code === 'shan37alspppp') {
      forceBiomeRef.current = 'nebula_storm';
      setConsoleFeedback('ТУМАННОСТЬ АКТИВИРОВАНА');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else if (code === '2827sjksos29p') {
      forceBiomeRef.current = 'ionic_vapors';
      setConsoleFeedback('ИОННЫЕ ИСПАРЕНИЯ АКТИВИРОВАНЫ');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else if (code === '5dbb6kaopwnqhoa') {
      forceLightningPlayerRef.current = true;
      setConsoleFeedback('УДАР МОЛНИИ ПО ИГРОКУ');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else if (code === 'akwk3lwo4ks7kp') {
      setIsConsoleOpen(false);
      setIsPaused(false);
      setConsoleInput('');
      setConsoleFeedback('');
      setShowHallwayCutscene(true);
    } else {
      setConsoleFeedback('НЕВЕРНЫЙ КОД');
    }
  };

  const handleHallwayComplete = useCallback(() => {
    setShowHallwayCutscene(false);
  }, []);

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
          box-shadow: 0 0 0 1px #000;
          padding: 1px;
          clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%);
          position: relative;
        }
        .tfu-hp-fill {
          height: 100%;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%);
          transition: width 0.15s ease-out;
        }
        .tfu-hp-heal-sector {
          position: absolute;
          top: 1px;
          bottom: 1px;
          background: #4cd137;
          opacity: 0.85;
          transition: all 0.2s ease-out;
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
          transition: all 0.2s;
        }
        .tracker-node.active {
          border-color: #64b5f6;
          background: #2196f3;
        }
        .tracker-line {
          width: 22px;
          height: 2px;
          background: #233446;
          position: relative;
          overflow: hidden;
        }
        .tracker-line-fill {
          height: 100%;
          background: #64b5f6;
          transition: width 0.12s linear;
        }
        .tracker-boss {
          width: 12px;
          height: 12px;
          transform: rotate(45deg);
          border: 1.5px solid #ff4757;
          background: #200508;
          transition: all 0.2s;
        }
        .tracker-boss.active {
          border-color: #ff3838;
          background: #ff3838;
        }
        .tfu-boss-hp-container {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }
        .tfu-boss-hp-label {
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2px;
          text-shadow: 0 1px 3px #000;
        }
        .tfu-boss-hp-label.shield {
          color: #00d2d3;
        }
        .tfu-boss-hp-label.hull {
          color: #f1c40f;
        }
        .tfu-boss-hp-label.raid {
          color: #ffffff;
        }
        .tfu-boss-hp-frame {
          width: min(260px, 40vw);
          height: 13px;
          border-width: 1px;
          border-style: solid;
          box-shadow: 0 0 0 1px #000;
          padding: 1px;
          clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%);
          position: relative;
        }
        .tfu-boss-hp-frame.shield {
          background-color: rgba(5, 45, 60, 0.75);
          border-color: #00d2d3;
        }
        .tfu-boss-hp-frame.hull {
          background-color: rgba(60, 50, 5, 0.75);
          border-color: #f1c40f;
        }
        .tfu-boss-hp-frame.raid {
          background-color: rgba(40, 40, 45, 0.75);
          border-color: #ffffff;
        }
        .tfu-boss-hp-fill {
          height: 100%;
          clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%);
          transition: width 0.15s ease-out;
        }
        .tfu-boss-hp-fill.shield {
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #0984e3 0%, #00d2d3 45%, #0652dd 55%, #002366 100%);
        }
        .tfu-boss-hp-fill.hull {
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #f39c12 0%, #f1c40f 45%, #d68910 55%, #7d6608 100%);
        }
        .tfu-boss-hp-fill.raid {
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #ffffff 0%, #e0e0e0 45%, #b0b0b0 55%, #707070 100%);
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
        }
        .zone-attack-indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          background: rgba(255, 30, 30, 0.2);
          border-left: 2px dashed rgba(255, 80, 80, 0.65);
          border-right: 2px dashed rgba(255, 80, 80, 0.65);
          pointer-events: none;
          z-index: 8;
          animation: zoneBlink 0.22s infinite alternate;
        }
        .tractor-beam-indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          background: rgba(255, 10, 10, 0.28);
          border-left: 3px solid rgba(255, 60, 60, 0.85);
          border-right: 3px solid rgba(255, 60, 60, 0.85);
          pointer-events: none;
          z-index: 8;
          animation: tractorBlink 0.18s infinite alternate;
        }
        @keyframes zoneBlink {
          from { opacity: 0.15; }
          to { opacity: 0.55; }
        }
        @keyframes tractorBlink {
          from { opacity: 0.2; }
          to { opacity: 0.7; }
        }
        .generator-reticle {
          position: absolute;
          width: 22px;
          height: 22px;
          border: 2px solid #ff3838;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 12;
        }
        .generator-reticle::before {
          content: '';
          position: absolute;
          inset: 3px;
          border: 1px dashed rgba(255, 80, 80, 0.7);
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
        .no-signal-indicator {
          position: absolute;
          top: 48%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: monospace;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #ff3838;
          pointer-events: none;
          z-index: 15;
          animation: blinkSignal 0.25s infinite alternate;
        }
        @keyframes blinkSignal {
          from { opacity: 0.3; }
          to { opacity: 1; }
        }
        .pause-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
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
          gap: 9px;
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
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          color: #ffffff;
        }
        .pause-btn-secondary {
          border: 2px solid #b2c2d4;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%);
          color: #0b141e;
        }
        .console-window {
          background: #0d151f;
          border: 2px solid #5a738e;
          border-top: 2px solid #8fa9c4;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: min(380px, 80vw);
        }
        .console-title {
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #64b5f6;
          text-transform: uppercase;
        }
        .console-desc {
          font-family: Arial, sans-serif;
          font-size: 11px;
          letter-spacing: 1px;
          color: #8faec4;
          text-align: center;
        }
        .console-input {
          width: 100%;
          background: #060b10;
          border: 1px solid #3d586e;
          color: #ffffff;
          padding: 9px 12px;
          font-family: monospace;
          font-size: 13px;
          letter-spacing: 2px;
          text-align: center;
          outline: none;
        }
        .console-feedback {
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 1.5px;
          color: #ff4757;
          min-height: 14px;
        }
      `}</style>

      <div className={`game-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />

      {bossActive && !bossShieldsDown && !bossCutsceneActive &&
        generatorTargets.map((gt) => (
          <div
            key={gt.id}
            className="generator-reticle"
            style={{
              left: `${gt.x}px`,
              top: `${gt.y}px`
            }}
          />
        ))}

      {zoneAttackUi.visible && (
        <div
          className="zone-attack-indicator"
          style={{
            left: `${zoneAttackUi.leftPct}%`,
            width: `${zoneAttackUi.widthPct}%`
          }}
        />
      )}

      {tractorBeamUi.visible && (
        <div
          className="tractor-beam-indicator"
          style={{
            left: `${tractorBeamUi.leftPct}%`,
            width: `${tractorBeamUi.widthPct}%`
          }}
        />
      )}

      <div
        className={`letterbox-bar letterbox-top ${
          inBiomeTransition || isPaused || isConsoleOpen || bossCutsceneActive ? 'letterbox-active' : ''
        }`}
      />
      <div
        className={`letterbox-bar letterbox-bottom ${
          inBiomeTransition || isPaused || isConsoleOpen || bossCutsceneActive ? 'letterbox-active' : ''
        }`}
      />

      <div className={`biome-banner ${inBiomeTransition && !isPaused && !isConsoleOpen ? 'show-banner' : ''}`}>
        <div className="biome-text">{biomeTitle}</div>
        {biomeSubtext && <div className="biome-subtext">{biomeSubtext}</div>}
      </div>

      <div className={`biome-banner ${bossCutsceneActive ? 'show-banner' : ''}`}>
        <div className="biome-text">ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ</div>
        <div className="biome-subtext">ВЫХОДИТ ИЗ ГИПЕРПРОСТРАНСТВА</div>
      </div>

      {showHallwayCutscene && (
        <HallwayCutscene
          assets={assets}
          onComplete={handleHallwayComplete}
        />
      )}

      {playerStunned && <div className="no-signal-indicator">НЕТ СИГНАЛА</div>}

      {isPaused && !isConsoleOpen && (
        <div className="pause-overlay">
          <div className="pause-title">ИГРА НА ПАУЗЕ</div>
          <div className="pause-menu-list">
            <button type="button" className="pause-button pause-btn-primary" onClick={handleResume}>
              ПРОДОЛЖИТЬ
            </button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={handleOpenConsole}>
              КОНСОЛЬ
            </button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={handleQuit}>
              ВЫЙТИ
            </button>
          </div>
        </div>
      )}

      {isPaused && isConsoleOpen && (
        <div className="pause-overlay">
          <div className="console-window">
            <div className="console-title">КОНСОЛЬ</div>
            <div className="console-desc">Введи читкод для консоли</div>
            <input
              type="text"
              className="console-input"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              placeholder="КОД..."
            />
            <div className="console-feedback">{consoleFeedback}</div>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button type="button" className="pause-button pause-btn-primary" onClick={handleApplyCheat}>
                ВВОД
              </button>
              <button type="button" className="pause-button pause-btn-secondary" onClick={handleCloseConsole}>
                НАЗАД
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`tfu-hud ${
          inBiomeTransition || isPaused || isConsoleOpen || bossCutsceneActive ? 'hidden-hud' : ''
        }`}
      >
        <div className="tfu-hp-container">
          <div className="tfu-hp-label">HULL INTEGRITY</div>
          <div className="tfu-hp-frame">
            <div className="tfu-hp-fill" style={{ width: `${hp}%` }} />
            {healBonus > 0 && (
              <div
                className="tfu-hp-heal-sector"
                style={{
                  left: `${Math.max(0, hp - healBonus)}%`,
                  width: `${healBonus}%`
                }}
              />
            )}
          </div>
        </div>

        {bossActive ? (
          <div className="tfu-boss-hp-container">
            <div className={`tfu-boss-hp-label ${bossBarMode}`}>
              {bossBarMode === 'shield' ? 'ЭНЕРГОЩИТЫ' : bossBarMode === 'raid' ? 'НАЛЕТ' : 'ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ'}
            </div>
            <div className={`tfu-boss-hp-frame ${bossBarMode}`}>
              <div
                className={`tfu-boss-hp-fill ${bossBarMode}`}
                style={{ width: `${bossBarPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="tfu-progress-tracker">
            <div className={`tracker-node ${currentStage >= 0 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div
                className="tracker-line-fill"
                style={{
                  width: `${currentStage > 0 ? 100 : currentStage === 0 ? stageProgressPercent : 0}%`
                }}
              />
            </div>

            <div className={`tracker-node ${currentStage >= 1 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div
                className="tracker-line-fill"
                style={{
                  width: `${currentStage > 1 ? 100 : currentStage === 1 ? stageProgressPercent : 0}%`
                }}
              />
            </div>

            <div className={`tracker-node ${currentStage >= 2 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div
                className="tracker-line-fill"
                style={{
                  width: `${currentStage > 2 ? 100 : currentStage === 2 ? stageProgressPercent : 0}%`
                }}
              />
            </div>

            <div className={`tracker-node ${currentStage >= 3 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div
                className="tracker-line-fill"
                style={{
                  width: `${currentStage > 3 ? 100 : currentStage === 3 ? stageProgressPercent : 0}%`
                }}
              />
            </div>

            <div className={`tracker-boss ${currentStage >= 4 ? 'active' : ''}`} />
          </div>
        )}

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
            if (!inBiomeTransition && !isPaused && !isConsoleOpen && !bossCutsceneActive && !playerStunned && !showHallwayCutscene) setIsFiring(true);
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
