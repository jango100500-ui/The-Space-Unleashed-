import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';

interface HangarScreenProps {
  assets: PreloadedAssets;
  selectedShipId: string;
  onSelectShip: (id: string) => void;
  onBack: () => void;
}

export interface HangarShipData {
  id: string;
  name: string;
  description: string;
  modelUrl?: string;
  scale: number;
  rot: [number, number, number];
}

export const HANGAR_SHIPS: HangarShipData[] = [
  {
    id: 'xwing',
    name: 'X-ВИНГ',
    description: 'Универсальный звездный истребитель T-65B Альянса повстанцев. Баланс скорости, огневой мощи и маневренности.',
    scale: 0.52,
    rot: [0, 0, 0]
  },
  {
    id: 'bwing',
    name: 'B-ВИНГ',
    description: 'Тяжелый штурмовой истребитель A/SF-01. Обладает гироскопической кабиной и разрушительной огневой мощью.',
    modelUrl: '/models/b-wing.glb',
    scale: 0.48,
    rot: [0.08, 0, 0]
  },
  {
    id: 'slave1',
    name: 'РАБ 1',
    description: 'Грозный корабль типа «Огневержец-31». Оснащен мощным арсеналом, поворотной кабиной и тяжелой броней.',
    modelUrl: '/models/slave-1.glb',
    scale: 0.52,
    rot: [0, 0, 0]
  },
  {
    id: 'twing',
    name: 'T-ВИНГ',
    description: 'Маневренный перехватчик с клиновидным профилем корпуса для скоростных перехватов в открытом космосе.',
    modelUrl: '/models/t-wing.glb',
    scale: 0.52,
    rot: [0.08, 0, 0]
  },
  {
    id: 'uwing',
    name: 'U-ВИНГ',
    description: 'Ударный десантный корабль UT-60D с изменяемой геометрией крыла и усиленными защитными щитами.',
    modelUrl: '/models/u-wing.glb',
    scale: 0.52,
    rot: [0, 0, 0]
  },
  {
    id: 'ywing',
    name: 'Y-ВИНГ',
    description: 'Надежный тяжелый истребитель-бомбардировщик BTL-A4. Превосходная прочность корпуса и выносливость в бою.',
    modelUrl: '/models/y-wing.glb',
    scale: 0.52,
    rot: [0, Math.PI, 0]
  }
];

const createFallbackProcedural = (id: string): THREE.Group => {
  const g = new THREE.Group();
  if (id === 'bwing') {
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x95a5a6 }));
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0xe74c3c }));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(0, 1.8, 0);
    g.add(mainBody, pod);
  } else if (id === 'slave1') {
    const base = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
    base.rotation.x = Math.PI / 2;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x8e44ad }));
    skirt.position.set(0, -0.4, 0.6);
    g.add(base, skirt);
  } else if (id === 'twing') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x3498db }));
    cone.rotation.x = -Math.PI / 2;
    g.add(cone);
  } else if (id === 'uwing') {
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 3.6), new THREE.MeshStandardMaterial({ color: 0xecf0f1 }));
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0xbdc3c7 }));
    wingL.position.set(0, 0.1, -0.6);
    g.add(fuselage, wingL);
  } else if (id === 'ywing') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 3.2), new THREE.MeshStandardMaterial({ color: 0xecf0f1 }));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0, 1.8);
    const engL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x7f8c8d }));
    engL.rotation.x = Math.PI / 2;
    engL.position.set(-1.1, 0, -0.2);
    const engR = engL.clone();
    engR.position.x = 1.1;
    g.add(body, head, engL, engR);
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x7f8c8d })));
  }
  return g;
};

