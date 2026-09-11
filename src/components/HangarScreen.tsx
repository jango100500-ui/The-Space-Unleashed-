import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';

interface HangarScreenProps {
  assets: PreloadedAssets;
  selectedShipId: string;
  credits: number;
  onSelectShip: (id: string) => void;
  onAddCredits: (amount: number) => void;
  onBack: () => void;
}

export interface ShipAbility {
  id: string;
  name: string;
  typeText: string;
  description: string;
  symbol: 'triangle' | 'circle' | 'square' | 'cross';
}

export type ShipClassType = 'basic' | 'special' | 'unique' | 'bonus';

export interface HangarShipData {
  id: string;
  name: string;
  description: string;
  modelUrl?: string;
  scale: number;
  rot: [number, number, number];
  damage: number;
  fireRate: number;
  shield: number;
  price: number;
  shipClass: ShipClassType;
  classLabel: string;
  classBadge: string;
  abilities: ShipAbility[];
}

export const HANGAR_SHIPS: HangarShipData[] = [
  {
    id: 'xwing',
    name: 'X-ВИНГ',
    description: 'Универсальный звездный истребитель T-65B Альянса повстанцев. Баланс скорости, огневой мощи и маневренности.',
    scale: 0.26,
    rot: [0, 0, 0],
    damage: 25,
    fireRate: 40,
    shield: 0,
    price: 0,
    shipClass: 'basic',
    classLabel: 'БАЗОВЫЙ',
    classBadge: 'B',
    abilities: [
      {
        id: 'brother_help',
        name: 'БРАТСКАЯ ПОМОЩЬ',
        typeText: 'БАЗОВАЯ СПОСОБНОСТЬ',
        description: 'Призывает союзный X-Винг на 7 секунд. Помогает огнем и запускает протонную бомбу перед отлетом. Перезарядка: 45 секунд',
        symbol: 'triangle'
      },
      {
        id: 'proton_torpedo',
        name: 'ПРОТОННАЯ БОМБА',
        typeText: 'ОСОБАЯ СПОСОБНОСТЬ',
        description: 'Самонаводящаяся протонная бомба. Наносит колоссальный урон и уничтожает истребители с одного удара. Перезарядка: 26 секунд',
        symbol: 'circle'
      }
    ]
  },
  {
    id: 'ywing',
    name: 'Y-ВИНГ',
    description: 'Надежный тяжелый истребитель-бомбардировщик BTL-A4. Превосходная прочность корпуса и выносливость в бою.',
    modelUrl: '/models/y-wing.glb',
    scale: 0.32,
    rot: [0, Math.PI / 2, 0],
    damage: 35,
    fireRate: 30,
    shield: 0,
    price: 2500,
    shipClass: 'special',
    classLabel: 'ОСОБЫЙ',
    classBadge: 'S',
    abilities: []
  },
  {
    id: 'slave1',
    name: 'РАБ 1',
    description: 'Грозный корабль типа «Огневержец-31». Оснащен мощным арсеналом, поворотной кабиной и тяжелой броней.',
    modelUrl: '/models/slave-1.glb',
    scale: 0.26,
    rot: [0, Math.PI, 0],
    damage: 50,
    fireRate: 50,
    shield: 100,
    price: 12000,
    shipClass: 'unique',
    classLabel: 'УНИКАЛЬНЫЙ',
    classBadge: 'U',
    abilities: []
  },
  {
    id: 'beatle',
    name: 'БИТЛ',
    description: 'Тяжелый штурмовой челнок с усиленным бронированным корпусом и спаренными орудийными системами.',
    modelUrl: '/models/Beatle.glb',
    scale: 0.26,
    rot: [0, Math.PI, 0],
    damage: 30,
    fireRate: 45,
    shield: 0,
    price: 5000,
    shipClass: 'bonus',
    classLabel: 'БОНУСНЫЙ',
    classBadge: 'B+',
    abilities: []
  }
];

