import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';
import {
  Enemy, Laser, ShieldGenerator, BossZoneAttack, BossTractorBeam, BossState,
  PlanetItem, BiomeRunStep, generateBiomeRun, createProceduralPlanetTexture,
  availablePlanets, BiomeType, GeneratorScreenTarget, ShieldImpactEffect,
  DatapadItem, HealEffectParticle, ShieldBuffParticle, RageEffectIndicator,
  SlaveRocket, SlaveIonCharge, RocketTrailParticle, createExplosionGlowTexture,
  createExplosionRingTexture, createPinkGlowTexture, createPinkRingTexture,
  createCyanGlowTexture, createCyanRingTexture, createRedGlowTexture,
  createRedRingTexture, createPlusSignTexture, createExclamationTexture,
  createShieldIconTexture, ExplosionSmokeParticle, RetroExplosionInstance
} from './GameData.ts';
import { HANGAR_SHIPS } from '../components/HangarScreen.tsx';
import VictoryCutscene from '../cutscenes/VictoryCutscene.tsx';
import GameUI from './GameUI.tsx';

interface ProtonBomb {
  group: THREE.Group;
  coreMat: THREE.ShaderMaterial;
  waveMat: THREE.ShaderMaterial;
  waveMesh: THREE.Mesh;
  halo: THREE.Sprite;
  vel: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetRef: Enemy | null;
  speed: number;
  life: number;
  trailTimer: number; // <--- ДОБАВИТЬ ЭТУ СТРОКУ
  soundSource: AudioBufferSourceNode | null;
  soundGain: GainNode | null;
}

interface WingmanFlyer {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  side: number;
  life: number;
  flybyGain: GainNode | null;
  flybySource: AudioBufferSourceNode | null;
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
  const [ability3Cooldown, setAbility3Cooldown] = useState<number>(0);

  const ability1CooldownRef = useRef<number>(0);
  const ability2CooldownRef = useRef<number>(0);
  const ability3CooldownRef = useRef<number>(0);

  const isBrotherHelpActiveRef = useRef<boolean>(false);
  const isBombActiveRef = useRef<boolean>(false);
  const isSlaveRocketsActiveRef = useRef<boolean>(false);
  const isIonChargeActiveRef = useRef<boolean>(false);

  const triggerBombRef = useRef<boolean>(false);
  const triggerBrotherHelpRef = useRef<boolean>(false);
  const triggerRepairRef = useRef<boolean>(false);
  const triggerRageRef = useRef<boolean>(false);
  const triggerSlaveRocketsRef = useRef<boolean>(false);
  const triggerSlaveShieldRef = useRef<boolean>(false);
  const triggerSlaveIonRef = useRef<boolean>(false);

  const isRageActiveRef = useRef<boolean>(false);
  const rageTimerRef = useRef<number>(0);
  const [isRageActive, setIsRageActive] = useState<boolean>(false);

  const isSlaveShieldActiveRef = useRef<boolean>(false);
  const slaveShieldTimerRef = useRef<number>(0);
  const [isResistanceActive, setIsResistanceActive] = useState<boolean>(false);

  const [comboStreak, setComboStreak] = useState<number>(0);
  const comboStreakRef = useRef<number>(0);
  const comboTimerRef = useRef<number>(0);
  const [crosshairScreenPos, setCrosshairScreenPos] = useState<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const [showVictoryCutscene, setShowVictoryCutscene] = useState<boolean>(false);
  const [inBiomeTransition, setInBiomeTransition] = useState<boolean>(false);
  const [biomeTitle, setBiomeTitle] = useState<string>('');
  const [biomeSubtext, setBiomeSubtext] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [consoleInput, setConsoleInput] = useState<string>('');
  const [consoleFeedback, setConsoleFeedback] = useState<string>('');

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
  const noSignalSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const biomeRunRef = useRef<BiomeRunStep[]>(generateBiomeRun(availablePlanets));

  useEffect(() => {
    isPausedRef.current = isPaused;
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
    if (isPaused && noSignalSourceRef.current) {
      try { noSignalSourceRef.current.stop(); } catch {}
      noSignalSourceRef.current = null;
    }
  }, [isPaused, endGameModal, showVictoryCutscene, assets.audioCtx]);

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

  const playRandomHealSound = () => {
    const healKeys = ['heal1', 'heal2', 'heal3', 'heal4'];
    const chosen = healKeys[Math.floor(Math.random() * healKeys.length)];
    const buf = assets.audioBuffers[chosen];
    if (buf) {
      playBuffer(buf, 0.5);
    } else {
      playTone(260, 520, 0.35, 0.3, 'sine');
    }
  };

  const playBrotherHelpSound = () => {
    const chosen = Math.random() > 0.5 ? assets.audioBuffers.brother1 : assets.audioBuffers.brother2;
    if (chosen) {
      playBuffer(chosen, 0.65);
    }
  };

  const playThunderSound = (distToPlayer: number, isDirectHit = false) => {
    const tKeys = ['thunder1', 'thunder2'];
    const chosen = tKeys[Math.floor(Math.random() * tKeys.length)];
    const buf = assets.audioBuffers[chosen];
    const vol = isDirectHit ? 1.0 : THREE.MathUtils.clamp((1 - distToPlayer / 340) * 0.95, 0.35, 0.90);
    if (buf) {
      playBuffer(buf, vol, true);
    } else {
      playTone(95, 30, 2.2, vol, 'sine');
    }
  };

  const startNoSignalSound = () => {
    if (noSignalSourceRef.current) {
      try { noSignalSourceRef.current.stop(); } catch {}
      noSignalSourceRef.current = null;
    }
    if (!assets.audioBuffers.nosignal) {
      playTone(160, 50, 0.4, 0.25, 'sawtooth');
      return;
    }
    try {
      const { audioCtx } = assets;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const src = audioCtx.createBufferSource();
      src.buffer = assets.audioBuffers.nosignal;
      src.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.42;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start(0);
      noSignalSourceRef.current = src;
    } catch {}
  };

  const stopNoSignalSound = () => {
    if (noSignalSourceRef.current) {
      try { noSignalSourceRef.current.stop(); } catch {}
      noSignalSourceRef.current = null;
    }
  };

  useEffect(() => {
    inputRef.current.fire = isFiring;
  }, [isFiring]);

  // Способность 1 (Треугольник)
  const handleTriggerAbility1 = () => {
    if (isPausedRef.current || playerStunned || ability1CooldownRef.current > 0 || isDeadRef.current || showVictoryCutscene) return;
    if (selectedShipId === 'xwing') {
      if (isBrotherHelpActiveRef.current) return;
      isBrotherHelpActiveRef.current = true;
      triggerBrotherHelpRef.current = true;
    } else if (selectedShipId === 'ywing') {
      ability1CooldownRef.current = 125.0;
      setAbility1Cooldown(125);
      triggerRepairRef.current = true;
    } else if (selectedShipId === 'slave1') {
      if (isSlaveRocketsActiveRef.current) return;
      isSlaveRocketsActiveRef.current = true;
      triggerSlaveRocketsRef.current = true;
    }
  };

  // Способность 2 (Круг)
  const handleTriggerAbility2 = () => {
    if (isPausedRef.current || playerStunned || ability2CooldownRef.current > 0 || isDeadRef.current || showVictoryCutscene) return;
    if (selectedShipId === 'xwing') {
      if (isBombActiveRef.current) return;
      isBombActiveRef.current = true;
      triggerBombRef.current = true;
    } else if (selectedShipId === 'ywing') {
      if (isRageActiveRef.current) return;
      triggerRageRef.current = true;
    } else if (selectedShipId === 'slave1') {
      if (isSlaveShieldActiveRef.current) return;
      triggerSlaveShieldRef.current = true;
    }
  };

  // Способность 3 (Квадрат, для Раба-1)
  const handleTriggerAbility3 = () => {
    if (isPausedRef.current || playerStunned || ability3CooldownRef.current > 0 || isDeadRef.current || showVictoryCutscene) return;
    if (selectedShipId === 'slave1') {
      if (isIonChargeActiveRef.current) return;
      isIonChargeActiveRef.current = true;
      triggerSlaveIonRef.current = true;
    }
  };

  const handleVictoryCutsceneDone = useCallback(() => {
    setShowVictoryCutscene(false);
    setCurtainVisible(true);
    isPausedRef.current = true;
    if (xwingGainRef.current) xwingGainRef.current.gain.value = 0;
    if (tieEngineGainRef.current) tieEngineGainRef.current.gain.value = 0;
    stopNoSignalSound();
    setTimeout(() => {
      setEndGameModal('victory');
    }, 450);
  }, []);

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const cameraFillLight = new THREE.DirectionalLight(0xffffff, 1.3);
    cameraFillLight.position.set(0, 10, 30);
    scene.add(cameraFillLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(40, 100, 50);
    scene.add(sunLight);

    const applyRetroShipMaterial = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) {
            m.roughness = 1.0;
            m.metalness = 0.0;
            if (m.envMapIntensity !== undefined) m.envMapIntensity = 0.0;
            m.needsUpdate = true;
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

    const shipHolder = new THREE.Group();
    shipHolder.position.copy(shipPos);
    scene.add(shipHolder);

    // === КУПОЛ ЭНЕРГЕТИЧЕСКОГО ЩИТА ВОКРУГ КОРАБЛЯ (из ShipShield.html) ===
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);
    const shieldRadius = selectedShipId === 'slave1' ? 2.8 : 2.3;
    const shieldSphereGeo = new THREE.SphereGeometry(shieldRadius, 64, 48);
    const shieldOrigPos = new Float32Array(shieldSphereGeo.attributes.position.array);

