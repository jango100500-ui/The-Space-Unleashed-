import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PreloadedModels } from '../App.tsx';

interface GameScreenProps {
  models: PreloadedModels;
  onExit: () => void;
}

interface Enemy {
  mesh: THREE.Group;
  state: 'entering' | 'attacking' | 'looping';
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  shootCooldown: number;
  loopAngle: number;
  loopCenter: THREE.Vector3;
  loopRadius: number;
  side: number;
  roll: number;
}

interface Laser {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  isEnemy: boolean;
}

export default function GameScreen({ models, onExit }: GameScreenProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);
  const [hp, setHp] = useState<number>(100);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    scene.fog = new THREE.FogExp2(0x02060f, 0.002);

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 2000);
    const cameraBase = new THREE.Vector3(0, 2.5, 9.5);
    camera.position.copy(cameraBase);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x02060f);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sunLight = new THREE.DirectionalLight(0xfffae8, 5.0);
    sunLight.position.set(60, 90, 40);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x0088ff, 4.2);
    rimLight.position.set(-60, -30, -50);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x050c18, 0.9);
    scene.add(ambientLight);

    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 1200;
      starPos[i + 1] = (Math.random() - 0.5) * 800;
      starPos[i + 2] = (Math.random() - 0.5) * 1600;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.1, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const defaultShipPos = new THREE.Vector3(0, -1.8, 0);
    const shipPos = defaultShipPos.clone();

    const playerShip = models.xwing.clone();
    playerShip.scale.setScalar(1.9);
    playerShip.position.copy(shipPos);
    playerShip.rotation.set(0, Math.PI, 0);
    scene.add(playerShip);

    const crosshairTex = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x64b5f6, wireframe: true, transparent: true, opacity: 0.45 })
    );
    crosshairTex.position.set(0, 0, -45);
    scene.add(crosshairTex);

    const redLaserGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5);
    redLaserGeo.rotateX(Math.PI / 2);
    const redLaserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    const greenLaserGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.5, 5);
    greenLaserGeo.rotateX(Math.PI / 2);
    const greenLaserMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });

    const lasers: Laser[] = [];
    const enemies: Enemy[] = [];

    const spawnEnemyWave = () => {
      const side = Math.random() > 0.5 ? 1 : -1;
      const startX = side * (35 + Math.random() * 15);
      const startY = (Math.random() - 0.5) * 12;
      const startZ = -160 - Math.random() * 40;

      const mesh = models.tie.clone();
      mesh.scale.setScalar(1.6);
      scene.add(mesh);

      const targetPos = new THREE.Vector3(startX > 0 ? 6 : -6, (Math.random() - 0.5) * 4, -40);
      const dir = new THREE.Vector3().subVectors(targetPos, new THREE.Vector3(startX, startY, startZ)).normalize();

      enemies.push({
        mesh,
        state: 'entering',
        pos: new THREE.Vector3(startX, startY, startZ),
        dir,
        speed: 85 + Math.random() * 20,
        shootCooldown: 1.2 + Math.random() * 1.5,
        loopAngle: 0,
        loopCenter: new THREE.Vector3(),
        loopRadius: 28 + Math.random() * 12,
        side,
        roll: 0
      });
    };

    spawnEnemyWave();
    spawnEnemyWave();

    let spawnTimer = 0;
    let fireCooldown = 0;
    let wingAlt = 0;
    let shakeIntensity = 0;
    let currentHp = 100;

    setTimeout(() => {
      if (!isDisposed) setCurtainVisible(false);
    }, 50);

    let lastTime = performance.now();

    const gameLoop = (timestamp: number) => {
      if (isDisposed) return;

      const dt = Math.min((timestamp - lastTime) / 1000, 0.045);
      lastTime = timestamp;

      const input = inputRef.current;
      const targetX = defaultShipPos.x + input.x * 11;
      const targetY = defaultShipPos.y + input.y * 6.5;

      const smoothFactor = input.x === 0 && input.y === 0 ? 9.0 : 6.0;
      shipPos.x = THREE.MathUtils.lerp(shipPos.x, targetX, dt * smoothFactor);
      shipPos.y = THREE.MathUtils.lerp(shipPos.y, targetY, dt * smoothFactor);

      playerShip.position.copy(shipPos);
      playerShip.rotation.z = THREE.MathUtils.lerp(playerShip.rotation.z, -input.x * 0.55, dt * 8);
      playerShip.rotation.x = THREE.MathUtils.lerp(playerShip.rotation.x, input.y * 0.25, dt * 8);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraBase.x + shipPos.x * 0.35, dt * 5);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraBase.y + (shipPos.y - defaultShipPos.y) * 0.35, dt * 5);

      let closestEnemy: Enemy | null = null;
      let closestDist = 999;

      for (const e of enemies) {
        if (e.state === 'attacking' && e.pos.z < shipPos.z - 5) {
          const d = e.pos.distanceTo(shipPos);
          if (d < 120 && d < closestDist) {
            closestDist = d;
            closestEnemy = e;
          }
        }
      }

      if (closestEnemy && closestDist < 75) {
        crosshairTex.position.set(closestEnemy.pos.x * 0.85, closestEnemy.pos.y * 0.85, -45);
        (crosshairTex.material as THREE.MeshBasicMaterial).color.setHex(0xff3333);
        crosshairTex.scale.setScalar(0.7);
      } else {
        crosshairTex.position.set(shipPos.x * 0.3, shipPos.y * 0.3 + 1.2, -45);
        (crosshairTex.material as THREE.MeshBasicMaterial).color.setHex(0x64b5f6);
        crosshairTex.scale.setScalar(1.0);
      }

      fireCooldown -= dt;
      if (input.fire && fireCooldown <= 0) {
        fireCooldown = 0.13;
        wingAlt = (wingAlt + 1) % 4;

        const wingOffsets = [
          new THREE.Vector3(-1.6, 0.45, -0.6),
          new THREE.Vector3(1.6, 0.45, -0.6),
          new THREE.Vector3(-1.6, -0.35, -0.6),
          new THREE.Vector3(1.6, -0.35, -0.6)
        ];
        const offset = wingOffsets[wingAlt].clone().applyQuaternion(playerShip.quaternion);

        const lMesh = new THREE.Mesh(redLaserGeo, redLaserMat);
        lMesh.position.copy(shipPos).add(offset);

        let aimTarget = new THREE.Vector3(shipPos.x, shipPos.y + 0.3, -120);
        if (closestEnemy && closestDist < 75) {
          aimTarget.copy(closestEnemy.pos);
        }

        const lDir = new THREE.Vector3().subVectors(aimTarget, lMesh.position).normalize();
        lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), lDir);
        scene.add(lMesh);

        lasers.push({ mesh: lMesh, vel: lDir.multiplyScalar(260), life: 1.2, isEnemy: false });
        playTone(900, 280, 0.08, 0.12, 'sawtooth');
      }

      spawnTimer += dt;
      if (spawnTimer > 4.2) {
        spawnTimer = 0;
        if (enemies.length < 3) {
          spawnEnemyWave();
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        if (e.state === 'entering') {
          e.pos.addScaledVector(e.dir, e.speed * dt);
          if (e.pos.z > -100) {
            e.state = 'attacking';
            e.dir.set(0, 0, 1);
          }
        } else if (e.state === 'attacking') {
          const chaseDir = new THREE.Vector3().subVectors(shipPos, e.pos).normalize();
          e.dir.x = THREE.MathUtils.lerp(e.dir.x, chaseDir.x * 0.4, dt * 2);
          e.dir.y = THREE.MathUtils.lerp(e.dir.y, chaseDir.y * 0.3, dt * 2);
          e.dir.z = 1;
          e.dir.normalize();

          e.pos.addScaledVector(e.dir, e.speed * dt);

          e.shootCooldown -= dt;
          if (e.shootCooldown <= 0 && e.pos.z < shipPos.z - 15) {
            e.shootCooldown = 1.6 + Math.random() * 0.8;
            for (const s of [-0.6, 0.6]) {
              const lMesh = new THREE.Mesh(greenLaserGeo, greenLaserMat);
              lMesh.position.set(e.pos.x + s, e.pos.y - 0.2, e.pos.z + 1.2);
              const laserDir = new THREE.Vector3().subVectors(shipPos, lMesh.position).normalize();
              lMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), laserDir);
              scene.add(lMesh);
              lasers.push({ mesh: lMesh, vel: laserDir.multiplyScalar(155), life: 2.0, isEnemy: true });
            }
            playTone(450, 140, 0.12, 0.08, 'square');
          }

          if (e.pos.z > camera.position.z + 14) {
            e.state = 'looping';
            e.loopAngle = 0;
            const turnRight = e.pos.x > 0;
            e.loopCenter.set(e.pos.x + (turnRight ? -e.loopRadius : e.loopRadius), e.pos.y, e.pos.z);
          }
        } else if (e.state === 'looping') {
          e.loopAngle += dt * 1.8;
          const turnRight = e.side > 0;
          const currentA = turnRight ? e.loopAngle : -e.loopAngle;
          e.pos.x = e.loopCenter.x + Math.sin(currentA) * e.loopRadius;
          e.pos.z = e.loopCenter.z - (1 - Math.cos(currentA)) * e.loopRadius * 2.2;
          e.roll = turnRight ? -0.8 : 0.8;

          if (e.loopAngle >= Math.PI) {
            e.state = 'attacking';
            e.pos.z = -180;
            e.pos.x = (Math.random() - 0.5) * 40;
            e.dir.set(0, 0, 1);
            e.shootCooldown = 1.2;
          }
        }

        e.mesh.position.copy(e.pos);
        const lookTarget = e.pos.clone().add(e.dir);
        e.mesh.lookAt(lookTarget);
        e.mesh.rotateY(Math.PI);
        if (e.state === 'looping') {
          e.mesh.rotateZ(e.roll);
        }
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.life -= dt;
        l.mesh.position.addScaledVector(l.vel, dt);

        if (l.isEnemy) {
          if (l.mesh.position.distanceTo(shipPos) < 2.0) {
            l.life = 0;
            shakeIntensity = 0.85;
            currentHp = Math.max(0, currentHp - 14);
            setHp(currentHp);
            playTone(160, 40, 0.25, 0.25, 'sawtooth');
            if (currentHp <= 0) {
              setCurtainVisible(true);
              setTimeout(() => onExit(), 500);
            }
          }
        } else {
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (l.mesh.position.distanceTo(e.pos) < 2.8) {
              l.life = 0;
              playTone(220, 60, 0.35, 0.3, 'sawtooth');
              scene.remove(e.mesh);
              enemies.splice(j, 1);
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
      }

      camera.lookAt(shipPos.x * 0.25, shipPos.y * 0.25 + 0.8, -40);

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
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [models, onExit]);

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    stickTouchId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setJoystickActive(true);
    handleStickMove(e);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickTouchId.current !== e.pointerId) return;
    const dx = e.clientX - stickCenter.current.x;
    const dy = e.clientY - stickCenter.current.y;
    const maxRadius = 45;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * clampedDist) / maxRadius;
    const ny = -(Math.sin(angle) * clampedDist) / maxRadius;

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
        }
        .tfu-hp-container {
          position: absolute;
          top: 16px;
          left: 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tfu-hp-label {
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #ff4757;
          text-shadow: 0 1px 3px #000;
        }
        .tfu-hp-frame {
          width: min(240px, 32vw);
          height: 14px;
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
          right: 25px;
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
          right: 165px;
          bottom: 30px;
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
      `}</style>

      <div className={`game-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />

      <div className="tfu-hud">
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
          onPointerDown={() => setIsFiring(true)}
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