const createFallbackProcedural = (id: string): THREE.Group => {
  const g = new THREE.Group();
  if (id === 'slave1') {
    const base = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    base.rotation.x = Math.PI / 2;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x8e44ad }));
    skirt.position.set(0, -0.4, 0.6);
    g.add(base, skirt);
  } else if (id === 'ywing') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 3.2), new THREE.MeshStandardMaterial({ color: 0xecf0f1 }));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0, 1.8);
    const engL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x7f8c8d }));
    engL.rotation.x = Math.PI / 2;
    engL.position.set(-1.1, 0, -0.2);
    const engR = engL.clone();
    engR.position.x = 1.1;
    g.add(body, head, engL, engR);
  } else if (id === 'beatle') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0x34495e }));
    shell.scale.set(1.4, 0.6, 1.8);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x3498db }));
    cabin.position.set(0, 0.3, -0.6);
    g.add(shell, cabin);
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x7f8c8d })));
  }
  return g;
};

export default function HangarScreen({ assets, selectedShipId, credits, onSelectShip, onAddCredits, onBack }: HangarScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [ownedShips, setOwnedShips] = useState<string[]>(['xwing']);

  const customCache = useRef<Record<string, THREE.Group>>({});
  const rotatingHolderRef = useRef<THREE.Group | null>(null);

  const playClick = () => {
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

  useEffect(() => {
    const idx = HANGAR_SHIPS.findIndex((s) => s.id === selectedShipId);
    if (idx >= 0) {
      setCurrentIndex(idx);
    } else {
      setCurrentIndex(0);
      onSelectShip(HANGAR_SHIPS[0].id);
    }
  }, [selectedShipId, onSelectShip]);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = mountRef.current ? mountRef.current.clientWidth : window.innerWidth;
    const height = mountRef.current ? mountRef.current.clientHeight : window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020409, 0.002);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(0, 1.3, 6.2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const ambient = new THREE.AmbientLight(0x8faec4, 1.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(10, 18, 12);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x00e5ff, 4.0, 15);
    rimLight.position.set(0, -1.8, 0);
    scene.add(rimLight);

    const shipHolder = new THREE.Group();
    shipHolder.position.set(0, 0.1, 0);
    scene.add(shipHolder);
    rotatingHolderRef.current = shipHolder;

    const loader = new GLTFLoader();

    const resolveShipModel = async (ship: HangarShipData): Promise<THREE.Group> => {
      if (ship.id === 'xwing') return assets.models.xwing;

      if (customCache.current[ship.id]) {
        return customCache.current[ship.id];
      }

      if (ship.modelUrl) {
        try {
          const gltf = await loader.loadAsync(ship.modelUrl);
          customCache.current[ship.id] = gltf.scene;
          return gltf.scene;
        } catch {
          const fb = createFallbackProcedural(ship.id);
          customCache.current[ship.id] = fb;
          return fb;
        }
      }

      const fb = createFallbackProcedural(ship.id);
      customCache.current[ship.id] = fb;
      return fb;
    };

    const updateDisplayVisual = async () => {
      while (shipHolder.children.length > 0) {
        shipHolder.remove(shipHolder.children[0]);
      }

      const ship = HANGAR_SHIPS[currentIndex];
      const isCurrentActive = ship.id === selectedShipId;
      const base = await resolveShipModel(ship);
      if (isDisposed) return;

      const cloned = base.clone();

      const xBox = new THREE.Box3().setFromObject(assets.models.xwing);
      const xSize = new THREE.Vector3();
      xBox.getSize(xSize);
      const xMax = Math.max(xSize.x, xSize.y, xSize.z) || 1;

      const mBox = new THREE.Box3().setFromObject(cloned);
      const mSize = new THREE.Vector3();
      mBox.getSize(mSize);
      const mMax = Math.max(mSize.x, mSize.y, mSize.z) || 1;

      const targetScaleRatio = ship.id === 'ywing' ? 0.32 : 0.26;
      const normalizedScale = (xMax / mMax) * targetScaleRatio;
      cloned.scale.setScalar(normalizedScale);
      cloned.rotation.set(ship.rot[0], ship.rot[1], ship.rot[2]);

      if (!isCurrentActive) {
        const holoMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.55
        });

        cloned.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = holoMat;
          }
        });
      }

      shipHolder.add(cloned);
    };

    updateDisplayVisual();

    let lastT = performance.now();
    const renderLoop = (time: number) => {
      if (isDisposed) return;
      const dt = Math.min((time - lastT) / 1000, 0.05);
      lastT = time;

      if (shipHolder) {
        shipHolder.rotation.y += dt * 0.75;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [currentIndex, selectedShipId, assets]);

  const currentShip = HANGAR_SHIPS[currentIndex];
  const isOwned = ownedShips.includes(currentShip.id);
  const isSelected = selectedShipId === currentShip.id;

  const handlePrev = () => {
    playClick();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : HANGAR_SHIPS.length - 1));
  };

  const handleNext = () => {
    playClick();
    setCurrentIndex((prev) => (prev < HANGAR_SHIPS.length - 1 ? prev + 1 : 0));
  };

  const handleBuy = () => {
    if (credits < currentShip.price) return;
    playClick();
    onAddCredits(-currentShip.price);
    const updated = [...ownedShips, currentShip.id];
    setOwnedShips(updated);
  };

  const handleSelect = () => {
    if (isSelected) return;
    playClick();
    onSelectShip(currentShip.id);
  };

  return (
    <div className="tfu-hangar-root">
      <style>{`
        .tfu-hangar-root {
          position: absolute;
          inset: 0;
          background: #03060c;
          background-image: 
            radial-gradient(ellipse at 50% 45%, rgba(10, 60, 110, 0.45) 0%, transparent 65%),
            radial-gradient(circle at 80% 30%, rgba(30, 20, 50, 0.4) 0%, transparent 60%);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 20;
        }
        .tfu-hangar-top {
          position: absolute;
          top: 14px;
          left: 18px;
          right: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 30;
          pointer-events: auto;
        }
        .tfu-hangar-back {
          background: linear-gradient(180deg, #3d586e 0%, #15202b 100%);
          border: 1px solid #6e8fa8;
          color: #8faec4;
          padding: 4px 20px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          height: 28px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .tfu-hangar-back:active {
          filter: brightness(1.2);
        }
        .tfu-hangar-title {
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 4px;
          color: #8faec4;
          text-transform: uppercase;
        }
        .tfu-hangar-balance-box {
          background: linear-gradient(180deg, #3d586e 0%, #15202b 100%);
          border: 1px solid #6e8fa8;
          color: #8faec4;
          padding: 4px 16px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          height: 28px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
        }
        .tfu-hangar-canvas {
          position: absolute;
          inset: 0;
          z-index: 10;
        }
        .tfu-hangar-side-window {
          position: absolute;
          top: 56%;
          transform: translateY(-50%);
          width: min(240px, 25vw);
          height: 310px;
          max-height: 48vh;
          background: #0a111a;
          border: 1px solid #6e8fa8;
          border-top: 1px solid #b2c2d4;
          border-radius: 0px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 25;
          pointer-events: auto;
          box-sizing: border-box;
        }
        .tfu-side-left {
          left: clamp(14px, 3vw, 36px);
        }
        .tfu-side-right {
          right: clamp(14px, 3vw, 36px);
        }
        .tfu-window-header {
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #ffffff;
          text-transform: uppercase;
          border-bottom: 1px solid #233446;
          padding-bottom: 5px;
          flex-shrink: 0;
        }
        .tfu-side-scroll {
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .tfu-side-scroll::-webkit-scrollbar {
          display: none;
        }
        .tfu-class-badge-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(180deg, #1a2735 0%, #0d151f 100%);
          border: 1px solid #5a738e;
          padding: 4px 7px;
        }
        .tfu-class-square {
          width: 18px;
          height: 18px;
          border: 1px solid #b2c2d4;
          color: #ffffff;
          font-family: Arial, sans-serif;
          font-size: 9px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #233446;
        }
        .tfu-class-title {
          font-family: Arial, sans-serif;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.5px;
          color: #c8d6e5;
          text-transform: uppercase;
        }
        .tfu-stats-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tfu-stat-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .tfu-stat-info {
          display: flex;
          justify-content: space-between;
          font-family: Arial, sans-serif;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .tfu-stat-name {
          color: #8faec4;
        }
        .tfu-stat-val {
          color: #ffffff;
        }
        .tfu-stat-track {
          width: 100%;
          height: 4px;
          background: #111a24;
          border: 1px solid #233446;
        }
        .tfu-stat-fill {
          height: 100%;
          background: linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%);
        }
        .tfu-abilities-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border-top: 1px solid #233446;
          padding-top: 6px;
        }
        .tfu-abilities-header {
          font-family: Arial, sans-serif;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #8faec4;
          text-transform: uppercase;
        }
        .tfu-abilities-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tfu-ability-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          background: #060b10;
          border: 1px solid #233446;
          padding: 5px;
        }
        .tfu-ability-symbol-circle {
          width: 28px;
          height: 28px;
          min-width: 28px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tfu-ability-symbol-circle svg {
          width: 14px;
          height: 14px;
        }
        .tfu-ability-content {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .tfu-ability-name {
          font-family: Arial, sans-serif;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #ffffff;
          text-transform: uppercase;
        }
        .tfu-ability-type {
          font-family: Arial, sans-serif;
          font-size: 8px;
          font-weight: bold;
          letter-spacing: 1px;
          color: #8faec4;
          text-transform: uppercase;
        }
        .tfu-ability-desc {
          font-family: Arial, sans-serif;
          font-size: 8.5px;
          line-height: 1.3;
          color: #94a3b8;
        }
        .tfu-info-desc {
          font-family: Arial, sans-serif;
          font-size: 10.5px;
          line-height: 1.45;
          color: #a4b8cc;
          flex: 1;
        }
        .tfu-hangar-action-btn {
          width: 100%;
          height: 34px;
          border-radius: 0px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          transition: transform 0.05s ease;
          flex-shrink: 0;
        }
        .tfu-hangar-action-btn:active {
          transform: scale(0.98);
        }
        .tfu-btn-buy {
          border: 2px solid #e2e8f0;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          color: #ffffff;
        }
        .tfu-btn-buy.disabled {
          background: #1e293b;
          border-color: #475569;
          color: #94a3b8;
          cursor: not-allowed;
        }
        .tfu-btn-select {
          border: 2px solid #b2c2d4;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%);
          color: #0b141e;
        }
        .tfu-btn-selected {
          border: 1px solid #3d586e;
          background: #15202b;
          color: #5a738e;
          cursor: default;
        }
        .tfu-btn-selected:active {
          transform: none;
        }
        .tfu-hangar-bottom-controls {
          position: absolute;
          bottom: 22px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 30;
          pointer-events: auto;
        }
        .tfu-nav-square {
          width: 38px;
          height: 38px;
          border-radius: 0px;
          border: 1px solid #6e8fa8;
          background: linear-gradient(180deg, #3d586e 0%, #15202b 100%);
          color: #8faec4;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .tfu-nav-square:active {
          filter: brightness(1.25);
        }
        .tfu-nav-square svg {
          width: 18px;
          height: 18px;
          fill: currentColor;
        }
        .tfu-nav-counter-box {
          width: min(240px, 40vw);
          height: 38px;
          border-radius: 0px;
          border: 2px solid #b2c2d4;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%);
          color: #0b141e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 3px;
        }
      `}</style>

      <div className="tfu-hangar-top">
        <button type="button" className="tfu-hangar-back" onClick={() => { playClick(); onBack(); }}>
          <span>« НАЗАД</span>
        </button>
        <div className="tfu-hangar-title">АНГАР ФЛОТА</div>
        <div className="tfu-hangar-balance-box">КРЕДИТЫ: {credits}</div>
      </div>

      <div ref={mountRef} className="tfu-hangar-canvas" />

      <div className="tfu-hangar-side-window tfu-side-left">
        <div className="tfu-window-header">ХАРАКТЕРИСТИКИ</div>
        <div className="tfu-side-scroll">
          <div className="tfu-class-badge-container">
            <div className="tfu-class-square">{currentShip.classBadge}</div>
            <div className="tfu-class-title">КЛАСС: {currentShip.classLabel}</div>
          </div>

          <div className="tfu-stats-list">
            <div className="tfu-stat-row">
              <div className="tfu-stat-info">
                <span className="tfu-stat-name">УРОН</span>
                <span className="tfu-stat-val">{currentShip.damage}</span>
              </div>
              <div className="tfu-stat-track">
                <div className="tfu-stat-fill" style={{ width: `${(currentShip.damage / 60) * 100}%` }} />
              </div>
            </div>
            <div className="tfu-stat-row">
              <div className="tfu-stat-info">
                <span className="tfu-stat-name">ТЕМП ОГНЯ</span>
                <span className="tfu-stat-val">{currentShip.fireRate}</span>
              </div>
              <div className="tfu-stat-track">
                <div className="tfu-stat-fill" style={{ width: `${(currentShip.fireRate / 60) * 100}%` }} />
              </div>
            </div>
            <div className="tfu-stat-row">
              <div className="tfu-stat-info">
                <span className="tfu-stat-name">ЩИТЫ</span>
                <span className="tfu-stat-val">{currentShip.shield}</span>
              </div>
              <div className="tfu-stat-track">
                <div className="tfu-stat-fill" style={{ width: `${(currentShip.shield / 100) * 100}%` }} />
              </div>
            </div>
          </div>

          {currentShip.abilities.length > 0 && (
            <div className="tfu-abilities-section">
              <div className="tfu-abilities-header">СПОСОБНОСТИ</div>
              <div className="tfu-abilities-list">
                {currentShip.abilities.map((ab) => (
                  <div key={ab.id} className="tfu-ability-item">
                    <div className="tfu-ability-symbol-circle">
                      {ab.symbol === 'triangle' ? (
                        <svg viewBox="0 0 24 24"><polygon points="12,5 20,19 4,19" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="#ffffff" strokeWidth="2.5" /></svg>
                      )}
                    </div>
                    <div className="tfu-ability-content">
                      <div className="tfu-ability-name">{ab.name}</div>
                      <div className="tfu-ability-type">{ab.typeText}</div>
                      <div className="tfu-ability-desc">{ab.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tfu-hangar-side-window tfu-side-right">
        <div className="tfu-window-header">{currentShip.name}</div>
        <div className="tfu-info-desc">{currentShip.description}</div>

        {!isOwned ? (
          <button
            type="button"
            className={`tfu-hangar-action-btn tfu-btn-buy ${credits < currentShip.price ? 'disabled' : ''}`}
            onClick={handleBuy}
          >
            КУПИТЬ ЗА {currentShip.price}
          </button>
        ) : isSelected ? (
          <button type="button" className="tfu-hangar-action-btn tfu-btn-selected">
            ВЫБРАН
          </button>
        ) : (
          <button type="button" className="tfu-hangar-action-btn tfu-btn-select" onClick={handleSelect}>
            ВЫБРАТЬ
          </button>
        )}
      </div>

      <div className="tfu-hangar-bottom-controls">
        <button type="button" className="tfu-nav-square" onClick={handlePrev}>
          <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
        </button>

        <div className="tfu-nav-counter-box">
          {currentIndex + 1} / {HANGAR_SHIPS.length}
        </div>

        <button type="button" className="tfu-nav-square" onClick={handleNext}>
          <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
        </button>
      </div>
    </div>
  );
}
