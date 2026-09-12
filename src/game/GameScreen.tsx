
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';
import {
  Enemy, Laser, ExplosionPart, ShockwaveRing, FlashCore, ShieldImpactEffect,
  DatapadItem, ShieldGenerator, BossZoneAttack, BossTractorBeam, BossState,
  PlanetItem, BiomeRunStep, generateBiomeRun, createProceduralPlanetTexture,
  createProceduralNoiseTexture, availablePlanets, BiomeType, GeneratorScreenTarget,
  BossDebris, AsteroidItem, TrashItem, DerelictTie, IonicCloudItem,
  ASTEROID_TEXTURE_URLS, TRASH_TEXTURE_URLS
} from './GameData.ts';
import { HANGAR_SHIPS } from '../components/HangarScreen.tsx';
import VictoryCutscene from '../cutscenes/VictoryCutscene.tsx';
import GameUI from './GameUI.tsx';

interface ProtonBomb {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetRef: Enemy | null;
  speed: number;
  life: number;
}

interface WingmanFlyer {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  side: number;
  life: number;
  engineGain: GainNode | null;
  engineSource: AudioBufferSourceNode | null;
}

interface GameScreenProps {
  assets: PreloadedAssets;
  selectedShipId?: string;
  onAddCredits?: (amount: number) => void;
  onRestart?: () => void;
  onTriggerIntroCutscene?: () => void;
  onTriggerVictoryCutscene?: () => void;
  onExit: () => void;
}