    const shieldMeshMat = new THREE.MeshStandardMaterial({
      color: 0x44ccff,
      emissive: 0x0088ff,
      emissiveIntensity: 0.6,
      roughness: 0.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const playerShieldMesh = new THREE.Mesh(shieldSphereGeo, shieldMeshMat);
    shieldGroup.add(playerShieldMesh);

    let shieldState = 0; // 0: выкл, 1: появление, 2: затухание
    let shieldAnimTimer = 0;

    const triggerShipShieldVisual = () => {
      shieldState = 1;
      shieldAnimTimer = 0;
    };

    const gltfLoader = new GLTFLoader();

    const applyCalculatedScaleAndRot = (targetObj: THREE.Group) => {
      applyRetroShipMaterial(targetObj);
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
      applyRetroShipMaterial(xObj);
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
          applyRetroShipMaterial(fb);
          fb.scale.setScalar(0.48);
          shipHolder.add(fb);
        }
      );
    } else {
      const fb = models.xwing.clone();
      applyRetroShipMaterial(fb);
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

    const shieldRippleGeo = new THREE.RingGeometry(0.4, 2.1, 24);
    const shieldRippleMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });

    // Текстуры для эффектов
    const sharedGlowTexture = createExplosionGlowTexture();
    const sharedRingTexture = createExplosionRingTexture();
    const sharedPinkGlowTexture = createPinkGlowTexture();
    const sharedPinkRingTexture = createPinkRingTexture();
    const sharedCyanGlowTexture = createCyanGlowTexture();
    const sharedCyanRingTexture = createCyanRingTexture();
    const sharedRedGlowTexture = createRedGlowTexture();
    const sharedRedRingTexture = createRedRingTexture();

    const sharedPlusTexture = createPlusSignTexture();
    const sharedExclamationTexture = createExclamationTexture();
    const sharedShieldIconTexture = createShieldIconTexture();
    const ringPlaneGeo = new THREE.PlaneGeometry(1, 1);

    const lasers: Laser[] = [];
    const protonBombs: ProtonBomb[] = [];
    const slaveRockets: SlaveRocket[] = [];
    const slaveIonCharges: SlaveIonCharge[] = [];
    const rocketTrailParticles: RocketTrailParticle[] = [];
    const healEffectParticles: HealEffectParticle[] = [];
    const shieldBuffParticles: ShieldBuffParticle[] = [];
    let rageIndicator: RageEffectIndicator | null = null;

    const wingmanFlyers: WingmanFlyer[] = [];
    const enemies: Enemy[] = [];
    const shieldImpacts: ShieldImpactEffect[] = [];
    const datapads: DatapadItem[] = [];
    const activeExplosions: RetroExplosionInstance[] = [];

    const zoneAttack: BossZoneAttack = { active: false, timer: 0, duration: 1.6, xMin: -4, xMax: 4, fired: false };
    const tractorBeam: BossTractorBeam = { active: false, timer: 0, duration: 1.8, xMin: -6, xMax: 6, fired: false };

    const spawnShieldImpact = (worldPos: THREE.Vector3) => {
      triggerShipShieldVisual();
      const sMesh = new THREE.Mesh(shieldRippleGeo, shieldRippleMat.clone());
      sMesh.position.copy(worldPos);
      sMesh.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, Math.random() * Math.PI);
      sMesh.scale.setScalar(0.5);
      scene.add(sMesh);
      shieldImpacts.push({ mesh: sMesh, life: 0.24, maxLife: 0.24 });
    };

    const spawnHealPluses = (count = 10) => {
      for (let i = 0; i < count; i++) {
        const mat = new THREE.SpriteMaterial({
          map: sharedPlusTexture,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        const scale = 0.5 + Math.random() * 0.35;
        sprite.scale.set(scale, scale, 1);

        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 3.4,
          (Math.random() - 0.5) * 1.8,
          (Math.random() - 0.5) * 2.5
        );
        const startPos = shipPos.clone().add(offset);
        sprite.position.copy(startPos);
        scene.add(sprite);

        healEffectParticles.push({
          sprite,
          pos: startPos,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.5 + Math.random() * 2.0, (Math.random() - 0.5) * 1.5),
          life: 0.7 + Math.random() * 0.35,
          maxLife: 0.7 + Math.random() * 0.35
        });
      }
    };

    const spawnShieldBuffIcons = (count = 12) => {
      for (let i = 0; i < count; i++) {
        const mat = new THREE.SpriteMaterial({
          map: sharedShieldIconTexture,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        const scale = 0.55 + Math.random() * 0.3;
        sprite.scale.set(scale, scale, 1);

        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 3.6,
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.8
        );
        const startPos = shipPos.clone().add(offset);
        sprite.position.copy(startPos);
        scene.add(sprite);

        shieldBuffParticles.push({
          sprite,
          pos: startPos,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.8, 2.0 + Math.random() * 2.2, (Math.random() - 0.5) * 1.8),
          life: 0.8 + Math.random() * 0.3,
          maxLife: 0.8 + Math.random() * 0.3
        });
      }
    };

    const triggerRageVisual = () => {
      if (rageIndicator) {
        scene.remove(rageIndicator.sprite);
        (rageIndicator.sprite.material as THREE.Material).dispose();
      }
      const mat = new THREE.SpriteMaterial({
        map: sharedExclamationTexture,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.4, 1.4, 1);
      sprite.position.set(shipPos.x, shipPos.y + 1.8, shipPos.z);
      scene.add(sprite);

      rageIndicator = {
        sprite,
        life: 0.9,
        maxLife: 0.9
      };
    };

    // Взрывы: обычный, голубой ионный (воронка в 2 раза шире в XZ) и розовый протонный
    const spawnRetroExplosion = (pos: THREE.Vector3, scale = 1.0, withLight = true, mode: 'normal' | 'cyan' | 'pink' = 'normal') => {
      const expGroup = new THREE.Group();
      expGroup.position.copy(pos);
      scene.add(expGroup);

      let glowTex = sharedGlowTexture;
      let ringTex = sharedRingTexture;
      let outerColor = 0xff3300;
      let coreColor = 0xffaa00;

      if (mode === 'cyan') {
        glowTex = sharedCyanGlowTexture;
        ringTex = sharedCyanRingTexture;
        outerColor = 0x00e5ff;
        coreColor = 0x80f0ff;
      } else if (mode === 'pink') {
        glowTex = sharedPinkGlowTexture;
        ringTex = sharedPinkRingTexture;
        outerColor = 0xff0095;
        coreColor = 0xff40c8;
      }

      const outerMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: outerColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerCore = new THREE.Sprite(outerMat);
      outerCore.scale.set(1.4 * scale, 1.4 * scale, 1);
      expGroup.add(outerCore);

      const coreMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: coreColor,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const core = new THREE.Sprite(coreMat);
      core.scale.set(0.8 * scale, 0.8 * scale, 1);
      expGroup.add(core);

      const innerMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const innerCore = new THREE.Sprite(innerMat);
      innerCore.scale.set(0.4 * scale, 0.4 * scale, 1);
      expGroup.add(innerCore);

      // Воронка: у ионного заряда Раба-1 она в 2 раза шире и лежит горизонтально
      const ringMaxScale = mode === 'cyan' ? 52.0 * scale : 24.0 * scale;

      const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringPlaneGeo, ringMat);
      if (mode === 'cyan') {
        ringMesh.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2, Math.random() * Math.PI * 2);
      } else {
        ringMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      }
      ringMesh.scale.set(0.8 * scale, 0.8 * scale, 1);
      expGroup.add(ringMesh);

      const smoke: ExplosionSmokeParticle[] = [];
      const particleCount = withLight ? 24 : 14;
      for (let i = 0; i < particleCount; i++) {
        const sMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: mode === 'cyan' ? 0x00b4d8 : mode === 'pink' ? 0xff40c8 : 0xff5500,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(sMat);
        const pScale = (1.2 + Math.random() * 1.0) * scale;
        sprite.scale.set(pScale, pScale, 1);
        sprite.position.set((Math.random() - 0.5) * 0.4 * scale, (Math.random() - 0.5) * 0.4 * scale, (Math.random() - 0.5) * 0.4 * scale);
        expGroup.add(sprite);

        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
        smoke.push({
          sprite,
          velocity: dir.multiplyScalar((6 + Math.random() * 10) * scale),
          life: 1.4,
          age: 0,
          initialScale: pScale
        });
      }

      let expLight: THREE.PointLight | undefined;
      if (withLight) {
        const lightCol = mode === 'cyan' ? 0x00e5ff : mode === 'pink' ? 0xff0095 : 0xff6622;
        expLight = new THREE.PointLight(lightCol, 6.0 * scale, 65 * scale);
        expLight.position.copy(pos);
        scene.add(expLight);
      }

      activeExplosions.push({
        group: expGroup,
        smoke,
        shockwaveMesh: ringMesh,
        shockwaveAge: 0,
        shockwaveLife: mode === 'cyan' ? 1.1 : 0.85,
        shockwaveMaxScale: ringMaxScale,
        outerCore,
        core,
        innerCore,
        light: expLight,
        age: 0,
        duration: mode === 'cyan' ? 1.6 : 1.4,
        isCyan: mode === 'cyan'
      });

      playBuffer(audioBuffers.explode, 0.42, true);
    };

    // Запуск протонной бомбы X-Wing (из XWingProtonRocket.html)
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

      // Создаём шейдерную деформирующуюся модель из референса
      const pGroup = new THREE.Group();
      pGroup.position.copy(origin);
      pGroup.scale.setScalar(0.38);

      const coreGeo = new THREE.SphereGeometry(1.22, 64, 48);
      const coreMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff00b3) } },
        vertexShader: `
          uniform float uTime;
          varying float vWave;
          void main(){
            vec3 p = position;
            vec3 n = normalize(normal);
            float a = sin(p.x*14.0 + uTime*7.2);
            float b = sin(p.y*16.0 - uTime*6.5);
            float c = sin(p.z*15.0 + uTime*8.1);
            float d = sin((p.x + p.y + p.z)*12.0 - uTime*9.0);
            float e = cos(p.x*22.0 - p.y*18.0 + uTime*11.0);
            float wave = (a * b * c) * 0.08 + (d + e) * 0.035;
            p += n * wave;
            p *= 1.0 + sin(uTime*6.5)*0.018;
            vWave = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vWave;
          void main(){
            float light = 0.82 + vWave*3.0;
            vec3 col = uColor * light;
            col += vec3(0.9,0.2,0.7) * max(vWave,0.0)*2.5;
            gl_FragColor = vec4(col,0.98);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
      });
      pGroup.add(new THREE.Mesh(coreGeo, coreMat));

      const waveGeo = new THREE.SphereGeometry(1.34, 48, 36);
      const waveMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          uniform float uTime;
          void main(){
            vec3 p=position;
            vec3 n=normalize(normal);
            float w = sin(p.x*12.0+uTime*8.0) * cos(p.y*14.0-uTime*7.0) * 0.12 + sin(p.z*18.0+uTime*10.0)*0.04;
            p+=n*w;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
          }
        `,
        fragmentShader: `void main(){gl_FragColor=vec4(1.0,0.1,0.7,0.14);}`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
      });
      const waveMesh = new THREE.Mesh(waveGeo, waveMat);
      pGroup.add(waveMesh);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sharedPinkGlowTexture, color: 0xff0095, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.scale.set(4.8, 4.8, 1);
      pGroup.add(halo);

      scene.add(pGroup);

      const initDir = new THREE.Vector3().subVectors(chosenTargetPos, origin).normalize();

      // Звук выстрела proton3 воспроизводится СРАЗУ при запуске с динамической громкостью
      let pSrc: AudioBufferSourceNode | null = null;
      let pGain: GainNode | null = null;
      const pBuf = audioBuffers.proton3 || audioBuffers.proton;
      if (pBuf && !isPausedRef.current) {
        try {
          pSrc = audioCtx.createBufferSource();
          pSrc.buffer = pBuf;
          pSrc.loop = false;
          pGain = audioCtx.createGain();
          pGain.gain.value = 0.65;
          pSrc.connect(pGain);
          pGain.connect(audioCtx.destination);
          pSrc.start(0);
        } catch {}
      }

      protonBombs.push({
        group: pGroup,
        coreMat,
        waveMat,
        waveMesh,
        halo,
        vel: initDir.multiplyScalar(28),
        targetPos: chosenTargetPos,
        targetRef: chosenTargetRef,
        speed: 28,
        life: 5.5,
        trailTimer: 0,
        soundSource: pSrc,
        soundGain: pGain
      });
    };

    // Запуск 6 конусных красных ракет Раба-1 (из SlaveRocket.html)
    const fireSlaveRockets = () => {
      const liveEnemies = enemies.filter((e) => e.state === 'attacking' && e.pos.z < shipPos.z - 4);

      for (let rIdx = 0; rIdx < 6; rIdx++) {
        setTimeout(() => {
          if (isDisposed) return;

          let targetRef: Enemy | null = null;
          let targetPos = shipPos.clone().add(new THREE.Vector3(0, 0, -200));

          if (liveEnemies.length > 0) {
            const targetIndex = Math.floor(rIdx / 2) % liveEnemies.length;
            targetRef = liveEnemies[targetIndex];
            targetPos = targetRef.pos.clone();
          } else if (bossData && !bossData.destroyed) {
            const liveGens = bossData.generators.filter((g) => !g.destroyed);
            if (liveGens.length > 0) {
              targetPos = liveGens[rIdx % liveGens.length].localPos.clone().applyMatrix4(bossData.group.matrixWorld);
            } else {
              targetPos = bossData.pos.clone().add(new THREE.Vector3(0, 4, 30));
            }
          }

          const rGroup = new THREE.Group();
          rGroup.scale.setScalar(0.48);

          const coneGeo = new THREE.ConeGeometry(0.3, 1.2, 48, 32);
          const posAttr = coneGeo.attributes.position as THREE.BufferAttribute;
          const origPos = new Float32Array(posAttr.array);

          const coreMesh = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({
            color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide
          }));
          rGroup.add(coreMesh);

          const auraMat = new THREE.MeshBasicMaterial({
            color: 0xff1100, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
          });
          const auraMesh = new THREE.Mesh(coneGeo, auraMat);
          auraMesh.scale.set(1.18, 1.06, 1.18);
          rGroup.add(auraMesh);

          const cLight = new THREE.PointLight(0xff1111, 2.5, 6);
          rGroup.add(cLight);

          const launchSide = (rIdx % 2 === 0 ? 1 : -1);
          const start = shipPos.clone().add(new THREE.Vector3(launchSide * 1.4, -0.4, -0.5));
          rGroup.position.copy(start);
          scene.add(rGroup);

          const curveAxis = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0).normalize();
          const initialVel = new THREE.Vector3(launchSide * 18, (Math.random() - 0.5) * 12, -45);

          slaveRockets.push({
            group: rGroup,
            posAttr,
            origPos,
            coreMesh,
            auraMesh,
            light: cLight,
            pos: start,
            vel: initialVel,
            targetRef,
            targetPos,
            curveAxis,
            speed: 55,
            life: 4.5,
            curveTimer: 0.65,
            trailTimer: 0
          });

          playBuffer(audioBuffers.slave12, 0.48);
        }, rIdx * 95);
      }
    };

    // Выпуск Ионного заряда Раба-1 (из SlaveProtonBomb.html)
    const launchSlaveIonCharge = () => {
      const iGroup = new THREE.Group();
      const start = shipPos.clone().add(new THREE.Vector3(0, -0.4, -2.0));
      iGroup.position.copy(start);
      iGroup.scale.setScalar(0.48);

      const coreGeo = new THREE.SphereGeometry(1.22, 64, 48);
      const coreMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x00c3ff) } },
        vertexShader: `
          uniform float uTime;
          varying float vWave;
          void main(){
            vec3 p = position;
            vec3 n = normalize(normal);
            float a = sin(p.y*5.0 + uTime*5.2);
            float b = sin(p.x*6.0 - uTime*4.3);
            float c = sin((p.x+p.z)*7.0 + uTime*6.1);
            float d = sin(p.y*10.0 + p.x*4.0 - uTime*8.0);
            float wave = (a + b + c)*0.045 + d*0.022;
            p += n * wave;
            p *= 1.0 + sin(uTime*6.5)*0.018;
            vWave = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vWave;
          void main(){
            float light = 0.82 + vWave*4.0;
            vec3 col = uColor * light;
            col += vec3(0.2,0.6,0.9) * max(vWave,0.0)*3.0;
            gl_FragColor = vec4(col,0.98);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
      });
      iGroup.add(new THREE.Mesh(coreGeo, coreMat));

      const waveGeo = new THREE.SphereGeometry(1.34, 48, 36);
      const waveMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          uniform float uTime;
          void main(){
            vec3 p=position;
            vec3 n=normalize(normal);
            float w=sin(p.y*4.5+uTime*4.7)*0.055+sin(p.z*6.0-uTime*5.8)*0.045+sin((p.x-p.y)*8.0+uTime*7.0)*0.025;
            p+=n*w;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
          }
        `,
        fragmentShader: `void main(){gl_FragColor=vec4(0.1,0.6,1.0,0.14);}`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
      });
      const waveMesh = new THREE.Mesh(waveGeo, waveMat);
      iGroup.add(waveMesh);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sharedCyanGlowTexture, color: 0x00b7ff, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.scale.set(4.8, 4.8, 1);
      iGroup.add(halo);

      scene.add(iGroup);

      slaveIonCharges.push({
        group: iGroup,
        coreMat,
        waveMat,
        waveMesh,
        halo,
        pos: start,
        vel: new THREE.Vector3(0, 0, -170), // Быстрый полёт за 1 сек
        life: 1.65,
        timer: 0,
        state: 'flying'
      });

      playBuffer(audioBuffers.slave1, 0.5);
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

      playBrotherHelpSound();

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
          applyRetroShipMaterial(w);
          w.scale.setScalar(0.46);
          const start = new THREE.Vector3(shipPos.x + side * 7.5, shipPos.y + 5.5, shipPos.z + 24);
          w.position.copy(start);
          w.rotation.set(-0.04, 0, side * 0.05);
          scene.add(w);

          let fSrc: AudioBufferSourceNode | null = null;
          let fGn: GainNode | null = null;

          const flybyBuf = audioBuffers.xwingFlyby || audioBuffers.xwingEngine;
          if (flybyBuf && !isPausedRef.current) {
            try {
              fSrc = audioCtx.createBufferSource();
              fSrc.buffer = flybyBuf;
              fSrc.loop = true;
              fGn = audioCtx.createGain();
              fGn.gain.value = 0.01;
              fSrc.connect(fGn);
              if (spaceMuffleFilterRef.current) {
                fGn.connect(spaceMuffleFilterRef.current);
              } else {
                fGn.connect(audioCtx.destination);
              }
              fSrc.start(0);
            } catch {}
          }

          wingmanFlyers.push({
            mesh: w,
            pos: start,
            vel: new THREE.Vector3(0, 0, -190),
            side,
            life: 2.8,
            flybyGain: fGn,
            flybySource: fSrc
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
      applyRetroShipMaterial(dModel);
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

    const createEnemyMesh = (useTie2Mesh: boolean): THREE.Group => {
      let baseMesh: THREE.Group;
      if (useTie2Mesh && models.tie2) {
        baseMesh = models.tie2.clone();
      } else {
        baseMesh = models.tie.clone();
      }
      applyRetroShipMaterial(baseMesh);
      baseMesh.scale.setScalar(0.42);
      scene.add(baseMesh);
      return baseMesh;
    };

    const spawnSquad = (forcedSide?: number, forcedCount?: number, forceTie2?: boolean) => {
      if (enemies.length >= 10) return;

      const availableCapacity = 10 - enemies.length;
      const count = Math.min(availableCapacity, forcedCount || Math.floor(2 + Math.random() * 3));
      const spawnZ = -250 - Math.random() * 25;

      for (let idx = 0; idx < count; idx++) {
        const side = forcedSide !== undefined ? (idx % 2 === 0 ? forcedSide : -forcedSide) : (idx % 2 === 0 ? 1 : -1);
        const isTie2 = forceTie2 !== undefined ? forceTie2 : (stageRef.current >= 2 && Math.random() < 0.35);
        const mesh = createEnemyMesh(isTie2);

        const xOffset = (Math.floor(idx / 2) * 5.5 + Math.random() * 2.5);
        const startX = side * (55 + xOffset);
        const startY = defaultShipPos.y + (Math.random() - 0.5) * 8 + (idx % 2 === 0 ? 1.5 : -1.5);
        const startZ = spawnZ - (idx * 6.5);

        const hp = isTie2 ? 6 : 4;
        const shootCd = 0.8 + idx * 0.25 + Math.random() * 0.4;

        enemies.push({
          mesh,
          state: 'attacking',
          pos: new THREE.Vector3(startX, startY, startZ),
          targetX: side * (12 + Math.random() * 8),
          targetY: startY * 0.75,
          speed: 46 + stageRef.current * 3 + Math.random() * 5,
          shootCooldown: shootCd,
          side,
          loopProgress: 0,
          seed: Math.random() * 10 + idx,
          hp,
          isElite: isTie2,
          isRaid: false,
          squadRole: idx === 0 ? 'leader' : 'left_wing'
        });
      }
    };

    let bossData: BossState | null = null;
    let bossSpawned = false;
    let bossCutsceneTimer = 0;
    let bossCutsceneCamPos = new THREE.Vector3();
    let bossHullHitCount = 0;
    let nextExplosionThreshold = 8;
    let isBossExecutingSpecial = false;
    let raidTotalEnemies = 10;
    let raidSpawnFinished = false;

    const initBoss = () => {
      const grp = models.destroyer.clone();
      applyRetroShipMaterial(grp);
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
        zoneCooldown: 11.5,
        tractorCooldown: 15.0,
        destroyed: false,
        phase2Active: false,
        raidActive: false,
        raidCompleted: false
      };
    };

    let stageIdx = 0;
    const stageRef = { current: 0 };
    let stageTimer = 0;
    const STAGE_DURATION = 141;

    let squadSpawnTimer = 0;
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
      stopNoSignalSound();

      spawnRetroExplosion(shipPos, 2.5, true, 'normal');
      shipHolder.visible = false;
      crosshairTex.visible = false;

      const earned = Math.min(2200, Math.floor(currentScore * 0.025 + currentKills * 12 + currentStagesDone * 180));
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
      stopNoSignalSound();

      currentScore += 5000;
      setScore(currentScore);

      const baseEarned = Math.floor(currentScore * 0.045 + currentKills * 16 + currentStagesDone * 240 + 800);
      const earned = THREE.MathUtils.clamp(baseEarned, 3150, 4450);
      setCreditsEarned(earned);
      if (onAddCreditsRef.current) {
        onAddCreditsRef.current(earned);
      }

      spawnRetroExplosion(bossData!.pos, 3.5, true, 'normal');

      if (bossSoundtrackSourceRef.current) {
        try { bossSoundtrackSourceRef.current.stop(); } catch {}
        bossSoundtrackSourceRef.current = null;
      }

      setShowVictoryCutscene(true);
    };

    const applyDamageToPlayer = (dmg: number) => {
      if (godModeRef.current || isDeadRef.current || inBiomeTransitionRef.current || bossCutsceneActiveRef.current || showVictoryCutsceneRef.current) {
        if (godModeRef.current) spawnShieldImpact(shipPos);
        return;
      }

      if (isRageActiveRef.current) {
        dmg = Math.max(1, Math.floor(dmg * 0.5));
      } else if (isSlaveShieldActiveRef.current) {
        dmg = Math.max(1, Math.floor(dmg * 0.4));
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

      if (forcePlayer) {
        endL.copy(shipPos);
        playThunderSound(0, true);
        if (!isSlaveShieldActiveRef.current) {
          playerStunDuration = 3.0;
          setPlayerStunned(true);
          startNoSignalSound();
        }
        shakeIntensity = 1.4;
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
            playThunderSound(dist, false);
          }
        } else if (roll < 0.30 && !playerHitByLightningOnce) {
          playerHitByLightningOnce = true;
          endL.copy(shipPos);
          playThunderSound(0, true);
          if (!isSlaveShieldActiveRef.current) {
            playerStunDuration = 3.0;
            setPlayerStunned(true);
            startNoSignalSound();
          }
          shakeIntensity = 1.4;
          applyDamageToPlayer(8);
        } else {
          playThunderSound(dist, false);
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
      const st = timestamp * 0.001;

      // Обновление физической сетки купола щита вокруг корабля
      shieldGroup.position.copy(shipPos);
      if (shieldState === 1) {
        shieldAnimTimer = Math.min(1, shieldAnimTimer + dt * 2.4);
        shieldMeshMat.opacity = Math.min(0.22, shieldAnimTimer * 0.22);
        if (shieldAnimTimer >= 1) shieldState = 2;
      } else if (shieldState === 2) {
        shieldAnimTimer += dt * 2.8;
        shieldMeshMat.opacity = Math.max(0, 0.22 * (1 - (shieldAnimTimer - 1)));
        if (shieldAnimTimer >= 2) shieldState = 0;
      }

      if (shieldMeshMat.opacity > 0.005) {
        shieldGroup.rotation.y = st * 0.15;
        shieldGroup.rotation.x = Math.sin(st * 0.5) * 0.05;
        const posAttr = shieldSphereGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          const ox = shieldOrigPos[i * 3], oy = shieldOrigPos[i * 3 + 1], oz = shieldOrigPos[i * 3 + 2];
          const length = Math.hypot(ox, oy, oz);
          const wave = (Math.sin(ox * 3.0 + st * 4.0) * Math.cos(oz * 3.0 + st * 3.5) + Math.sin(oy * 4.0 + st * 5.0) * 0.5) * 0.055;
          const f = (length + wave) / length;
          posAttr.setXYZ(i, ox * f, oy * f, oz * f);
        }
        posAttr.needsUpdate = true;
      }

      // Окно комбо
      if (comboTimerRef.current > 0) {
        comboTimerRef.current -= dt;
        if (comboTimerRef.current <= 0) {
          comboStreakRef.current = 0;
          setComboStreak(0);
        }
      }

      // Кулдауны способностей (начинают отсчёт строго после завершения)
      if (ability1CooldownRef.current > 0 && !isBrotherHelpActiveRef.current && !isSlaveRocketsActiveRef.current) {
        ability1CooldownRef.current = Math.max(0, ability1CooldownRef.current - dt);
        setAbility1Cooldown(Math.ceil(ability1CooldownRef.current));
      }
      if (ability2CooldownRef.current > 0 && !isRageActiveRef.current && !isSlaveShieldActiveRef.current && !isBombActiveRef.current) {
        ability2CooldownRef.current = Math.max(0, ability2CooldownRef.current - dt);
        setAbility2Cooldown(Math.ceil(ability2CooldownRef.current));
      }
      if (ability3CooldownRef.current > 0 && !isIonChargeActiveRef.current) {
        ability3CooldownRef.current = Math.max(0, ability3CooldownRef.current - dt);
        setAbility3Cooldown(Math.ceil(ability3CooldownRef.current));
      }

      // Состояние «Буйства» Y-Wing (8 сек)
      if (isRageActiveRef.current) {
        rageTimerRef.current -= dt;
        if (rageTimerRef.current <= 0) {
          isRageActiveRef.current = false;
          setIsRageActive(false);
          ability2CooldownRef.current = 30.0;
          setAbility2Cooldown(30);
        }
      }

      // Состояние «Сопротивления» Раба-1 (8 сек)
      if (isSlaveShieldActiveRef.current) {
        slaveShieldTimerRef.current -= dt;
        if (slaveShieldTimerRef.current <= 0) {
          isSlaveShieldActiveRef.current = false;
          setIsResistanceActive(false);
          ability2CooldownRef.current = 40.0;
          setAbility2Cooldown(40);
        }
      }

      // Активация «Починки корпуса» Y-Wing
      if (triggerRepairRef.current) {
        triggerRepairRef.current = false;
        const healAmt = Math.max(1, Math.round(currentHp * 0.8));
        currentHp = Math.min(100, currentHp + healAmt);
        setHp(currentHp);
        setHealBonus(healAmt);
        setTimeout(() => setHealBonus(0), 1000);

        shipHolder.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && m.emissive) {
              m.emissive.setHex(0xff1122);
              setTimeout(() => {
                if (m && m.emissive) m.emissive.setHex(0x000000);
              }, 240);
            }
          }
        });
        spawnHealPluses(14);
        playRandomHealSound();
      }

      // Активация «Буйства» Y-Wing
      if (triggerRageRef.current) {
        triggerRageRef.current = false;
        isRageActiveRef.current = true;
        setIsRageActive(true);
        rageTimerRef.current = 8.0;

        shipHolder.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && m.emissive) {
              m.emissive.setHex(0xffbb00);
              setTimeout(() => {
                if (m && m.emissive) m.emissive.setHex(0x000000);
              }, 240);
            }
          }
        });
        triggerRageVisual();
        playTone(320, 580, 0.35, 0.35, 'sawtooth');
      }

      // Активация ракет Раба-1
      if (triggerSlaveRocketsRef.current) {
        triggerSlaveRocketsRef.current = false;
        fireSlaveRockets();
      }

      // Активация «Перенаправления сигнала» Раба-1
      if (triggerSlaveShieldRef.current) {
        triggerSlaveShieldRef.current = false;
        isSlaveShieldActiveRef.current = true;
        setIsResistanceActive(true);
        slaveShieldTimerRef.current = 8.0;
        triggerShipShieldVisual();

        shipHolder.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && m.emissive) {
              m.emissive.setHex(0x00b4d8);
              setTimeout(() => {
                if (m && m.emissive) m.emissive.setHex(0x000000);
              }, 260);
            }
          }
        });
        spawnShieldBuffIcons(14);
        playBuffer(audioBuffers.slave1, 0.5);
      }

      // Активация «Ионного заряда» Раба-1
      if (triggerSlaveIonRef.current) {
        triggerSlaveIonRef.current = false;
        launchSlaveIonCharge();
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
        let targetColor = 0x0a1018;
        let titleText = 'ТУМАННОСТЬ';
        if (forcedType === 'ionic_vapors') {
          targetColor = 0x1f0724;
          titleText = 'ИОННЫЕ ИСПАРЕНИЯ';
        }
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
      const hasLightningBiome = !bossData && !bossCutsceneActiveRef.current && (currentStep.type === 'nebula_storm');

      if (hasLightningBiome && !inBiomeTransitionRef.current && !showVictoryCutsceneRef.current) {
        lightningTimer += dt;
        if (lightningTimer >= lightningInterval) {
          lightningTimer = 0;
          lightningInterval = 12 + Math.random() * 3;
          triggerLightning();
        }
      }

      // Окончание стана
      if (playerStunDuration > 0) {
        playerStunDuration -= dt;
        shipPitch += dt * 1.2;
        shipBank += dt * 1.5;
        shipHolder.rotation.set(shipPitch, 0, shipBank);
        if (playerStunDuration <= 0) {
          setPlayerStunned(false);
          stopNoSignalSound();
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
        if (closestTieDistance < 130 && !showVictoryCutsceneRef.current) {
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
            if (step.type === 'planet' && step.planet) {
              spawnPlanet(step.planet);
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

      const input = (isDeadRef.current || inBiomeTransitionRef.current || playerStunDuration > 0 || showVictoryCutsceneRef.current)
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

      // Приоритет прицела
      let autoTargetPos: THREE.Vector3 | null = null;
      let bestScore = 9999;

      if (playerStunDuration <= 0 && !isDeadRef.current && !showVictoryCutsceneRef.current) {
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
                if (curScore < bestScore && (!autoTargetPos || bestScore > 170)) {
                  bestScore = curScore;
                  autoTargetPos = worldGPos;
                }
              }
            }
          } else {
            const hullTarget = bossData.pos.clone().add(new THREE.Vector3(0, 4, 30));
            const d = hullTarget.distanceTo(shipPos);
            if (d < bestScore && (!autoTargetPos || bestScore > 170)) {
              bestScore = d;
              autoTargetPos = hullTarget;
            }
          }
        }
      }

      const shipForward = new THREE.Vector3(0, 0, -1).applyEuler(shipHolder.rotation).normalize();
      const defaultAimDistance = 140;
      let bulletAimTarget = shipPos.clone().addScaledVector(shipForward, defaultAimDistance);

      if (playerStunDuration > 0 || isDeadRef.current || showVictoryCutsceneRef.current) {
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

        const proj = crosshairTex.position.clone().project(camera);
        setCrosshairScreenPos({
          x: (proj.x * 0.5 + 0.5) * window.innerWidth,
          y: (-proj.y * 0.5 + 0.5) * window.innerHeight
        });
      }

      if (triggerBombRef.current) {
        triggerBombRef.current = false;
        spawnProtonBomb(shipPos.clone().add(new THREE.Vector3(0, -0.3, -0.6)));
      }

      if (triggerBrotherHelpRef.current) {
        triggerBrotherHelpRef.current = false;
        triggerBrotherHelpAttack();
      }

      // Обновление ведомых
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

        if (wf.flybyGain) {
          const distToCam = wf.pos.distanceTo(camera.position);
          const dynamicVol = THREE.MathUtils.clamp(Math.pow(1 - Math.min(1, distToCam / 85), 1.6) * 0.55, 0.0, 0.55);
          wf.flybyGain.gain.value = dynamicVol;
        }

        if (wf.life <= 0) {
          if (wf.flybySource) {
            try { wf.flybySource.stop(); } catch {}
          }
          scene.remove(wf.mesh);
          wingmanFlyers.splice(wIdx, 1);

          if (wingmanFlyers.length === 0) {
            isBrotherHelpActiveRef.current = false;
            ability1CooldownRef.current = 25.0;
            setAbility1Cooldown(25);
          }
        }
      }

      // === ПРОТОННЫЕ БОМБЫ X-WING (из XWingProtonRocket.html) ===
      for (let bIdx = protonBombs.length - 1; bIdx >= 0; bIdx--) {
        const bomb = protonBombs[bIdx];
        bomb.life -= dt;

        if (bomb.soundGain) {
          const distToCam = bomb.group.position.distanceTo(camera.position);
          const dynamicVol = THREE.MathUtils.clamp((1 - distToCam / 240) * 0.65, 0.0, 0.65);
          bomb.soundGain.gain.value = dynamicVol;
        }

        // Анимация шейдера волн протонной бомбы
        bomb.coreMat.uniforms.uTime.value = st;
        bomb.waveMat.uniforms.uTime.value = st;
        bomb.waveMesh.rotation.x = Math.sin(st * 1.4) * 0.08;
        bomb.waveMesh.rotation.y = Math.cos(st * 1.8) * 0.10;
        bomb.halo.material.opacity = 0.52 + Math.sin(st * 9.0) * 0.12;

        if (bomb.targetRef && bomb.targetRef.hp > 0 && bomb.targetRef.state === 'attacking') {
          bomb.targetPos.copy(bomb.targetRef.pos);
        }

        const toTarget = new THREE.Vector3().subVectors(bomb.targetPos, bomb.group.position);
        const distToTarget = toTarget.length();

        bomb.speed = THREE.MathUtils.lerp(bomb.speed, 380, dt * 3.6);
        const trackDamp = THREE.MathUtils.clamp(dt * (15.0 + (1.0 / Math.max(0.2, distToTarget)) * 50.0), 0, 1);
        const desiredDir = toTarget.normalize();
        bomb.vel.lerp(desiredDir.multiplyScalar(bomb.speed), trackDamp);
        bomb.group.position.addScaledVector(bomb.vel, dt);

        let bombHit = false;

        if (bomb.targetRef && bomb.targetRef.hp > 0) {
          if (bomb.group.position.distanceTo(bomb.targetRef.pos) < 4.8) {
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
            spawnRetroExplosion(bomb.group.position, 2.0, true, 'pink');
          }
        }

        if (!bombHit) {
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (e.state === 'attacking' && bomb.group.position.distanceTo(e.pos) < 4.5) {
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
              spawnRetroExplosion(bomb.group.position, 2.0, true, 'pink');
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
                if (bomb.group.position.distanceTo(worldGPos) < 14.0) {
                  bombHit = true;
                  gen.hp = Math.max(0, gen.hp - 8);
                  currentDamage += 160;
                  setDamageDealt(currentDamage);
                  currentScore += 180;
                  setScore(currentScore);
                  spawnRetroExplosion(bomb.group.position, 2.6, true, 'pink');

                  if (gen.hp <= 0) {
                    gen.destroyed = true;
                    spawnRetroExplosion(worldGPos, 2.2, true, 'pink');
                    currentScore += 500;
                    setScore(currentScore);
                  }
                  break;
                }
              }
            }
          } else {
            const dx = Math.abs(bomb.group.position.x - bossData.pos.x);
            const dy = Math.abs(bomb.group.position.y - bossData.pos.y);
            const dz = Math.abs(bomb.group.position.z - bossData.pos.z);
            if (dx < 34 && dy < 18 && dz < 55) {
              bombHit = true;
              bossData.hullHp -= 10;
              currentDamage += 180;
              setDamageDealt(currentDamage);
              currentScore += 220;
              setScore(currentScore);
              spawnRetroExplosion(bomb.group.position, 2.8, true, 'pink');

              if (bossData.hullHp <= 0) {
                triggerVictorySequence();
              }
            }
          }
        }

        if (bombHit || bomb.life <= 0 || distToTarget < 1.2) {
          if (bomb.soundSource) {
            try { bomb.soundSource.stop(); } catch {}
          }
          if (!bombHit && distToTarget < 1.8) {
            spawnRetroExplosion(bomb.group.position, 2.4, true, 'pink');
          }
          scene.remove(bomb.group);
          protonBombs.splice(bIdx, 1);

          isBombActiveRef.current = false;
          ability2CooldownRef.current = 26.0;
          setAbility2Cooldown(26);
        }
      }

      // === 6 КОНУСНЫХ РАКЕТ РАБА-1 (из SlaveRocket.html) ===
      for (let srIdx = slaveRockets.length - 1; srIdx >= 0; srIdx--) {
        const sr = slaveRockets[srIdx];
        sr.life -= dt;
        sr.curveTimer -= dt;
        sr.trailTimer += dt;

        // Волновое колебание вершин сетки конуса из референса
        const posAttr = sr.posAttr;
        for (let i = 0; i < posAttr.count; i++) {
          const ox = sr.origPos[i * 3], oy = sr.origPos[i * 3 + 1], oz = sr.origPos[i * 3 + 2];
          const wave = Math.sin(oy * 8.0 - st * 6.0) * Math.cos(Math.hypot(ox, oz) * 15.0 + st * 9.0) * 0.035;
          const ang = Math.atan2(oz, ox);
          posAttr.setXYZ(i, ox + Math.cos(ang) * wave, oy + Math.sin(st * 12.0 + oy * 5.0) * 0.015, oz + Math.sin(ang) * wave);
        }
        posAttr.needsUpdate = true;

        // Красный шлейф ракеты
        if (sr.trailTimer >= 0.03) {
          sr.trailTimer = 0;
          const rTrailMat = new THREE.SpriteMaterial({
            map: sharedRedGlowTexture, color: 0xff1111, transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false
          });
          const sprite = new THREE.Sprite(rTrailMat);
          const rScale = 0.45 + Math.random() * 0.2;
          sprite.scale.set(rScale, rScale, 1);
          sprite.position.copy(sr.pos);
          scene.add(sprite);

          rocketTrailParticles.push({
            sprite, life: 0.35, maxLife: 0.35, initialScale: rScale
          });
        }

        if (sr.targetRef && sr.targetRef.hp > 0 && sr.targetRef.state === 'attacking') {
          sr.targetPos.copy(sr.targetRef.pos);
        }

        const toTarget = new THREE.Vector3().subVectors(sr.targetPos, sr.pos);
        const dist = toTarget.length();

        if (sr.curveTimer > 0) {
          sr.vel.addScaledVector(sr.curveAxis, 32 * dt);
        } else {
          sr.speed = THREE.MathUtils.lerp(sr.speed, 260, dt * 5.0);
          const aimDir = toTarget.normalize();
          sr.vel.lerp(aimDir.multiplyScalar(sr.speed), dt * 12.0);
        }

        sr.pos.addScaledVector(sr.vel, dt);
        sr.group.position.copy(sr.pos);
        sr.group.lookAt(sr.pos.clone().add(sr.vel));

        let hit = false;
        if (sr.targetRef && sr.targetRef.hp > 0 && sr.pos.distanceTo(sr.targetRef.pos) < 3.2) {
          hit = true;
          sr.targetRef.hp -= 2;
          currentDamage += 50;
          setDamageDealt(currentDamage);
          if (sr.targetRef.hp <= 0) {
            spawnRetroExplosion(sr.targetRef.pos, 1.25, true, 'normal');
            sr.targetRef.hp = 0;
            currentKills += 1;
            setEnemiesKilled(currentKills);
            currentScore += 120;
            setScore(currentScore);
            scene.remove(sr.targetRef.mesh);
            const idxInList = enemies.indexOf(sr.targetRef);
            if (idxInList >= 0) enemies.splice(idxInList, 1);
          } else {
            spawnRetroExplosion(sr.pos, 0.7, false, 'normal');
          }
        }

        if (!hit && sr.curveTimer <= 0) {
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (e.state === 'attacking' && sr.pos.distanceTo(e.pos) < 3.0) {
              hit = true;
              e.hp -= 2;
              currentDamage += 50;
              setDamageDealt(currentDamage);
              if (e.hp <= 0) {
                spawnRetroExplosion(e.pos, 1.25, true, 'normal');
                currentKills += 1;
                setEnemiesKilled(currentKills);
                currentScore += 120;
                setScore(currentScore);
                scene.remove(e.mesh);
                enemies.splice(j, 1);
              } else {
                spawnRetroExplosion(sr.pos, 0.7, false, 'normal');
              }
              break;
            }
          }
        }

        if (hit || sr.life <= 0 || (sr.curveTimer <= 0 && dist < 1.5)) {
          spawnRetroExplosion(sr.pos, 0.85, false, 'normal');
          scene.remove(sr.group);
          slaveRockets.splice(srIdx, 1);

          if (slaveRockets.length === 0) {
            isSlaveRocketsActiveRef.current = false;
            ability1CooldownRef.current = 24.0;
            setAbility1Cooldown(24);
          }
        }
      }

      // === ИОННЫЙ ЗАРЯД РАБА-1 (из SlaveProtonBomb.html) ===
      for (let icIdx = slaveIonCharges.length - 1; icIdx >= 0; icIdx--) {
        const ic = slaveIonCharges[icIdx];
        ic.life -= dt;
        ic.timer += dt;

        // Анимация шейдеров ионного заряда
        ic.coreMat.uniforms.uTime.value = st;
        ic.waveMat.uniforms.uTime.value = st;
        ic.waveMesh.rotation.x = Math.sin(st * 1.4) * 0.08;
        ic.waveMesh.rotation.y = Math.cos(st * 1.8) * 0.10;
        ic.halo.material.opacity = 0.52 + Math.sin(st * 9.0) * 0.12;

        if (ic.timer < 1.0) {
          ic.state = 'flying';
        } else if (ic.timer < 1.5) {
          ic.state = 'slowing';
          ic.vel.multiplyScalar(0.88);
        } else if (ic.state !== 'detonated') {
          ic.state = 'detonated';
          playBuffer(assets.audioBuffers.mine, 0.85);

          // Голубой взрыв с широкой воронкой в 2 раза крупнее
          spawnRetroExplosion(ic.pos, 3.2, true, 'cyan');
          shakeIntensity = Math.max(shakeIntensity, 1.1);

          // Гарантированно уничтожает всех врагов в широком радиусе 70 единиц
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const distToCharge = e.pos.distanceTo(ic.pos);
            if (distToCharge < 70.0) {
              e.hp = 0;
              spawnRetroExplosion(e.pos, 1.35, true, 'cyan');
              currentKills += 1;
              setEnemiesKilled(currentKills);
              currentScore += 150;
              setScore(currentScore);
              scene.remove(e.mesh);
              enemies.splice(j, 1);
            }
          }

          scene.remove(ic.group);
          slaveIonCharges.splice(icIdx, 1);

          isIonChargeActiveRef.current = false;
          ability3CooldownRef.current = 45.0;
          setAbility3Cooldown(45);
          continue;
        }

        ic.pos.addScaledVector(ic.vel, dt);
        ic.group.position.copy(ic.pos);

        if (ic.life <= 0) {
          scene.remove(ic.group);
          slaveIonCharges.splice(icIdx, 1);
          isIonChargeActiveRef.current = false;
          ability3CooldownRef.current = 45.0;
          setAbility3Cooldown(45);
        }
      }

      // Частицы шлейфов
      for (let rtpIdx = rocketTrailParticles.length - 1; rtpIdx >= 0; rtpIdx--) {
        const rtp = rocketTrailParticles[rtpIdx];
        rtp.life -= dt;
        const progress = rtp.life / rtp.maxLife;
        const s = rtp.initialScale * (0.3 + progress * 0.7);
        rtp.sprite.scale.set(s, s, 1);
        (rtp.sprite.material as THREE.SpriteMaterial).opacity = progress * 0.8;

        if (rtp.life <= 0) {
          scene.remove(rtp.sprite);
          (rtp.sprite.material as THREE.Material).dispose();
          rocketTrailParticles.splice(rtpIdx, 1);
        }
      }

      // Красные плюсики лечения
      for (let hpIdx = healEffectParticles.length - 1; hpIdx >= 0; hpIdx--) {
        const hpP = healEffectParticles[hpIdx];
        hpP.life -= dt;
        hpP.pos.addScaledVector(hpP.vel, dt);
        hpP.sprite.position.copy(hpP.pos);

        const progress = Math.max(0, hpP.life / hpP.maxLife);
        (hpP.sprite.material as THREE.SpriteMaterial).opacity = progress * 0.9;

        if (hpP.life <= 0) {
          scene.remove(hpP.sprite);
          (hpP.sprite.material as THREE.Material).dispose();
          healEffectParticles.splice(hpIdx, 1);
        }
      }

      // Синие иконки щита Раба-1
      for (let sbIdx = shieldBuffParticles.length - 1; sbIdx >= 0; sbIdx--) {
        const sbP = shieldBuffParticles[sbIdx];
        sbP.life -= dt;
        sbP.pos.addScaledVector(sbP.vel, dt);
        sbP.sprite.position.copy(sbP.pos);

        const progress = Math.max(0, sbP.life / sbP.maxLife);
        (sbP.sprite.material as THREE.SpriteMaterial).opacity = progress * 0.95;

        if (sbP.life <= 0) {
          scene.remove(sbP.sprite);
          (sbP.sprite.material as THREE.Material).dispose();
          shieldBuffParticles.splice(sbIdx, 1);
        }
      }

      // Индикатор «!»
      if (rageIndicator) {
        rageIndicator.life -= dt;
        rageIndicator.sprite.position.set(shipPos.x, shipPos.y + 1.8, shipPos.z);
        const progress = Math.max(0, rageIndicator.life / rageIndicator.maxLife);
        (rageIndicator.sprite.material as THREE.SpriteMaterial).opacity = progress;
        rageIndicator.sprite.scale.setScalar(1.4 + (1 - progress) * 0.8);

        if (rageIndicator.life <= 0) {
          scene.remove(rageIndicator.sprite);
          (rageIndicator.sprite.material as THREE.Material).dispose();
          rageIndicator = null;
        }
      }

      fireCooldown -= dt;
      const calcFireCooldown = THREE.MathUtils.clamp(0.35 - (shipConf.fireRate / 60) * 0.18, 0.14, 0.32);

      if (input.fire && fireCooldown <= 0 && playerStunDuration <= 0 && !isDeadRef.current) {
        fireCooldown = calcFireCooldown;

        const isSlave = selectedShipId === 'slave1';
        const leftOffset = new THREE.Vector3(isSlave ? -0.7 : -0.46, isSlave ? -0.2 : 0, -0.3).applyQuaternion(shipHolder.quaternion);
        const rightOffset = new THREE.Vector3(isSlave ? 0.7 : 0.46, isSlave ? -0.2 : 0, -0.3).applyQuaternion(shipHolder.quaternion);

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

        if (isSlave) {
          playBuffer(audioBuffers.slave1, 0.38);
        } else {
          playBuffer(audioBuffers.xwingShot, 0.28);
        }
      }

      if (!inBiomeTransitionRef.current && !bossData && !isDeadRef.current) {
        squadSpawnTimer += dt;
        const dynamicSquadInterval = Math.max(6.5, 9.0 - stageIdx * 0.6);
        if (squadSpawnTimer > dynamicSquadInterval && enemies.length === 0) {
          squadSpawnTimer = 0;
          spawnSquad();
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
            raidSpawnFinished = false;
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

            enemies.length = 0;
            setTimeout(() => { if (!isDisposed) spawnSquad(undefined, 3, false); }, 100);
            setTimeout(() => { if (!isDisposed) spawnSquad(undefined, 2, false); }, 550);
            setTimeout(() => { if (!isDisposed) spawnSquad(undefined, 3, true); }, 1100);
            setTimeout(() => { if (!isDisposed) spawnSquad(undefined, 2, true); }, 1650);

            setTimeout(() => {
              if (!isDisposed) {
                raidSpawnFinished = true;
              }
            }, 2200);
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

          if (raidSpawnFinished && remainingEnemies === 0 && !bossData.raidCompleted) {
            bossData.raidActive = false;
            bossData.raidCompleted = true;
            setBossBarMode('hull');
            setBossBarPercent(Math.floor((bossData.hullHp / bossData.maxHullHp) * 100));

            currentScore += 2500;
            setScore(currentScore);

            bossData.zoneCooldown = 11.5;
            bossData.tractorCooldown = 15.0;
            bossData.squadCooldown = 16.0;
            bossData.bombardCooldown = 5.5;
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
        if (!bossData.phase2Active && !showVictoryCutsceneRef.current) {
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

        if (!bossData.raidActive && !bossCutsceneActiveRef.current && !inBiomeTransitionRef.current && !isDeadRef.current && !showVictoryCutsceneRef.current) {
          const isSpecialBusy = zoneAttack.active || tractorBeam.active || isBossExecutingSpecial;

          if (!isSpecialBusy) {
            bossData.zoneCooldown -= dt;
            bossData.tractorCooldown -= dt;
            bossData.squadCooldown -= dt;
            bossData.bombardCooldown -= dt;

            if (bossData.zoneCooldown <= 0) {
              bossData.zoneCooldown = 11.5 + Math.random() * 3.5;
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
              bossData.tractorCooldown = 15.0 + Math.random() * 3.5;
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
              bossData.squadCooldown = 16.0 + Math.random() * 4.0;
              isBossExecutingSpecial = true;
              const callCount = Math.floor(6 + Math.random() * 2);
              spawnSquad(undefined, callCount);
              setTimeout(() => {
                isBossExecutingSpecial = false;
              }, 1200);
            } else if (bossData.bombardCooldown <= 0) {
              bossData.bombardCooldown = 5.5;
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
                    spawnRetroExplosion(new THREE.Vector3(laneCenter, yPos, blastZ), 1.6, false, 'normal');
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
                } else if (!isSlaveShieldActiveRef.current) {
                  playerStunDuration = 3.0;
                  setPlayerStunned(true);
                  startNoSignalSound();
                  shakeIntensity = 1.0;
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

      // Обновление истребителей
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
              spawnRetroExplosion(e.pos, 1.8, true, 'normal');
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
          e.pos.x = THREE.MathUtils.lerp(e.pos.x, e.targetX, dt * 1.15);
          e.pos.y = THREE.MathUtils.lerp(e.pos.y, e.targetY, dt * 1.15);

          const moveDir = new THREE.Vector3(e.targetX - e.pos.x, e.targetY - e.pos.y, 40).normalize();
          e.mesh.position.set(e.pos.x + jitterX, e.pos.y + jitterY, e.pos.z);
          e.mesh.lookAt(e.pos.clone().add(moveDir));
          e.mesh.rotation.z = -(e.targetX - e.pos.x) * 0.05 + jitterRoll;

          const distToCam = e.pos.distanceTo(camera.position);
          if (distToCam < 18) {
            const flybyFactor = Math.pow(1 - distToCam / 18, 2);
            shakeIntensity = Math.max(shakeIntensity, flybyFactor * 0.7);
          }

          if (!isDeadRef.current && !showVictoryCutsceneRef.current) {
            e.shootCooldown -= dt;
            if (e.shootCooldown <= 0 && e.pos.z < shipPos.z - 18 && e.pos.z > -160) {
              e.shootCooldown = e.isRaid ? 0.9 : e.isElite ? 0.8 + Math.random() * 0.5 : 1.1 + Math.random() * 0.7;

              const leadTarget = shipPos.clone().add(new THREE.Vector3(shipVx * 0.32, shipVy * 0.32, 0));
              const spreadX = (Math.random() - 0.5) * (e.isElite ? 2.5 : 3.8);
              const spreadY = (Math.random() - 0.5) * (e.isElite ? 1.8 : 2.6);
              leadTarget.x += spreadX;
              leadTarget.y += spreadY;

              const baseLaserDir = new THREE.Vector3().subVectors(leadTarget, e.pos).normalize();

              for (const s of [-0.32, 0.32]) {
                const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
                lMesh.position.set(e.pos.x + s, e.pos.y - 0.05, e.pos.z + 0.8);
                lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), baseLaserDir);
                scene.add(lMesh);
                lasers.push({ mesh: lMesh, vel: baseLaserDir.clone().multiplyScalar(160), life: 2.2, isEnemy: true });
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
            e.pos.x = e.side * (60 + Math.random() * 20);
            e.targetX = (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 10);
            e.targetY = defaultShipPos.y + (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 5);
            e.shootCooldown = 1.0 + Math.random() * 0.7;
          }
        }
      }

      // Полёт лазеров
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

          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (l.mesh.position.distanceTo(e.pos) < 3.8) {
              l.life = 0;
              hitAny = true;

              let dealt = shipConf.damage >= 45 ? 2 : 1;
              if (isRageActiveRef.current) dealt *= 2;
              e.hp -= dealt;

              currentDamage += dealt * 25;
              setDamageDealt(currentDamage);
              currentScore += dealt * 30;
              setScore(currentScore);

              if (e.hp <= 0) {
                spawnRetroExplosion(e.pos, 1.25, true, 'normal');
                shakeIntensity = Math.max(shakeIntensity, 0.8);

                comboStreakRef.current += 1;
                comboTimerRef.current = 2.8;

                if (comboStreakRef.current > 11) {
                  comboStreakRef.current = 0;
                }
                setComboStreak(comboStreakRef.current);

                if (comboStreakRef.current >= 3) {
                  currentScore += comboStreakRef.current * 150;
                  setScore(currentScore);
                }

                currentKills += 1;
                setEnemiesKilled(currentKills);
                currentScore += e.isRaid ? 250 : e.isElite ? 180 : 100;
                setScore(currentScore);

                if (Math.random() < 0.075) {
                  spawnDatapad(e.pos);
                }

                scene.remove(e.mesh);
                enemies.splice(j, 1);
              }
              break;
            }
          }

          if (!hitAny && bossData && !bossData.destroyed && !bossData.raidActive && !bossCutsceneActiveRef.current && !showVictoryCutsceneRef.current) {
            bossData.group.updateMatrixWorld(true);
            const hasGenerators = bossData.generators.some((g) => !g.destroyed);

            if (hasGenerators) {
              for (const gen of bossData.generators) {
                if (!gen.destroyed) {
                  const worldGPos = gen.localPos.clone().applyMatrix4(bossData.group.matrixWorld);
                  if (l.mesh.position.distanceTo(worldGPos) < 14.0) {
                    l.life = 0;
                    hitAny = true;
                    let dealt = (shipConf.damage >= 45 ? 2 : 1);
                    if (isRageActiveRef.current) dealt *= 2;
                    gen.hp -= dealt;

                    currentDamage += dealt * 35;
                    setDamageDealt(currentDamage);
                    currentScore += dealt * 40;
                    setScore(currentScore);

                    if (gen.hp <= 0) {
                      gen.destroyed = true;
                      spawnRetroExplosion(worldGPos, 1.8, true, 'normal');
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
                let dealt = (shipConf.damage >= 45 ? 2 : 1);
                if (isRageActiveRef.current) dealt *= 2;
                bossData.hullHp -= dealt;

                currentDamage += dealt * 40;
                setDamageDealt(currentDamage);
                currentScore += dealt * 50;
                setScore(currentScore);

                bossHullHitCount++;
                if (bossHullHitCount >= nextExplosionThreshold) {
                  bossHullHitCount = 0;
                  nextExplosionThreshold = Math.floor(7 + Math.random() * 3);
                  spawnRetroExplosion(l.mesh.position, 0.8, false, 'normal');
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

      // Датапады
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
                m.emissive.setHex(0xff1122);
                setTimeout(() => {
                  if (m && m.emissive) m.emissive.setHex(0x000000);
                }, 200);
              }
            }
          });

          spawnHealPluses(8);

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
          (si.mesh.material as THREE.Material).dispose();
          shieldImpacts.splice(i, 1);
        }
      }

      // Анимация взрывов
      for (let eIdx = activeExplosions.length - 1; eIdx >= 0; eIdx--) {
        const exp = activeExplosions[eIdx];
        exp.age += dt;
        const p = THREE.MathUtils.clamp(exp.age / exp.duration, 0, 1);

        const expansion = 1 - Math.pow(1 - p, 1.8);
        const alpha = Math.max(0, 1.0 - p);

        exp.outerCore.scale.set(1.4 + expansion * 5.5, 1.4 + expansion * 5.5, 1);
        exp.core.scale.set(0.8 + expansion * 3.5, 0.8 + expansion * 3.5, 1);
        exp.innerCore.scale.set(0.4 + expansion * 1.8, 0.4 + expansion * 1.8, 1);

        (exp.outerCore.material as THREE.SpriteMaterial).opacity = alpha * 0.9;
        (exp.core.material as THREE.SpriteMaterial).opacity = Math.pow(alpha, 1.2) * 0.95;
        (exp.innerCore.material as THREE.SpriteMaterial).opacity = Math.pow(alpha, 1.5);

        if (exp.shockwaveMesh) {
          exp.shockwaveAge += dt;
          const sP = THREE.MathUtils.clamp(exp.shockwaveAge / exp.shockwaveLife, 0, 1);
          const ringExpansion = 1 - Math.pow(1 - sP, 2.0);
          const currentScale = ringExpansion * exp.shockwaveMaxScale;

          exp.shockwaveMesh.scale.set(currentScale, currentScale, 1);
          (exp.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - sP, 1.2) * 0.95;

          if (sP >= 1.0) {
            exp.group.remove(exp.shockwaveMesh);
            (exp.shockwaveMesh.material as THREE.Material).dispose();
            exp.shockwaveMesh = null;
          }
        }

        const globalFade = THREE.MathUtils.clamp(1.0 - (exp.age / exp.duration), 0, 1);
        for (let sIdx = exp.smoke.length - 1; sIdx >= 0; sIdx--) {
          const s = exp.smoke[sIdx];
          s.age += dt;
          if (s.age >= s.life || globalFade <= 0) {
            exp.group.remove(s.sprite);
            (s.sprite.material as THREE.Material).dispose();
            exp.smoke.splice(sIdx, 1);
            continue;
          }
          s.velocity.multiplyScalar(0.95);
          s.sprite.position.addScaledVector(s.velocity, dt);
          const sLife = s.age / s.life;
          const currentScale = s.initialScale + sLife * 7.5;
          s.sprite.scale.set(currentScale, currentScale, 1);
          (s.sprite.material as THREE.SpriteMaterial).opacity = 0.65 * globalFade;
        }

        if (exp.light) {
          exp.light.intensity = alpha * 6.0;
        }

        if (exp.age >= exp.duration) {
          scene.remove(exp.group);
          if (exp.light) scene.remove(exp.light);
          (exp.outerCore.material as THREE.Material).dispose();
          (exp.core.material as THREE.Material).dispose();
          (exp.innerCore.material as THREE.Material).dispose();
          activeExplosions.splice(eIdx, 1);
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
      protonBombs.forEach((b) => {
        if (b.soundSource) {
          try { b.soundSource.stop(); } catch {}
        }
        scene.remove(b.group);
      });
      slaveRockets.forEach((sr) => scene.remove(sr.group));
      slaveIonCharges.forEach((ic) => scene.remove(ic.group));
      rocketTrailParticles.forEach((rtp) => {
        scene.remove(rtp.sprite);
        (rtp.sprite.material as THREE.Material).dispose();
      });
      healEffectParticles.forEach((hpP) => {
        scene.remove(hpP.sprite);
        (hpP.sprite.material as THREE.Material).dispose();
      });
      shieldBuffParticles.forEach((sbP) => {
        scene.remove(sbP.sprite);
        (sbP.sprite.material as THREE.Material).dispose();
      });
      if (rageIndicator) {
        scene.remove(rageIndicator.sprite);
        (rageIndicator.sprite.material as THREE.Material).dispose();
      }
      wingmanFlyers.forEach((w) => {
        if (w.flybySource) {
          try { w.flybySource.stop(); } catch {}
        }
        scene.remove(w.mesh);
      });
      enemies.forEach((e) => scene.remove(e.mesh));
      planetMeshes.forEach((pl) => scene.remove(pl));
      datapads.forEach((dp) => scene.remove(dp.mesh));
      shieldImpacts.forEach((si) => {
        scene.remove(si.mesh);
        si.mesh.geometry.dispose();
        (si.mesh.material as THREE.Material).dispose();
      });
      activeExplosions.forEach((exp) => {
        scene.remove(exp.group);
        if (exp.light) scene.remove(exp.light);
      });
      scene.remove(crosshairTex);
      crosshairGeo.dispose();
      crosshairMat.dispose();
      ringPlaneGeo.dispose();
      shieldSphereGeo.dispose();
      shieldMeshMat.dispose();

      sharedGlowTexture.dispose();
      sharedRingTexture.dispose();
      sharedPinkGlowTexture.dispose();
      sharedPinkRingTexture.dispose();
      sharedCyanGlowTexture.dispose();
      sharedCyanRingTexture.dispose();
      sharedRedGlowTexture.dispose();
      sharedRedRingTexture.dispose();
      sharedPlusTexture.dispose();
      sharedExclamationTexture.dispose();
      sharedShieldIconTexture.dispose();

      stopNoSignalSound();
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
    if (inBiomeTransitionRef.current || isPaused || isConsoleOpen || bossCutsceneActiveRef.current || playerStunned || showVictoryCutscene || endGameModal !== null || isDeadRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickTouchId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickActive(true);
    handleStickMove(e);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBiomeTransitionRef.current || isPaused || isConsoleOpen || bossCutsceneActiveRef.current || playerStunned || showVictoryCutscene || endGameModal !== null || isDeadRef.current || stickTouchId.current !== e.pointerId) return;
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

  const handleFirePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!inBiomeTransition && !isPaused && !isConsoleOpen && !playerStunned && !showVictoryCutscene && endGameModal === null && !isDeadRef.current) {
      setIsFiring(true);
    }
  };

  const handleFirePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsFiring(false);
  };

  const handleFirePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsFiring(false);
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
    stopNoSignalSound();
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
    stopNoSignalSound();
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
    } else if (code === '5dbb6kaopwnqhoa') {
      forceLightningPlayerRef.current = true;
      setConsoleFeedback('УДАР МОЛНИИ ПО ИГРОКУ');
      setTimeout(() => {
        setIsConsoleOpen(false);
        setIsPaused(false);
        setConsoleInput('');
        setConsoleFeedback('');
      }, 500);
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
        ability3Cooldown={ability3Cooldown}
        hasAbility3={selectedShipId === 'slave1'}
        inBiomeTransition={inBiomeTransition}
        biomeTitle={biomeTitle}
        biomeSubtext={biomeSubtext}
        isPaused={isPaused}
        isConsoleOpen={isConsoleOpen}
        consoleInput={consoleInput}
        consoleFeedback={consoleFeedback}
        currentStage={currentStage}
        stageProgressPercent={stageProgressPercent}
        bossActive={bossActive}
        bossShieldsDown={bossShieldsDown}
        bossBarMode={bossBarMode}
        bossBarPercent={bossBarPercent}
        bossCutsceneActive={bossCutsceneActive}
        playerStunned={playerStunned}
        comboStreak={comboStreak}
        isRageActive={isRageActive}
        isResistanceActive={isResistanceActive}
        crosshairScreenPos={crosshairScreenPos}
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
        onFirePointerDown={handleFirePointerDown}
        onFirePointerUp={handleFirePointerUp}
        onFirePointerCancel={handleFirePointerCancel}
        onTriggerAbility1={handleTriggerAbility1}
        onTriggerAbility2={handleTriggerAbility2}
        onTriggerAbility3={handleTriggerAbility3}
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