export default function HangarScreen({ assets, selectedShipId, onSelectShip, onBack }: HangarScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [ownedShips, setOwnedShips] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tsu_owned_ships');
      return saved ? JSON.parse(saved) : ['xwing'];
    } catch {
      return ['xwing'];
    }
  });

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
    }
  }, [selectedShipId]);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = mountRef.current ? mountRef.current.clientWidth : window.innerWidth;
    const height = mountRef.current ? mountRef.current.clientHeight : window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020409, 0.002);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(-1.2, 1.4, 6.2);
    camera.lookAt(new THREE.Vector3(-1.0, 0, 0));

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
    rimLight.position.set(-1.0, -1.8, 0);
    scene.add(rimLight);

    const floorRingGeo = new THREE.RingGeometry(1.8, 2.05, 32);
    floorRingGeo.rotateX(-Math.PI / 2);
    const floorRingMat = new THREE.MeshBasicMaterial({ color: 0x00b0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    const floorRing = new THREE.Mesh(floorRingGeo, floorRingMat);
    floorRing.position.set(-1.0, -1.3, 0);
    scene.add(floorRing);

    const gridHelper = new THREE.GridHelper(5, 12, 0x00e5ff, 0x15354e);
    gridHelper.position.set(-1.0, -1.31, 0);
    scene.add(gridHelper);

    const shipHolder = new THREE.Group();
    shipHolder.position.set(-1.0, 0.1, 0);
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

      if (ship.id === 'twing') {
        cloned.scale.setScalar(ship.scale);
      } else {
        const xBox = new THREE.Box3().setFromObject(assets.models.xwing);
        const xSize = new THREE.Vector3();
        xBox.getSize(xSize);
        const xMax = Math.max(xSize.x, xSize.y, xSize.z) || 1;

        const mBox = new THREE.Box3().setFromObject(cloned);
        const mSize = new THREE.Vector3();
        mBox.getSize(mSize);
        const mMax = Math.max(mSize.x, mSize.y, mSize.z) || 1;

        const normalizedScale = (xMax / mMax) * 0.52;
        cloned.scale.setScalar(normalizedScale);
      }

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
      floorRing.rotation.z += dt * 0.3;

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
    playClick();
    const updated = [...ownedShips, currentShip.id];
    setOwnedShips(updated);
    try {
      localStorage.setItem('tsu_owned_ships', JSON.stringify(updated));
    } catch {}
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
            radial-gradient(ellipse at 35% 45%, rgba(10, 60, 110, 0.45) 0%, transparent 65%),
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
          color: #64b5f6;
          text-transform: uppercase;
        }
        .tfu-hangar-canvas {
          position: absolute;
          inset: 0;
          z-index: 10;
        }
        .tfu-hangar-info-window {
          position: absolute;
          right: clamp(16px, 4vw, 44px);
          top: 50%;
          transform: translateY(-56%);
          width: min(340px, 42vw);
          background: #0a111a;
          border: 2px solid #5a738e;
          border-top: 2px solid #8fa9c4;
          border-radius: 0px;
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85);
          z-index: 25;
          pointer-events: auto;
        }
        .tfu-info-name {
          font-family: Arial, sans-serif;
          font-size: clamp(16px, 2vw, 20px);
          font-weight: 900;
          letter-spacing: 2.5px;
          color: #ffffff;
          text-transform: uppercase;
          border-bottom: 1px solid #233446;
          padding-bottom: 8px;
        }
        .tfu-info-desc {
          font-family: Arial, sans-serif;
          font-size: clamp(11px, 1.2vw, 13px);
          line-height: 1.55;
          color: #a4b8cc;
          min-height: 70px;
        }
        .tfu-hangar-action-btn {
          width: 100%;
          height: 38px;
          border-radius: 0px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          transition: transform 0.05s ease;
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
        .tfu-btn-select {
          border: 2px solid #64b5f6;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #0284c7 0%, #0369a1 45%, #075985 55%, #0c4a6e 100%);
          color: #ffffff;
        }
        .tfu-btn-selected {
          border: 2px solid #475569;
          background: #1e293b;
          color: #64748b;
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
          border: 2px solid #5a738e;
          background: linear-gradient(180deg, #2a3d52 0%, #111a24 100%);
          color: #ffffff;
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
          width: min(260px, 44vw);
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
      </div>

      <div ref={mountRef} className="tfu-hangar-canvas" />

      <div className="tfu-hangar-info-window">
        <div className="tfu-info-name">{currentShip.name}</div>
        <div className="tfu-info-desc">{currentShip.description}</div>

        {!isOwned ? (
          <button type="button" className="tfu-hangar-action-btn tfu-btn-buy" onClick={handleBuy}>
            КУПИТЬ ЗА 0
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