export default function GameScreen({
  assets,
  selectedShipId = 'xwing',
  onAddCredits,
  onRestart,
  onTriggerIntroCutscene,
  onTriggerVictoryCutscene,
  onExit
}: GameScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);
  const [hp, setHp] = useState<number>(100);

  const shipConf = HANGAR_SHIPS.find((s) => s.id === selectedShipId) || HANGAR_SHIPS[0];
  const maxShield = shipConf.shield;
  const [shieldHp, setShieldHp] = useState<number>(maxShield);

  const [healBonus, setHealBonus] = useState<number>(0);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [score, setScore] = useState<number>(0);
  const [enemiesKilled, setEnemiesKilled] = useState<number>(0);
  const [damageDealt, setDamageDealt] = useState<number>(0);
  const [stagesCompleted, setStagesCompleted] = useState<number>(0);
  const [creditsEarned, setCreditsEarned] = useState<number>(0);
  const [endGameModal, setEndGameModal] = useState<'defeat' | 'victory' | null>(null);

  const [ability1Cooldown, setAbility1Cooldown] = useState<number>(0);
  const [ability2Cooldown, setAbility2Cooldown] = useState<number>(0);

  const ability1CooldownRef = useRef<number>(0);
  const ability2CooldownRef = useRef<number>(0);
  const triggerBombRef = useRef<boolean>(false);
  const triggerBrotherHelpRef = useRef<boolean>(false);

  const [showVictoryCutscene, setShowVictoryCutscene] = useState<boolean>(false);
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
  const [playerStunned, setPlayerStunned] = useState<boolean>(false);

  const [generatorTargets, setGeneratorTargets] = useState<GeneratorScreenTarget[]>([]);
  const [zoneAttackUi, setZoneAttackUi] = useState<{ visible: boolean; leftPct: number; widthPct: number }>({ visible: false, leftPct: 40, widthPct: 20 });
  const [tractorBeamUi, setTractorBeamUi] = useState<{ visible: boolean; leftPct: number; widthPct: number }>({ visible: false, leftPct: 35, widthPct: 30 });

  const onAddCreditsRef = useRef(onAddCredits);
  const onRestartRef = useRef(onRestart);
  const onExitRef = useRef(onExit);
  const onTriggerIntroCutsceneRef = useRef(onTriggerIntroCutscene);
  const onTriggerVictoryCutsceneRef = useRef(onTriggerVictoryCutscene);

  useEffect(() => {
    onAddCreditsRef.current = onAddCredits;
    onRestartRef.current = onRestart;
    onExitRef.current = onExit;
    onTriggerIntroCutsceneRef.current = onTriggerIntroCutscene;
    onTriggerVictoryCutsceneRef.current = onTriggerVictoryCutscene;
  });

  const isPausedRef = useRef<boolean>(false);
  const inBiomeTransitionRef = useRef<boolean>(false);
  const bossCutsceneActiveRef = useRef<boolean>(false);
  const inHallwayRef = useRef<boolean>(false);
  const showVictoryCutsceneRef = useRef<boolean>(false);

  const isDeadRef = useRef<boolean>(false);
  const isEndingSequenceRef = useRef<boolean>(false);

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
    isPausedRef.current = isPaused;
    inHallwayRef.current = showHallwayCutscene;
    showVictoryCutsceneRef.current = showVictoryCutscene;
    if (xwingGainRef.current && tieEngineGainRef.current) {
      if (isPaused || endGameModal !== null || showVictoryCutscene) {
        xwingGainRef.current.gain.value = 0;
        tieEngineGainRef.current.gain.value = 0;
      }
    }
    if (bossSoundtrackSourceRef.current && assets.audioCtx) {
      if (isPaused || endGameModal !== null || showVictoryCutscene) {
        if (assets.audioCtx.state === 'running') assets.audioCtx.suspend();
      } else {
        if (assets.audioCtx.state === 'suspended') assets.audioCtx.resume();
      }
    }
  }, [isPaused, showHallwayCutscene, endGameModal, showVictoryCutscene, assets.audioCtx]);

  const playTone = (freq: number, endFreq: number, dur: number, vol = 0.15, type: OscillatorType = 'sawtooth') => {
    if (!assets.audioCtx || isPausedRef.current) return;
    try {
      const ctx = assets.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      return;
    }
  };

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
    if (!assets.audioBuffers.click) return;
    try {
      const { audioCtx } = assets;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const src = audioCtx.createBufferSource();
      src.buffer = assets.audioBuffers.click;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.55;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start(0);
    } catch {
      return;
    }
  };

  const playClapSound = (volume = 0.38) => {
    const clapKeys = ['clap1', 'clap2', 'clap3', 'clap4'];
    const chosen = clapKeys[Math.floor(Math.random() * clapKeys.length)];
    const buf = assets.audioBuffers[chosen];
    if (buf) {
      playBuffer(buf, volume);
    } else {
      playTone(180, 80, 0.15, volume * 0.7, 'square');
    }
  };

  const playThunderSound = (distToPlayer: number) => {
    const tKeys = ['thunder1', 'thunder2'];
    const chosen = tKeys[Math.floor(Math.random() * tKeys.length)];
    const buf = assets.audioBuffers[chosen];
    const vol = THREE.MathUtils.clamp(Math.max(0, 1 - distToPlayer / 280) * 0.32, 0.05, 0.32);
    if (buf) {
      playBuffer(buf, vol, true);
    } else {
      playTone(90, 40, 2.5, vol, 'sine');
    }
  };

  useEffect(() => {
    inputRef.current.fire = isFiring;
  }, [isFiring]);

  const handleTriggerAbility1 = () => {
    if (isPausedRef.current || playerStunned || ability1CooldownRef.current > 0 || isDeadRef.current || showVictoryCutscene) return;
    if (selectedShipId !== 'xwing') return;
    ability1CooldownRef.current = 25.0;
    setAbility1Cooldown(25);
    triggerBrotherHelpRef.current = true;
  };

  const handleTriggerAbility2 = () => {
    if (isPausedRef.current || playerStunned || ability2CooldownRef.current > 0 || isDeadRef.current || showVictoryCutscene) return;
    if (selectedShipId !== 'xwing') return;
    ability2CooldownRef.current = 26.0;
    setAbility2Cooldown(26);
    triggerBombRef.current = true;
  };

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const { models, audioBuffers, audioCtx } = assets;

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

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const baseFogDensity = 0.00035;
    scene.fog = new THREE.FogExp2(biomeRunRef.current[0].fogColor, baseFogDensity);

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
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: false });
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
      planet.position.set(side * (480 + Math.random() * 200), -160 - Math.random() * 80, -1800 - Math.random() * 400);
      planet.userData = { radius, speed: 38 };
      scene.add(planet);
      planetMeshes.push(planet);
    };

    let junkyardDreadnought: THREE.Group | null = null;
    const spawnJunkyardDreadnought = () => {
      if (junkyardDreadnought) {
        scene.remove(junkyardDreadnought);
        junkyardDreadnought = null;
      }
      const dr = models.destroyer.clone();
      dr.scale.setScalar(18.0);
      dr.position.set(-180, -40, -1200);
      dr.rotation.set(0.42, 2.3, -0.55);
      dr.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) {
            m.roughness = 0.9;
            m.metalness = 0.1;
          }
        }
      });
      scene.add(dr);
      junkyardDreadnought = dr;
    };

    const clearJunkyardDreadnought = () => {
      if (junkyardDreadnought) {
        scene.remove(junkyardDreadnought);
        junkyardDreadnought = null;
      }
    };

    const firstStep = biomeRunRef.current[0];
    if (firstStep.type === 'planet' && firstStep.planet) {
      spawnPlanet(firstStep.planet);
    } else if (firstStep.type === 'junkyard') {
      spawnJunkyardDreadnought();
    }

    const defaultShipPos = new THREE.Vector3(0, -1.2, 0);
    const shipPos = defaultShipPos.clone();
    let shipVx = 0;
    let shipVy = 0;
    let shipBank = 0;
    let shipPitch = 0;

    const shipHolder = new THREE.Group();
    shipHolder.position.copy(shipPos);
    scene.add(shipHolder);

    const gltfLoader = new GLTFLoader();

    const applyCalculatedScaleAndRot = (targetObj: THREE.Group) => {
      const xBox = new THREE.Box3().setFromObject(models.xwing);
      const xSize = new THREE.Vector3();
      xBox.getSize(xSize);
      const xMax = Math.max(xSize.x, xSize.y, xSize.z) || 1;

      const mBox = new THREE.Box3().setFromObject(targetObj);
      const mSize = new THREE.Vector3();
      mBox.getSize(mSize);
      const mMax = Math.max(mSize.x, mSize.y, mSize.z) || 1;

      const targetScaleRatio = shipConf.id === 'ywing' ? 0.56 : 0.48;
      const normalizedScale = (xMax / mMax) * targetScaleRatio;
      targetObj.scale.setScalar(normalizedScale);
      targetObj.rotation.set(shipConf.rot[0], shipConf.rot[1], shipConf.rot[2]);
    };

    if (selectedShipId === 'xwing') {
      const xObj = models.xwing.clone();
      xObj.scale.setScalar(0.48);
      xObj.rotation.set(shipConf.rot[0], shipConf.rot[1], shipConf.rot[2]);
      shipHolder.add(xObj);
    } else if (shipConf.modelUrl) {
      gltfLoader.load(
        shipConf.modelUrl,
        (gltf) => {
          if (isDisposed) return;
          while (shipHolder.children.length > 0) {
            shipHolder.remove(shipHolder.children[0]);
          }
          const loaded = gltf.scene;
          applyCalculatedScaleAndRot(loaded);
          shipHolder.add(loaded);
        },
        undefined,
        () => {
          if (isDisposed) return;
          const fb = models.xwing.clone();
          fb.scale.setScalar(0.48);
          shipHolder.add(fb);
        }
      );
    } else {
      const fb = models.xwing.clone();
      fb.scale.setScalar(0.48);
      shipHolder.add(fb);
    }

    const crosshairGeo = new THREE.RingGeometry(0.55, 0.7, 16);
    const crosshairMat = new THREE.MeshBasicMaterial({ color: 0x64b5f6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const crosshairTex = new THREE.Mesh(crosshairGeo, crosshairMat);
    scene.add(crosshairTex);

    const redLaserGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 4);
    redLaserGeo.rotateX(Math.PI / 2);
    const redLaserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    const greenLaserGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 4);
    greenLaserGeo.rotateX(Math.PI / 2);
    const greenLaserMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });

    const bombGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const bombMat = new THREE.MeshBasicMaterial({ color: 0xff3388 });

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

    const shieldRippleGeo = new THREE.RingGeometry(0.4, 2.1, 24);
    const shieldRippleMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });

    const spaceDebrisGeoList = [
      new THREE.DodecahedronGeometry(1.4, 0),
      new THREE.IcosahedronGeometry(1.2, 0),
      new THREE.DodecahedronGeometry(1.7, 0)
    ];
    const spaceDebrisMats = [
      new THREE.MeshLambertMaterial({ color: 0x4a4f56 }),
      new THREE.MeshLambertMaterial({ color: 0x5c524b }),
      new THREE.MeshLambertMaterial({ color: 0x383e44 }),
      new THREE.MeshLambertMaterial({ color: 0x635b54 })
    ];

    const asteroidTextures: THREE.Texture[] = ASTEROID_TEXTURE_URLS.map((url, idx) => {
      const fb = createProceduralNoiseTexture('#555555', '#242424');
      textureLoader.load(url, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        asteroidTextures[idx] = tex;
      });
      return fb;
    });

    const trashTextures: THREE.Texture[] = TRASH_TEXTURE_URLS.map((url, idx) => {
      const fb = createProceduralNoiseTexture('#3e444b', '#1a1f26');
      textureLoader.load(url, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        trashTextures[idx] = tex;
      });
      return fb;
    });

    const lasers: Laser[] = [];
    const protonBombs: ProtonBomb[] = [];
    const wingmanFlyers: WingmanFlyer[] = [];
    const enemies: Enemy[] = [];
    const debrisList: ExplosionPart[] = [];
    const shockwaves: ShockwaveRing[] = [];
    const flashCores: FlashCore[] = [];
    const shieldImpacts: ShieldImpactEffect[] = [];
    const datapads: DatapadItem[] = [];
    const bossSpaceDebris: BossDebris[] = [];

    const asteroids: AsteroidItem[] = [];
    const trashItems: TrashItem[] = [];
    const derelictTies: DerelictTie[] = [];
    const ionicClouds: IonicCloudItem[] = [];

    const zoneAttack: BossZoneAttack = { active: false, timer: 0, duration: 1.6, xMin: -4, xMax: 4, fired: false };
    const tractorBeam: BossTractorBeam = { active: false, timer: 0, duration: 1.8, xMin: -6, xMax: 6, fired: false };

    const spawnShieldImpact = (worldPos: THREE.Vector3) => {
      const sMesh = new THREE.Mesh(shieldRippleGeo, shieldRippleMat.clone());
      sMesh.position.copy(worldPos);
      sMesh.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, Math.random() * Math.PI);
      sMesh.scale.setScalar(0.5);
      scene.add(sMesh);
      shieldImpacts.push({ mesh: sMesh, life: 0.24, maxLife: 0.24 });
    };

    const spawnRetroExplosion = (pos: THREE.Vector3, scale = 1.0, withLight = true, isGreenish = false) => {
      const flashMesh = new THREE.Mesh(flashCoreGeo, flashCoreMat);
      flashMesh.position.copy(pos);
      flashMesh.scale.setScalar(2.2 * scale);
      scene.add(flashMesh);

      let expLight: THREE.PointLight | undefined = undefined;
      if (withLight) {
        expLight = new THREE.PointLight(isGreenish ? 0x22ff44 : 0xff6622, 5.0 * scale, 55 * scale);
        expLight.position.copy(pos);
        scene.add(expLight);
      }

      flashCores.push({ mesh: flashMesh, light: expLight, life: 0.14, maxLife: 0.14 });

      const ringMesh = new THREE.Mesh(shockRingGeo, isGreenish ? shockRingGreenMat.clone() : shockRingMat.clone());
      ringMesh.position.copy(pos);
      ringMesh.rotation.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, Math.random() * Math.PI);
      scene.add(ringMesh);
      shockwaves.push({ mesh: ringMesh, life: 0.38, maxLife: 0.38, scaleSpeed: 28.0 * scale });

      const currentDebrisMats = isGreenish ? debrisMatsGreen : debrisMats;
      const debrisCount = withLight ? 16 : 8;
      for (let i = 0; i < debrisCount; i++) {
        const mat = currentDebrisMats[i % currentDebrisMats.length];
        const dMesh = new THREE.Mesh(debrisPieceGeo, mat);
        dMesh.position.copy(pos);
        dMesh.scale.setScalar((0.6 + Math.random() * 0.8) * scale);
        const vel = new THREE.Vector3((Math.random() - 0.5) * 60 * scale, (Math.random() - 0.5) * 60 * scale, (Math.random() - 0.5) * 60 * scale);
        const spin = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        scene.add(dMesh);
        debrisList.push({ mesh: dMesh, vel, life: 0.65, maxLife: 0.65, spin });
      }

      playBuffer(audioBuffers.explode, 0.42, true);
    };

    const spawnProtonBomb = (origin: THREE.Vector3) => {
      let chosenTargetPos: THREE.Vector3 | null = null;
      let chosenTargetRef: Enemy | null = null;

      const live = enemies.filter((e) => e.state === 'attacking' && e.pos.z < shipPos.z - 4);
      if (live.length > 0) {
        live.sort((a, b) => a.pos.distanceTo(origin) - b.pos.distanceTo(origin));
        const nearestDist = live[0].pos.distanceTo(origin);
        const candidates = live.filter((e) => Math.abs(e.pos.distanceTo(origin) - nearestDist) < 14);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        chosenTargetRef = pick;
        chosenTargetPos = pick.pos.clone();
      } else if (bossData && !bossData.destroyed && !bossData.raidActive) {
        const liveGens = bossData.generators.filter((g) => !g.destroyed);
        if (liveGens.length > 0) {
          const gPick = liveGens[Math.floor(Math.random() * liveGens.length)];
          chosenTargetPos = gPick.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
        } else {
          chosenTargetPos = bossData.pos.clone().add(new THREE.Vector3(0, 4, 30));
        }
      }

      if (!chosenTargetPos) {
        chosenTargetPos = origin.clone().add(new THREE.Vector3(0, 0, -220));
      }

      const bMesh = new THREE.Mesh(bombGeo, bombMat);
      bMesh.position.copy(origin);
      scene.add(bMesh);

      const initDir = new THREE.Vector3().subVectors(chosenTargetPos, origin).normalize();

      protonBombs.push({
        mesh: bMesh,
        vel: initDir.multiplyScalar(28),
        targetPos: chosenTargetPos,
        targetRef: chosenTargetRef,
        speed: 28,
        life: 5.5
      });

      if (audioBuffers.proton) {
        playBuffer(audioBuffers.proton, 0.45);
      } else {
        playTone(300, 150, 0.4, 0.35, 'sawtooth');
      }
    };

    const triggerBrotherHelpAttack = () => {
      const targetPositions: THREE.Vector3[] = [];
      const targetEnemies: (Enemy | null)[] = [];

      const live = enemies.filter((e) => e.state === 'attacking' && e.pos.z < shipPos.z - 6);
      if (live.length > 0) {
        live.sort((a, b) => a.pos.distanceTo(shipPos) - b.pos.distanceTo(shipPos));
        targetPositions.push(live[0].pos);
        targetEnemies.push(live[0]);
        if (live.length > 1) {
          targetPositions.push(live[1].pos);
          targetEnemies.push(live[1]);
        }
      } else if (bossData && !bossData.destroyed && !bossData.raidActive) {
        const liveGens = bossData.generators.filter((g) => !g.destroyed);
        if (liveGens.length > 0) {
          const gPos = liveGens[0].localPos.clone().applyMatrix4(bossData.group.matrixWorld);
          targetPositions.push(gPos);
          targetEnemies.push(null);
        } else {
          const bPos = bossData.pos.clone().add(new THREE.Vector3(0, 4, 30));
          targetPositions.push(bPos);
          targetEnemies.push(null);
        }
      }

      if (targetPositions.length === 0) {
        targetPositions.push(new THREE.Vector3(shipPos.x - 4, shipPos.y, -180));
        targetPositions.push(new THREE.Vector3(shipPos.x + 4, shipPos.y, -180));
        targetEnemies.push(null);
        targetEnemies.push(null);
      }

      for (let s = 0; s < 6; s++) {
        setTimeout(() => {
          if (isDisposed) return;
          const targetIndex = s % targetPositions.length;
          const target = targetPositions[targetIndex];
          const xOffset = s % 2 === 0 ? -7.45 : 6.55;
          const yOffset = shipPos.y + 6 + (Math.random() - 0.5) * 0.8;
          const originL = new THREE.Vector3(shipPos.x + xOffset, yOffset, shipPos.z + 18);
          const originR = new THREE.Vector3(shipPos.x + xOffset + 0.9, yOffset, shipPos.z + 18);
          const dir = new THREE.Vector3().subVectors(target, originL).normalize();

          const lMesh1 = new THREE.Mesh(redLaserGeo, redLaserMat);
          lMesh1.position.copy(originL);
          lMesh1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
          scene.add(lMesh1);
          lasers.push({ mesh: lMesh1, vel: dir.clone().multiplyScalar(780), life: 1.1, isEnemy: false });

          const lMesh2 = new THREE.Mesh(redLaserGeo, redLaserMat);
          lMesh2.position.copy(originR);
          lMesh2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
          scene.add(lMesh2);
          lasers.push({ mesh: lMesh2, vel: dir.clone().multiplyScalar(780), life: 1.1, isEnemy: false });

          const enemyRef = targetEnemies[targetIndex];
          if (enemyRef && enemyRef.hp > 0) {
            enemyRef.hp = Math.max(0, enemyRef.hp - 3);
          }

          playBuffer(audioBuffers.xwingShot, 0.14, true);
        }, s * 125);
      }

      setTimeout(() => {
        if (isDisposed) return;
        const createFlyer = (side: number) => {
          const w = models.xwing.clone();
          w.scale.setScalar(0.46);
          const start = new THREE.Vector3(shipPos.x + side * 7.5, shipPos.y + 5.5, shipPos.z + 24);
          w.position.copy(start);
          w.rotation.set(-0.04, 0, side * 0.05);
          scene.add(w);

          let engSrc: AudioBufferSourceNode | null = null;
          let engGn: GainNode | null = null;

          if (audioBuffers.xwingEngine && !isPausedRef.current) {
            try {
              engSrc = audioCtx.createBufferSource();
              engSrc.buffer = audioBuffers.xwingEngine;
              engSrc.loop = true;
              engGn = audioCtx.createGain();
              engGn.gain.value = 0.01;
              engSrc.connect(engGn);
              if (spaceMuffleFilterRef.current) {
                engGn.connect(spaceMuffleFilterRef.current);
              } else {
                engGn.connect(audioCtx.destination);
              }
              engSrc.start(0);
            } catch {}
          }

          wingmanFlyers.push({
            mesh: w,
            pos: start,
            vel: new THREE.Vector3(0, 0, -190),
            side,
            life: 2.8,
            engineGain: engGn,
            engineSource: engSrc
          });
        };
        createFlyer(-1);
        createFlyer(1);
      }, 950);
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
        healPercent: healAmt
      });
    };

    const spawnAsteroid = () => {
      const radius = 1.3 + Math.random() * 2.1;
      const geo = new THREE.DodecahedronGeometry(radius, 1);
      const tex = asteroidTextures[Math.floor(Math.random() * asteroidTextures.length)];
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(geo, mat);

      const startX = (Math.random() - 0.5) * 55;
      const startY = defaultShipPos.y + (Math.random() - 0.5) * 22;
      const startZ = -360 - Math.random() * 60;
      mesh.position.set(startX, startY, startZ);
      scene.add(mesh);

      const speed = 55 + Math.random() * 50;
      asteroids.push({
        mesh,
        pos: mesh.position,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, speed),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
        radius,
        hp: 3
      });
    };

    const spawnTrashItem = () => {
      const shapeType = Math.floor(Math.random() * 4);
      let geo: THREE.BufferGeometry;
      let rad = 1.4;

      if (shapeType === 0) {
        geo = new THREE.BoxGeometry(0.5, 0.5, 3.4);
        rad = 1.6;
      } else if (shapeType === 1) {
        geo = new THREE.BoxGeometry(2.4, 0.16, 2.0);
        rad = 1.5;
      } else if (shapeType === 2) {
        geo = new THREE.CylinderGeometry(0.35, 0.35, 2.8, 8);
        rad = 1.4;
      } else {
        geo = new THREE.DodecahedronGeometry(1.5, 0);
        rad = 1.5;
      }

      const tex = trashTextures[Math.floor(Math.random() * trashTextures.length)];
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(geo, mat);

      const startX = (Math.random() - 0.5) * 60;
      const startY = defaultShipPos.y + (Math.random() - 0.5) * 24;
      const startZ = -340 - Math.random() * 60;
      mesh.position.set(startX, startY, startZ);
      scene.add(mesh);

      const speed = 40 + Math.random() * 55;
      trashItems.push({
        mesh,
        pos: mesh.position,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4, speed),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5),
        radius: rad
      });
    };

    const spawnDerelictTie = () => {
      const tie = models.tie.clone();
      tie.scale.setScalar(0.42);
      tie.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) {
            m.roughness = 0.95;
            m.metalness = 0.05;
            m.color.setHex(0x30353c);
          }
        }
      });

      const startX = (Math.random() - 0.5) * 35;
      const startY = defaultShipPos.y + (Math.random() - 0.5) * 16;
      const startZ = -320;
      tie.position.set(startX, startY, startZ);
      scene.add(tie);

      derelictTies.push({
        mesh: tie,
        pos: tie.position,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 45),
        rotSpeed: new THREE.Vector3(0.4, 0.6, 0.2),
        radius: 2.2,
        hp: 2
      });
    };

    const spawnIonicCloud = (posZ: number) => {
      const cloudRadius = 32 + Math.random() * 14;
      const geo = new THREE.SphereGeometry(cloudRadius, 16, 12);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8822aa,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 30, defaultShipPos.y + (Math.random() - 0.5) * 12, posZ);
      scene.add(mesh);
      ionicClouds.push({
        mesh,
        pos: mesh.position,
        radius: cloudRadius,
        cloudLength: cloudRadius * 1.8
      });
    };

    let enemySpawnCounter = 0;

    const spawnEnemy = (forcedSide?: number, isRaid = false) => {
      const side = forcedSide !== undefined ? forcedSide : (Math.random() > 0.5 ? 1 : -1);
      const startX = side * (65 + Math.random() * 25);
      const startY = (Math.random() - 0.5) * 12;
      const startZ = -240 - Math.random() * 40;

      const allowTie2 = stageRef.current >= 2 && Math.random() < 0.45;
      const useTie2Mesh = isRaid || allowTie2;

      let baseMesh: THREE.Group;
      if (useTie2Mesh && models.tie2) {
        baseMesh = models.tie2.clone();
      } else {
        baseMesh = models.tie.clone();
      }
      baseMesh.scale.setScalar(0.42);
      scene.add(baseMesh);

      const lateralLane = (Math.random() > 0.5 ? 1 : -1) * (13 + Math.random() * 12);
      const vertLane = defaultShipPos.y + (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5);

      enemySpawnCounter++;
      const isElite = !isRaid && (useTie2Mesh || enemySpawnCounter % 2 === 0);
      const baseHp = isRaid ? 7 : (isElite ? 6 : 4);

      let shootCd = 0.95 + Math.random() * 0.6;
      if (isRaid) {
        shootCd = 0.9;
      } else if (isElite) {
        shootCd = 0.65 + Math.random() * 0.45;
      }

      enemies.push({
        mesh: baseMesh,
        state: 'attacking',
        pos: new THREE.Vector3(startX, startY, startZ),
        targetX: lateralLane,
        targetY: vertLane,
        speed: 42 + stageRef.current * 3 + Math.random() * 6,
        shootCooldown: shootCd,
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
    let bossHullHitCount = 0;
    let nextExplosionThreshold = 8;
    let isBossExecutingSpecial = false;
    let raidTotalEnemies = 10;

    const initBoss = () => {
      const grp = models.destroyer.clone();
      grp.scale.setScalar(0.0001);
      grp.position.set(0, 18, -380);
      grp.rotation.set(0, Math.PI, 0);
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
        hullHp: 140,
        maxHullHp: 140,
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
    let asteroidSpawnTimer = 0;
    let trashSpawnTimer = 0;
    let derelictSpawnTimer = 0;

    let fireCooldown = 0;
    let shakeIntensity = 0;
    let currentHp = 100;
    let currentShield = shipConf.shield;

    let currentScore = 0;
    let currentKills = 0;
    let currentDamage = 0;
    let currentStagesDone = 0;

    let transitionDuration = 0;

    let lightningTimer = 0;
    let lightningInterval = 13 + Math.random() * 2;
    let playerHitByLightningOnce = false;
    let playerStunDuration = 0;
    let activeLightningMesh: THREE.Line | null = null;
    let activeLightningLife = 0;

    let isDefeatSequenceActive = false;

    const triggerDefeatSequence = () => {
      if (isDefeatSequenceActive || isEndingSequenceRef.current) return;
      isDefeatSequenceActive = true;
      isDeadRef.current = true;

      spawnRetroExplosion(shipPos, 3.0, true, false);
      shipHolder.visible = false;
      crosshairTex.visible = false;

      const earned = Math.floor(currentScore * 0.12 + currentKills * 35 + currentStagesDone * 150);
      setCreditsEarned(earned);
      if (onAddCreditsRef.current) {
        onAddCreditsRef.current(earned);
      }

      setTimeout(() => {
        if (isDisposed) return;
        setCurtainVisible(true);

        setTimeout(() => {
          if (isDisposed) return;
          isPausedRef.current = true;
          if (xwingGainRef.current) xwingGainRef.current.gain.value = 0;
          if (tieEngineGainRef.current) tieEngineGainRef.current.gain.value = 0;
          setEndGameModal('defeat');
        }, 500);
      }, 1000);
    };

    let isVictorySequenceActive = false;

    const triggerVictorySequence = () => {
      if (isVictorySequenceActive || isEndingSequenceRef.current) return;
      isVictorySequenceActive = true;
      bossData!.destroyed = true;

      currentScore += 5000;
      setScore(currentScore);

      const earned = Math.floor(currentScore * 0.12 + currentKills * 35 + currentStagesDone * 150 + 600);
      setCreditsEarned(earned);
      if (onAddCreditsRef.current) {
        onAddCreditsRef.current(earned);
      }

      spawnRetroExplosion(bossData!.pos, 3.5, true, false);

      if (bossSoundtrackSourceRef.current) {
        try { bossSoundtrackSourceRef.current.stop(); } catch {}
        bossSoundtrackSourceRef.current = null;
      }

      setShowVictoryCutscene(true);
    };

    const handleVictoryCutsceneDone = () => {
      setShowVictoryCutscene(false);
      setCurtainVisible(true);
      isPausedRef.current = true;
      if (xwingGainRef.current) xwingGainRef.current.gain.value = 0;
      if (tieEngineGainRef.current) tieEngineGainRef.current.gain.value = 0;
      setTimeout(() => {
        if (isDisposed) return;
        setEndGameModal('victory');
      }, 450);
    };

    const applyDamageToPlayer = (dmg: number) => {
      if (godModeRef.current || isDeadRef.current || inBiomeTransitionRef.current || bossCutsceneActiveRef.current || showHallwayCutscene || showVictoryCutsceneRef.current) {
        if (godModeRef.current) spawnShieldImpact(shipPos);
        return;
      }
      if (currentShield > 0) {
        const absorbed = Math.min(currentShield, dmg);
        currentShield -= absorbed;
        setShieldHp(currentShield);
        dmg -= absorbed;
        spawnShieldImpact(shipPos);
      }
      if (dmg > 0) {
        currentHp = Math.max(0, currentHp - dmg);
        setHp(currentHp);
        shakeIntensity = Math.max(shakeIntensity, 0.55);
        if (currentHp <= 0 && !isDeadRef.current) {
          triggerDefeatSequence();
        }
      }
    };

    const applyStageHeal = (amt: number) => {
      currentHp = Math.min(100, currentHp + amt);
      setHp(currentHp);
      if (shipConf.shield > 0) {
        currentShield = Math.min(shipConf.shield, currentShield + Math.floor(amt * 0.75));
        setShieldHp(currentShield);
      }
      setHealBonus(amt);
      setTimeout(() => setHealBonus(0), 1200);
    };

    const triggerLightning = (forcePlayer = false) => {
      const startL = new THREE.Vector3((Math.random() - 0.5) * 120, 50 + Math.random() * 25, -120 - Math.random() * 150);
      let endL = new THREE.Vector3((Math.random() - 0.5) * 140, -40 - Math.random() * 25, -70 - Math.random() * 140);

      const dist = shipPos.distanceTo(startL);
      playThunderSound(dist);

      if (forcePlayer) {
        endL.copy(shipPos);
        playerStunDuration = 4.5;
        setPlayerStunned(true);
        shakeIntensity = 1.2;
        applyDamageToPlayer(8);
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
          applyDamageToPlayer(8);
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

      if (isPausedRef.current) {
        renderer.render(scene, camera);
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      const dt = realDt;

      if (ability1CooldownRef.current > 0) {
        ability1CooldownRef.current = Math.max(0, ability1CooldownRef.current - dt);
        setAbility1Cooldown(Math.ceil(ability1CooldownRef.current));
      }
      if (ability2CooldownRef.current > 0) {
        ability2CooldownRef.current = Math.max(0, ability2CooldownRef.current - dt);
        setAbility2Cooldown(Math.ceil(ability2CooldownRef.current));
      }

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
        let targetColor = 0x0c111a;
        let titleText = 'ТУМАННОСТЬ';
        if (forcedType === 'ionic_vapors') {
          targetColor = 0x220524;
          titleText = 'ИОННЫЕ ИСПАРЕНИЯ';
        } else if (forcedType === 'asteroid_field') {
          targetColor = 0x070a10;
          titleText = 'ПОЛЕ АСТЕРОИДОВ';
        } else if (forcedType === 'junkyard') {
          targetColor = 0x0b0d10;
          titleText = 'КОСМИЧЕСКАЯ СВАЛКА';
        }
        biomeRunRef.current[stageIdx] = { type: forcedType, title: titleText, fogColor: targetColor };
        clearAllPlanets();
        clearJunkyardDreadnought();
        if (forcedType === 'junkyard') {
          spawnJunkyardDreadnought();
        }
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
      const hasLightningBiome = !bossData && !bossCutsceneActiveRef.current && (currentStep.type === 'nebula_storm');

      if (hasLightningBiome && !inBiomeTransitionRef.current && !showHallwayCutscene && !showVictoryCutsceneRef.current) {
        lightningTimer += dt;
        if (lightningTimer >= lightningInterval) {
          lightningTimer = 0;
          lightningInterval = 12 + Math.random() * 3;
          triggerLightning();
        }
      }

      if (currentStep.type === 'asteroid_field' && !inBiomeTransitionRef.current && !bossData && !showHallwayCutscene) {
        asteroidSpawnTimer += dt;
        if (asteroidSpawnTimer >= 1.6) {
          asteroidSpawnTimer = 0;
          if (asteroids.length < 9) {
            spawnAsteroid();
          }
        }
      }

      if (currentStep.type === 'junkyard' && !inBiomeTransitionRef.current && !bossData && !showHallwayCutscene) {
        trashSpawnTimer += dt;
        if (trashSpawnTimer >= 1.2) {
          trashSpawnTimer = 0;
          if (trashItems.length < 14) {
            spawnTrashItem();
          }
        }
        derelictSpawnTimer += dt;
        if (derelictSpawnTimer >= 18.0) {
          derelictSpawnTimer = 0;
          if (derelictTies.length < 2) {
            spawnDerelictTie();
          }
        }
      }

      let insideAnyCloud = false;
      if (currentStep.type === 'ionic_vapors' && !inBiomeTransitionRef.current && !bossData) {
        if (ionicClouds.length === 0) {
          spawnIonicCloud(-220);
          spawnIonicCloud(-460);
        }
        for (const ic of ionicClouds) {
          if (Math.abs(ic.pos.z - shipPos.z) < ic.cloudLength * 0.5 && Math.hypot(ic.pos.x - shipPos.x, ic.pos.y - shipPos.y) < ic.radius) {
            insideAnyCloud = true;
          }
        }
      }

      const targetFogDensity = insideAnyCloud ? baseFogDensity * 1.35 : baseFogDensity;
      (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp((scene.fog as THREE.FogExp2).density, targetFogDensity, dt * 2.0);

      if (playerStunDuration > 0) {
        playerStunDuration -= dt;
        shipPitch += dt * 1.2;
        shipBank += dt * 1.5;
        shipHolder.rotation.set(shipPitch, 0, shipBank);
        if (playerStunDuration <= 0) {
          setPlayerStunned(false);
        }
      }

      let closestTieDistance = 999;
      for (const e of enemies) {
        const d = e.pos.distanceTo(camera.position);
        if (d < closestTieDistance) {
          closestTieDistance = d;
        }
      }

      if (tieEngineGainRef.current) {
        if (closestTieDistance < 130 && !showHallwayCutscene && !showVictoryCutsceneRef.current) {
          const factor = Math.max(0, 1 - closestTieDistance / 130);
          tieEngineGainRef.current.gain.value = factor * 0.22;
        } else {
          tieEngineGainRef.current.gain.value = 0;
        }
      }

      if (xwingGainRef.current) {
        xwingGainRef.current.gain.value = (isDeadRef.current || showVictoryCutsceneRef.current) ? 0 : 0.14;
      }

      if (!bossSpawned && stageIdx < 4 && !isDeadRef.current && !showVictoryCutsceneRef.current) {
        stageTimer += dt;
        const pFrac = Math.min(1, stageTimer / STAGE_DURATION);
        setStageProgressPercent(Math.floor(pFrac * 100));

        if (stageTimer >= STAGE_DURATION) {
          stageTimer = 0;
          stageIdx++;
          stageRef.current = stageIdx;
          setCurrentStage(stageIdx);
          setStageProgressPercent(0);

          currentStagesDone += 1;
          setStagesCompleted(currentStagesDone);
          currentScore += 1000;
          setScore(currentScore);

          if (stageIdx < 4) {
            applyStageHeal(15);
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
            clearJunkyardDreadnought();
            for (const ic of ionicClouds) scene.remove(ic.mesh);
            ionicClouds.length = 0;

            if (step.type === 'planet' && step.planet) {
              spawnPlanet(step.planet);
            } else if (step.type === 'junkyard') {
              spawnJunkyardDreadnought();
            }
          }
        }
      } else if (!bossSpawned && stageIdx >= 4 && !bossCutsceneActiveRef.current && !isDeadRef.current) {
        applyStageHeal(25);
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
        shipHolder.position.copy(shipPos);

        camera.position.copy(bossCutsceneCamPos);
        camera.lookAt(shipHolder.position.x, shipHolder.position.y, shipHolder.position.z - 20);

        if (bossData) {
          if (bossCutsceneTimer >= 1.5) {
            const growProgress = THREE.MathUtils.clamp((bossCutsceneTimer - 1.5) / 3.0, 0, 1);
            const easeScale = 1 - Math.pow(1 - growProgress, 3);
            bossData.group.scale.setScalar(0.0001 + easeScale * 8.0);
          }
        }

        if (bossCutsceneTimer >= 7.0) {
          bossCutsceneActiveRef.current = false;
          setBossCutsceneActive(false);

          shipPos.set(0, -1.2, 0);
          shipHolder.position.copy(shipPos);
          camera.position.copy(cameraBase);

          setBossActive(true);
        }
      }

      if (inBiomeTransitionRef.current) {
        transitionDuration += dt;
        if (transitionDuration >= 3.0) {
          inBiomeTransitionRef.current = false;
          setInBiomeTransition(false);
        }
      }

      const activeSpeed = (isDeadRef.current || isEndingSequenceRef.current) ? 0 : 160;
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
        const pSpeed = (isDeadRef.current || isEndingSequenceRef.current) ? 0 : (pl.userData.speed || 38);
        pl.position.z += pSpeed * dt;
        pl.rotation.y += 0.001 * dt;
        if (pl.position.z > camera.position.z + pl.userData.radius + 60) {
          scene.remove(pl);
          pl.geometry.dispose();
          planetMeshes.splice(i, 1);
        }
      }

      if (junkyardDreadnought && !(isDeadRef.current || isEndingSequenceRef.current)) {
        junkyardDreadnought.position.z += 18 * dt;
        junkyardDreadnought.rotation.z += 0.0004 * dt;
      }

      const input = (isDeadRef.current || inBiomeTransitionRef.current || playerStunDuration > 0 || showHallwayCutscene || showVictoryCutsceneRef.current)
        ? { x: 0, y: 0, fire: false }
        : inputRef.current;

      if (!isDeadRef.current) {
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

        shipHolder.position.copy(shipPos);

        if (playerStunDuration <= 0) {
          const bankTarget = Math.max(-0.65, Math.min(0.65, -shipVx * 0.038));
          const pitchTarget = Math.max(-0.4, Math.min(0.4, -shipVy * 0.024));

          shipBank = THREE.MathUtils.lerp(shipBank, bankTarget, 1 - Math.exp(-6.5 * dt));
          shipPitch = THREE.MathUtils.lerp(shipPitch, pitchTarget, 1 - Math.exp(-6.5 * dt));

          shipHolder.rotation.set(shipPitch, 0, shipBank);
        }
      }

      if (!bossCutsceneActiveRef.current && !isDeadRef.current) {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraBase.x + shipPos.x * 0.32, 1 - Math.exp(-6.0 * dt));
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraBase.y + (shipPos.y - defaultShipPos.y) * 0.32, 1 - Math.exp(-6.0 * dt));
      }

      let autoTargetPos: THREE.Vector3 | null = null;
      let bestScore = 9999;

      if (playerStunDuration <= 0 && !isDeadRef.current && !showHallwayCutscene && !showVictoryCutsceneRef.current) {
        for (const e of enemies) {
          if (e.state === 'attacking' && e.pos.z < shipPos.z - 2) {
            const d = e.pos.distanceTo(shipPos);
            if (d < 220) {
              const angleDist = Math.hypot(e.pos.x - shipPos.x, e.pos.y - shipPos.y);
              const curScore = d + angleDist * 8;
              if (curScore < bestScore) {
                bestScore = curScore;
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
                const curScore = d * 0.3 + angleDist * 4;
                if (curScore < bestScore) {
                  bestScore = curScore;
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

      const shipForward = new THREE.Vector3(0, 0, -1).applyEuler(shipHolder.rotation).normalize();
      const defaultAimDistance = 140;
      let bulletAimTarget = shipPos.clone().addScaledVector(shipForward, defaultAimDistance);

      if (playerStunDuration > 0 || isDeadRef.current || showHallwayCutscene || showVictoryCutsceneRef.current) {
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

      if (triggerBombRef.current) {
        triggerBombRef.current = false;
        spawnProtonBomb(shipPos.clone().add(new THREE.Vector3(0, -0.3, -0.6)));
      }

      if (triggerBrotherHelpRef.current) {
        triggerBrotherHelpRef.current = false;
        triggerBrotherHelpAttack();
      }

      for (let wIdx = wingmanFlyers.length - 1; wIdx >= 0; wIdx--) {
        const wf = wingmanFlyers[wIdx];
        wf.life -= dt;

        wf.pos.z += wf.vel.z * dt;

        if (wf.life < 1.4) {
          wf.pos.x += wf.side * 42 * dt;
          wf.pos.y += 18 * dt;
          wf.mesh.rotation.z = THREE.MathUtils.lerp(wf.mesh.rotation.z, -wf.side * 0.48, dt * 5.5);
          wf.mesh.rotation.x = THREE.MathUtils.lerp(wf.mesh.rotation.x, -0.18, dt * 5.5);
        }

        wf.mesh.position.copy(wf.pos);

        if (wf.engineGain) {
          const distToCam = wf.pos.distanceTo(camera.position);
          const dynamicVol = THREE.MathUtils.clamp(Math.pow(1 - Math.min(1, distToCam / 75), 1.8) * 0.4, 0.02, 0.38);
          wf.engineGain.gain.value = dynamicVol;
        }

        if (wf.life <= 0) {
          if (wf.engineSource) {
            try { wf.engineSource.stop(); } catch {}
          }
          scene.remove(wf.mesh);
          wingmanFlyers.splice(wIdx, 1);
        }
      }

      for (let bIdx = protonBombs.length - 1; bIdx >= 0; bIdx--) {
        const bomb = protonBombs[bIdx];
        bomb.life -= dt;

        if (bomb.targetRef && bomb.targetRef.hp > 0 && bomb.targetRef.state === 'attacking') {
          bomb.targetPos.copy(bomb.targetRef.pos);
        }

        const toTarget = new THREE.Vector3().subVectors(bomb.targetPos, bomb.mesh.position);
        const distToTarget = toTarget.length();

        bomb.speed = THREE.MathUtils.lerp(bomb.speed, 380, dt * 3.6);

        const trackDamp = THREE.MathUtils.clamp(dt * (15.0 + (1.0 / Math.max(0.2, distToTarget)) * 50.0), 0, 1);
        const desiredDir = toTarget.normalize();
        bomb.vel.lerp(desiredDir.multiplyScalar(bomb.speed), trackDamp);

        bomb.mesh.position.addScaledVector(bomb.vel, dt);

        let bombHit = false;

        if (bomb.targetRef && bomb.targetRef.hp > 0) {
          if (bomb.mesh.position.distanceTo(bomb.targetRef.pos) < 4.8) {
            bombHit = true;
            const victim = bomb.targetRef;
            victim.state = 'disabled';
            victim.disabledTimer = 0.55;
            victim.hp = 0;
            currentDamage += 120;
            setDamageDealt(currentDamage);
            currentScore += 350;
            setScore(currentScore);
            currentKills += 1;
            setEnemiesKilled(currentKills);

            spawnRetroExplosion(bomb.mesh.position, 1.8, true, false);
          }
        }

        if (!bombHit) {
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (e.state === 'attacking' && bomb.mesh.position.distanceTo(e.pos) < 4.5) {
              bombHit = true;
              e.state = 'disabled';
              e.disabledTimer = 0.55;
              e.hp = 0;
              currentDamage += 120;
              setDamageDealt(currentDamage);
              currentScore += 350;
              setScore(currentScore);
              currentKills += 1;
              setEnemiesKilled(currentKills);

              spawnRetroExplosion(bomb.mesh.position, 1.8, true, false);
              break;
            }
          }
        }

        if (!bombHit && bossData && !bossData.destroyed && !bossData.raidActive && !bossCutsceneActiveRef.current) {
          const hasGenerators = bossData.generators.some((g) => !g.destroyed);
          if (hasGenerators) {
            for (const gen of bossData.generators) {
              if (!gen.destroyed) {
                const worldGPos = gen.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
                if (bomb.mesh.position.distanceTo(worldGPos) < 14.0) {
                  bombHit = true;
                  gen.hp = Math.max(0, gen.hp - 8);
                  currentDamage += 160;
                  setDamageDealt(currentDamage);
                  currentScore += 180;
                  setScore(currentScore);

                  spawnRetroExplosion(bomb.mesh.position, 2.6, true, false);

                  if (gen.hp <= 0) {
                    gen.destroyed = true;
                    spawnRetroExplosion(worldGPos, 2.2, true, false);
                    currentScore += 500;
                    setScore(currentScore);
                  }
                  break;
                }
              }
            }
          } else {
            const dx = Math.abs(bomb.mesh.position.x - bossData.pos.x);
            const dy = Math.abs(bomb.mesh.position.y - bossData.pos.y);
            const dz = Math.abs(bomb.mesh.position.z - bossData.pos.z);
            if (dx < 34 && dy < 18 && dz < 55) {
              bombHit = true;
              bossData.hullHp -= 10;
              currentDamage += 180;
              setDamageDealt(currentDamage);
              currentScore += 220;
              setScore(currentScore);

              spawnRetroExplosion(bomb.mesh.position, 2.8, true, false);

              if (bossData.hullHp <= 0) {
                triggerVictorySequence();
              }
            }
          }
        }

        if (bombHit || bomb.life <= 0 || distToTarget < 1.2) {
          if (!bombHit && distToTarget < 1.8) {
            spawnRetroExplosion(bomb.mesh.position, 2.4, true, false);
          }
          scene.remove(bomb.mesh);
          protonBombs.splice(bIdx, 1);
        }
      }

      for (let aIdx = asteroids.length - 1; aIdx >= 0; aIdx--) {
        const ast = asteroids[aIdx];
        ast.pos.addScaledVector(ast.vel, dt);
        ast.mesh.rotation.x += ast.rotSpeed.x * dt;
        ast.mesh.rotation.y += ast.rotSpeed.y * dt;
        ast.mesh.rotation.z += ast.rotSpeed.z * dt;

        if (!isDeadRef.current && ast.pos.distanceTo(shipPos) < ast.radius + 1.1) {
          applyDamageToPlayer(12);
          playClapSound(0.48);
          spawnRetroExplosion(ast.pos, 1.4);
          scene.remove(ast.mesh);
          ast.mesh.geometry.dispose();
          asteroids.splice(aIdx, 1);
          continue;
        }

        for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = enemies[eIdx];
          const distToTie = e.pos.distanceTo(ast.pos);
          if (distToTie < ast.radius + 3.8 && e.state === 'attacking') {
            if (Math.random() < 0.10) {
              e.hp = 0;
              e.state = 'disabled';
              e.disabledTimer = 0.2;
              spawnRetroExplosion(e.pos, 2.0);
              ast.hp -= 2;
            } else {
              const avoidDir = (e.pos.x > ast.pos.x ? 1 : -1);
              e.pos.x += avoidDir * 18 * dt;
            }
          }
        }

        if (ast.hp <= 0 || ast.pos.z > camera.position.z + 20) {
          if (ast.hp <= 0) {
            spawnRetroExplosion(ast.pos, 1.3);
            currentScore += 25;
            setScore(currentScore);
          }
          scene.remove(ast.mesh);
          ast.mesh.geometry.dispose();
          asteroids.splice(aIdx, 1);
        }
      }

      for (let tIdx = trashItems.length - 1; tIdx >= 0; tIdx--) {
        const tr = trashItems[tIdx];
        tr.pos.addScaledVector(tr.vel, dt);
        tr.mesh.rotation.x += tr.rotSpeed.x * dt;
        tr.mesh.rotation.y += tr.rotSpeed.y * dt;

        if (!isDeadRef.current && tr.pos.distanceTo(shipPos) < tr.radius + 1.0) {
          applyDamageToPlayer(8);
          playClapSound(0.42);
          const pushDir = new THREE.Vector3().subVectors(tr.pos, shipPos).normalize();
          tr.vel.addScaledVector(pushDir, 35);
        }

        if (tr.pos.z > camera.position.z + 20) {
          scene.remove(tr.mesh);
          tr.mesh.geometry.dispose();
          trashItems.splice(tIdx, 1);
        }
      }

      for (let dIdx = derelictTies.length - 1; dIdx >= 0; dIdx--) {
        const dtie = derelictTies[dIdx];
        dtie.pos.addScaledVector(dtie.vel, dt);
        dtie.mesh.rotation.x += dtie.rotSpeed.x * dt;
        dtie.mesh.rotation.y += dtie.rotSpeed.y * dt;

        if (dtie.hp <= 0) {
          spawnRetroExplosion(dtie.pos, 2.6);
          currentScore += 150;
          setScore(currentScore);

          let affectedTrash = 0;
          for (const tr of trashItems) {
            if (tr.pos.distanceTo(dtie.pos) < 26 && affectedTrash < 3) {
              const impulse = new THREE.Vector3().subVectors(tr.pos, dtie.pos).normalize().multiplyScalar(45);
              tr.vel.add(impulse);
              affectedTrash++;
            }
          }

          scene.remove(dtie.mesh);
          derelictTies.splice(dIdx, 1);
          continue;
        }

        if (dtie.pos.z > camera.position.z + 20) {
          scene.remove(dtie.mesh);
          derelictTies.splice(dIdx, 1);
        }
      }

      for (let cIdx = ionicClouds.length - 1; cIdx >= 0; cIdx--) {
        const c = ionicClouds[cIdx];
        c.pos.z += 16 * dt;
        c.mesh.position.copy(c.pos);
        if (c.pos.z > camera.position.z + c.radius + 20) {
          scene.remove(c.mesh);
          c.mesh.geometry.dispose();
          ionicClouds.splice(cIdx, 1);
        }
      }

      fireCooldown -= dt;
      const calcFireCooldown = THREE.MathUtils.clamp(0.35 - (shipConf.fireRate / 60) * 0.18, 0.14, 0.32);

      if (input.fire && fireCooldown <= 0 && playerStunDuration <= 0 && !isDeadRef.current && !showHallwayCutscene) {
        fireCooldown = calcFireCooldown;

        const leftOffset = new THREE.Vector3(-0.46, 0, -0.3).applyQuaternion(shipHolder.quaternion);
        const rightOffset = new THREE.Vector3(0.46, 0, -0.3).applyQuaternion(shipHolder.quaternion);

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

      const maxSimultaneousEnemies = Math.min(8, 3 + stageIdx);

      if (!inBiomeTransitionRef.current && !bossData && !showHallwayCutscene && !isDeadRef.current) {
        spawnTimer += dt;
        const dynamicSpawnInterval = Math.max(1.7, 3.8 - stageIdx * 0.55);
        if (spawnTimer > dynamicSpawnInterval) {
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
        const isAbilityActive = zoneAttack.active || tractorBeam.active || isBossExecutingSpecial;

        if (activeGenHp > 0) {
          setBossShieldsDown(false);
          setBossBarMode('shield');
          setBossBarPercent(Math.floor((activeGenHp / totalGenHp) * 100));
        } else if (!bossData.phase2Active) {
          if (!isAbilityActive) {
            bossData.phase2Active = true;
            bossData.raidActive = true;
            setBossShieldsDown(true);
            setBossBarMode('raid');
            setBossBarPercent(100);

            bossData.group.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (m) {
                  m.transparent = true;
                  m.opacity = 0.3;
                  m.needsUpdate = true;
                }
              }
            });

            for (let k = 0; k < 7; k++) {
              setTimeout(() => {
                if (!isDisposed) spawnEnemy(k % 2 === 0 ? -1 : 1, false);
              }, k * 180);
            }

            for (let k = 0; k < 3; k++) {
              setTimeout(() => {
                if (!isDisposed) spawnEnemy(k % 2 === 0 ? 1 : -1, true);
              }, 1300 + k * 260);
            }
          } else {
            setBossShieldsDown(false);
            setBossBarMode('shield');
            setBossBarPercent(0);
          }
        } else if (bossData.raidActive) {
          setBossShieldsDown(true);
          setBossBarMode('raid');
          const remainingEnemies = enemies.length;
          setBossBarPercent(Math.floor(Math.min(100, Math.max(0, (remainingEnemies / raidTotalEnemies) * 100))));

          if (remainingEnemies === 0 && !bossData.raidCompleted) {
            bossData.raidActive = false;
            bossData.raidCompleted = true;
            setBossBarMode('hull');
            setBossBarPercent(Math.floor((bossData.hullHp / bossData.maxHullHp) * 100));

            currentScore += 2500;
            setScore(currentScore);

            bossData.zoneCooldown = 12.0;
            bossData.tractorCooldown = 16.0;
            bossData.squadCooldown = 16.0;
            bossData.bombardCooldown = 8.0;
            bossData.shootCooldown = 1.4;

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
        if (!bossData.phase2Active && !showHallwayCutscene) {
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

        if (!bossData.raidActive && !bossCutsceneActiveRef.current && !inBiomeTransitionRef.current && !showHallwayCutscene && !isDeadRef.current) {
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
                applyDamageToPlayer(18);
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
              spawnRetroExplosion(e.pos, 2.5, true, false);
              if (Math.random() < 0.25) {
                spawnDatapad(e.pos);
              }
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

          if (!showHallwayCutscene && !isDeadRef.current) {
            e.shootCooldown -= dt;
            if (e.shootCooldown <= 0 && e.pos.z < shipPos.z - 18 && e.pos.z > -160) {
              e.shootCooldown = e.isRaid ? 0.9 : e.isElite ? 0.8 + Math.random() * 0.5 : 1.1 + Math.random() * 0.7;
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
                  if (!isDisposed && e.hp > 0 && !bossCutsceneActiveRef.current && !showHallwayCutscene) {
                    fireSalvo(-0.5);
                  }
                }, 110);
              }

              const distVolume = Math.max(0, Math.min(0.25, (1 - distToCam / 135) * 0.25));
              if (distVolume > 0.02) {
                playBuffer(audioBuffers.tieShot, distVolume, true);
              }
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
          const isSlave1 = shipConf.id === 'slave1';
          const hitRadiusX = isSlave1 ? 1.5 : 1.3;
          const hitRadiusY = isSlave1 ? 2.4 : 1.3;
          const hitRadiusZ = 1.8;

          const dx = Math.abs(l.mesh.position.x - shipPos.x);
          const dy = l.mesh.position.y - shipPos.y;
          const dz = Math.abs(l.mesh.position.z - shipPos.z);

          const isHit = isSlave1
            ? dx < hitRadiusX && dy > -1.0 && dy < hitRadiusY && dz < hitRadiusZ
            : l.mesh.position.distanceTo(shipPos) < 1.3;

          if (isHit) {
            l.life = 0;
            applyDamageToPlayer(5);
          }
        } else {
          let hitAny = false;

          for (let dIdx = bossSpaceDebris.length - 1; dIdx >= 0; dIdx--) {
            const deb = bossSpaceDebris[dIdx];
            if (l.mesh.position.distanceTo(deb.pos) < deb.radius + 1.2) {
              l.life = 0;
              hitAny = true;
              scene.remove(deb.mesh);
              deb.mesh.geometry.dispose();
              bossSpaceDebris.splice(dIdx, 1);
              break;
            }
          }

          if (!hitAny) {
            for (let aIdx = asteroids.length - 1; aIdx >= 0; aIdx--) {
              const ast = asteroids[aIdx];
              if (l.mesh.position.distanceTo(ast.pos) < ast.radius + 0.6) {
                l.life = 0;
                hitAny = true;
                ast.hp -= 1;
                spawnRetroExplosion(l.mesh.position, 0.7, false);
                break;
              }
            }
          }

          if (!hitAny) {
            for (let dtIdx = derelictTies.length - 1; dtIdx >= 0; dtIdx--) {
              const dtie = derelictTies[dtIdx];
              if (l.mesh.position.distanceTo(dtie.pos) < dtie.radius + 0.8) {
                l.life = 0;
                hitAny = true;
                dtie.hp -= 1;
                spawnRetroExplosion(l.mesh.position, 0.8, false);
                break;
              }
            }
          }

          if (!hitAny) {
            for (let j = enemies.length - 1; j >= 0; j--) {
              const e = enemies[j];
              if (l.mesh.position.distanceTo(e.pos) < 3.8) {
                l.life = 0;
                hitAny = true;
                const dealt = shipConf.damage >= 45 ? 2 : 1;
                e.hp -= dealt;

                currentDamage += dealt * 25;
                setDamageDealt(currentDamage);
                currentScore += dealt * 30;
                setScore(currentScore);

                if (e.hp <= 0) {
                  spawnRetroExplosion(e.pos);
                  shakeIntensity = Math.max(shakeIntensity, 0.8);

                  currentKills += 1;
                  setEnemiesKilled(currentKills);
                  currentScore += e.isRaid ? 250 : e.isElite ? 180 : 100;
                  setScore(currentScore);

                  if (Math.random() < 0.0745) {
                    spawnDatapad(e.pos);
                  }

                  scene.remove(e.mesh);
                  enemies.splice(j, 1);
                }
                break;
              }
            }
          }

          if (!hitAny && bossData && !bossData.destroyed && !bossData.raidActive && !bossCutsceneActiveRef.current) {
            bossData.group.updateMatrixWorld(true);
            const hasGenerators = bossData.generators.some((g) => !g.destroyed);

            if (hasGenerators) {
              for (const gen of bossData.generators) {
                if (!gen.destroyed) {
                  const worldGPos = gen.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
                  if (l.mesh.position.distanceTo(worldGPos) < 14.0) {
                    l.life = 0;
                    hitAny = true;
                    const dealt = (shipConf.damage >= 45 ? 2 : 1);
                    gen.hp -= dealt;

                    currentDamage += dealt * 35;
                    setDamageDealt(currentDamage);
                    currentScore += dealt * 40;
                    setScore(currentScore);

                    if (gen.hp <= 0) {
                      gen.destroyed = true;
                      spawnRetroExplosion(worldGPos, 1.8);
                      currentScore += 500;
                      setScore(currentScore);
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
                const dealt = (shipConf.damage >= 45 ? 2 : 1);
                bossData.hullHp -= dealt;

                currentDamage += dealt * 40;
                setDamageDealt(currentDamage);
                currentScore += dealt * 50;
                setScore(currentScore);

                bossHullHitCount++;
                if (bossHullHitCount >= nextExplosionThreshold) {
                  bossHullHitCount = 0;
                  nextExplosionThreshold = Math.floor(7 + Math.random() * 3);
                  spawnRetroExplosion(l.mesh.position, 0.8, false);
                }

                if (bossData.hullHp <= 0) {
                  triggerVictorySequence();
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

        dp.pos.z += 95 * dt;

        const dToPlayer = dp.pos.distanceTo(shipPos);
        if (dToPlayer < 85 && !isDeadRef.current) {
          const pullDir = new THREE.Vector3().subVectors(shipPos, dp.pos).normalize();
          dp.pos.addScaledVector(pullDir, 120 * dt);
          dp.pos.lerp(shipPos, dt * 8.0);
        }
        dp.mesh.position.copy(dp.pos);

        const isCloseEnough = !isDeadRef.current && (dToPlayer < 6.5 || (dp.pos.z >= shipPos.z - 1.5 && Math.hypot(dp.pos.x - shipPos.x, dp.pos.y - shipPos.y) < 5.5));

        if (isCloseEnough) {
          currentHp = Math.min(100, currentHp + dp.healPercent);
          setHp(currentHp);
          if (shipConf.shield > 0) {
            currentShield = Math.min(shipConf.shield, currentShield + Math.floor(dp.healPercent * 0.5));
            setShieldHp(currentShield);
          }
          setHealBonus(dp.healPercent);
          setTimeout(() => setHealBonus(0), 450);

          shipHolder.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (m && m.emissive) {
                m.emissive.setHex(0x44ff44);
                setTimeout(() => {
                  if (m && m.emissive) m.emissive.setHex(0x000000);
                }, 200);
              }
            }
          });

          scene.remove(dp.mesh);
          datapads.splice(i, 1);
        } else if (dp.pos.z > camera.position.z + 15) {
          scene.remove(dp.mesh);
          datapads.splice(i, 1);
        }
      }

      for (let i = shieldImpacts.length - 1; i >= 0; i--) {
        const si = shieldImpacts[i];
        si.life -= dt;
        const progress = 1 - si.life / si.maxLife;
        si.mesh.scale.setScalar(0.5 + progress * 1.1);
        (si.mesh.material as THREE.MeshBasicMaterial).opacity = (si.life / si.maxLife) * 0.9;
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
      protonBombs.forEach((b) => scene.remove(b.mesh));
      wingmanFlyers.forEach((w) => {
        if (w.engineSource) {
          try { w.engineSource.stop(); } catch {}
        }
        scene.remove(w.mesh);
      });
      asteroids.forEach((a) => {
        scene.remove(a.mesh);
        a.mesh.geometry.dispose();
      });
      trashItems.forEach((t) => {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
      });
      derelictTies.forEach((d) => scene.remove(d.mesh));
      ionicClouds.forEach((c) => {
        scene.remove(c.mesh);
        c.mesh.geometry.dispose();
      });
      enemies.forEach((e) => scene.remove(e.mesh));
      planetMeshes.forEach((pl) => scene.remove(pl));
      clearJunkyardDreadnought();
      debrisList.forEach((d) => scene.remove(d.mesh));
      shockwaves.forEach((s) => scene.remove(s.mesh));
      datapads.forEach((dp) => scene.remove(dp.mesh));
      shieldImpacts.forEach((si) => scene.remove(si.mesh));
      bossSpaceDebris.forEach((deb) => scene.remove(deb.mesh));
      scene.remove(crosshairTex);
      crosshairGeo.dispose();
      crosshairMat.dispose();
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
      if (xwingSource) {
        try { xwingSource.stop(); } catch {}
      }
      if (tieSource) {
        try { tieSource.stop(); } catch {}
      }
      if (bossSoundtrackSourceRef.current) {
        try { bossSoundtrackSourceRef.current.stop(); } catch {}
        bossSoundtrackSourceRef.current = null;
      }
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets, selectedShipId]);

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransitionRef.current || isPaused || isConsoleOpen || bossCutsceneActiveRef.current || playerStunned || showHallwayCutscene || showVictoryCutscene || endGameModal !== null || isDeadRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickTouchId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickActive(true);
    handleStickMove(e);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransitionRef.current || isPaused || isConsoleOpen || bossCutsceneActiveRef.current || playerStunned || showHallwayCutscene || showVictoryCutscene || endGameModal !== null || isDeadRef.current || stickTouchId.current !== e.pointerId) return;
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
    if (xwingGainRef.current) xwingGainRef.current.gain.value = 0;
    if (tieEngineGainRef.current) tieEngineGainRef.current.gain.value = 0;
    if (bossSoundtrackSourceRef.current) {
      try { bossSoundtrackSourceRef.current.stop(); } catch {}
      bossSoundtrackSourceRef.current = null;
    }
    setCurtainVisible(true);
    setTimeout(() => {
      if (onExitRef.current) {
        onExitRef.current();
      }
    }, 400);
  };

  const handleRestartGame = () => {
    playUiSound();
    if (xwingGainRef.current) xwingGainRef.current.gain.value = 0;
    if (tieEngineGainRef.current) tieEngineGainRef.current.gain.value = 0;
    if (bossSoundtrackSourceRef.current) {
      try { bossSoundtrackSourceRef.current.stop(); } catch {}
      bossSoundtrackSourceRef.current = null;
    }
    setCurtainVisible(true);
    setTimeout(() => {
      if (onRestartRef.current) {
        onRestartRef.current();
      } else if (onExitRef.current) {
        onExitRef.current();
      }
    }, 400);
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
    } else if (code === 'astfield77') {
      forceBiomeRef.current = 'asteroid_field';
      setConsoleFeedback('ПОЛЕ АСТЕРОИДОВ АКТИВИРОВАНО');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else if (code === 'junkyard88') {
      forceBiomeRef.current = 'junkyard';
      setConsoleFeedback('СВАЛКА АКТИВИРОВАНА');
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
    } else if (code === 'jekkepq392sjjsppp') {
      setIsConsoleOpen(false);
      setIsPaused(false);
      setConsoleInput('');
      setConsoleFeedback('');
      if (onTriggerIntroCutsceneRef.current) {
        onTriggerIntroCutsceneRef.current();
      }
    } else if (code === 'njsjaowp6659sjjp') {
      setIsConsoleOpen(false);
      setIsPaused(false);
      setConsoleInput('');
      setConsoleFeedback('');
      setShowVictoryCutscene(true);
    } else if (code === 'pqonfu$$shsji') {
      if (onAddCreditsRef.current) {
        onAddCreditsRef.current(999999);
      }
      setConsoleFeedback('ПОЛУЧЕНО 999999 КРЕДИТОВ');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
    } else {
      setConsoleFeedback('НЕВЕРНЫЙ КОД');
    }
  };

  const handleHallwayComplete = useCallback(() => {
    setShowHallwayCutscene(false);
  }, []);

  return (
    <>
      <GameUI
        assets={assets}
        mountRef={mountRef}
        curtainVisible={curtainVisible}
        hp={hp}
        maxShield={maxShield}
        shieldHp={shieldHp}
        healBonus={healBonus}
        score={score}
        enemiesKilled={enemiesKilled}
        damageDealt={damageDealt}
        stagesCompleted={stagesCompleted}
        creditsEarned={creditsEarned}
        endGameModal={endGameModal}
        joystickActive={joystickActive}
        joystickOffset={joystickOffset}
        ability1Cooldown={ability1Cooldown}
        ability2Cooldown={ability2Cooldown}
        inBiomeTransition={inBiomeTransition}
        biomeTitle={biomeTitle}
        biomeSubtext={biomeSubtext}
        isPaused={isPaused}
        isConsoleOpen={isConsoleOpen}
        consoleInput={consoleInput}
        consoleFeedback={consoleFeedback}
        showHallwayCutscene={showHallwayCutscene}
        currentStage={currentStage}
        stageProgressPercent={stageProgressPercent}
        bossActive={bossActive}
        bossShieldsDown={bossShieldsDown}
        bossBarMode={bossBarMode}
        bossBarPercent={bossBarPercent}
        bossCutsceneActive={bossCutsceneActive}
        playerStunned={playerStunned}
        zoneAttackUi={zoneAttackUi}
        tractorBeamUi={tractorBeamUi}
        generatorTargets={generatorTargets}
        onStickPointerDown={handleStickPointerDown}
        onStickMove={handleStickMove}
        onStickPointerUp={handleStickPointerUp}
        onTogglePause={handleTogglePause}
        onResume={handleResume}
        onOpenConsole={handleOpenConsole}
        onCloseConsole={handleCloseConsole}
        onRestartGame={handleRestartGame}
        onQuit={handleQuit}
        onConsoleInputChange={setConsoleInput}
        onApplyCheat={handleApplyCheat}
        onFirePointerDown={() => {
          if (!inBiomeTransition && !isPaused && !isConsoleOpen && !bossCutsceneActive && !playerStunned && !showHallwayCutscene && !showVictoryCutscene && endGameModal === null && !isDeadRef.current) setIsFiring(true);
        }}
        onFirePointerUp={() => setIsFiring(false)}
        onFirePointerCancel={() => setIsFiring(false)}
        onTriggerAbility1={handleTriggerAbility1}
        onTriggerAbility2={handleTriggerAbility2}
        onHallwayComplete={handleHallwayComplete}
      />

      {showVictoryCutscene && (
        <VictoryCutscene
          assets={assets}
          selectedShipId={selectedShipId}
          onComplete={handleVictoryCutsceneDone}
        />
      )}
    </>
  );
}
