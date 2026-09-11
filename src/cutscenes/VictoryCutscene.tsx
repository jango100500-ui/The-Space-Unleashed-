import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PreloadedAssets } from '../App.tsx';

interface VictoryCutsceneProps {
  assets: PreloadedAssets;
  selectedShipId?: string;
  onComplete: () => void;
}

export default function VictoryCutscene({ assets, onComplete }: VictoryCutsceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000205, 0.00035);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 8000);
    camera.position.set(0, 18, 90);
    camera.lookAt(0, 14, -240);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000103);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const ambient = new THREE.AmbientLight(0x667788, 2.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffae8, 4.5);
    sun.position.set(100, 150, 90);
    scene.add(sun);

    const starCount = 2600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 3000;
      starPos[i + 1] = (Math.random() - 0.5) * 1600;
      starPos[i + 2] = (Math.random() - 0.5) * 3000;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.2, transparent: true, opacity: 0.85 });
    scene.add(new THREE.Points(starGeo, starMat));

    const destroyer = assets.models.destroyer.clone();
    destroyer.scale.setScalar(8.0);
    destroyer.position.set(0, 12, -260);
    destroyer.rotation.set(0, Math.PI, 0);
    scene.add(destroyer);

    const flashCoreGeo = new THREE.IcosahedronGeometry(2.4, 1);
    const flashCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const shockRingGeo = new THREE.RingGeometry(0.6, 2.2, 18);
    const shockRingMat = new THREE.MeshBasicMaterial({ color: 0xff8822, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });

    const explosions: { mesh: THREE.Mesh; ring: THREE.Mesh; light?: THREE.PointLight; life: number; maxLife: number; scaleSpeed: number }[] = [];

    const spawnExplosion = (pos: THREE.Vector3, scale = 1.0) => {
      const flash = new THREE.Mesh(flashCoreGeo, flashCoreMat);
      flash.position.copy(pos);
      flash.scale.setScalar(2.4 * scale);
      scene.add(flash);

      const ring = new THREE.Mesh(shockRingGeo, shockRingMat.clone());
      ring.position.copy(pos);
      ring.rotation.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, Math.random() * Math.PI);
      scene.add(ring);

      const light = new THREE.PointLight(0xff6622, 6.0 * scale, 90 * scale);
      light.position.copy(pos);
      scene.add(light);

      explosions.push({ mesh: flash, ring, light, life: 0.5, maxLife: 0.5, scaleSpeed: 38.0 * scale });

      if (assets.audioBuffers.explode) {
        try {
          const src = assets.audioCtx.createBufferSource();
          src.buffer = assets.audioBuffers.explode;
          const gain = assets.audioCtx.createGain();
          gain.gain.value = 0.45;
          src.connect(gain);
          gain.connect(assets.audioCtx.destination);
          src.start(0);
        } catch {}
      }
    };

    const destroyerKeyPoints = [
      new THREE.Vector3(-18, 18, -230),
      new THREE.Vector3(18, 14, -250),
      new THREE.Vector3(0, 24, -210),
      new THREE.Vector3(-24, 8, -280),
      new THREE.Vector3(22, 10, -290),
      new THREE.Vector3(0, 16, -320)
    ];

    setTimeout(() => {
      if (!isDisposed) setCurtainVisible(false);
    }, 50);

    let startTime = performance.now();
    let nextExplosionTime = 0.8;
    let tiltRoll = 0.42;
    let tiltPitch = -0.18;

    const renderLoop = (time: number) => {
      if (isDisposed) return;

      const elapsed = (time - startTime) / 1000;
      const dt = 0.016;

      destroyer.rotation.z += tiltRoll * dt * 0.08;
      destroyer.rotation.x += tiltPitch * dt * 0.06;
      destroyer.position.y -= dt * 1.6;

      camera.position.set(0, 18 + elapsed * 0.9, 90 - elapsed * 7);
      camera.lookAt(0, 14 - elapsed * 0.5, -240);

      if (elapsed >= nextExplosionTime && elapsed < 4.2) {
        nextExplosionTime += 0.95 + Math.random() * 0.25;
        const pt = destroyerKeyPoints[Math.floor(Math.random() * destroyerKeyPoints.length)];
        const jitter = new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 24);
        spawnExplosion(pt.clone().add(jitter), 1.6 + Math.random() * 0.6);
      }

      if (elapsed >= 4.2 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 5.0) {
        onCompleteRef.current();
        return;
      }

      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life -= dt;
        const progress = 1 - ex.life / ex.maxLife;
        ex.ring.scale.setScalar(1.0 + progress * ex.scaleSpeed);
        (ex.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ex.life / ex.maxLife);
        if (ex.light) {
          ex.light.intensity = (ex.life / ex.maxLife) * 6.0;
        }
        if (ex.life <= 0) {
          scene.remove(ex.mesh);
          scene.remove(ex.ring);
          if (ex.light) scene.remove(ex.light);
          explosions.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      explosions.forEach((e) => {
        scene.remove(e.mesh);
        scene.remove(e.ring);
        if (e.light) scene.remove(e.light);
      });
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000', zIndex: 65 }}>
      <style>{`
        .cutscene-curtain {
          position: absolute;
          inset: 0;
          background-color: #000000;
          pointer-events: none;
          transition: opacity 0.45s ease-in-out;
          z-index: 80;
        }
        .curtain-black {
          opacity: 1;
        }
        .curtain-clear {
          opacity: 0;
        }
        .cutscene-letterbox-bar {
          position: absolute;
          left: 0;
          right: 0;
          height: 14%;
          background-color: #000000;
          z-index: 75;
          pointer-events: none;
        }
        .cutscene-letterbox-top {
          top: 0;
        }
        .cutscene-letterbox-bottom {
          bottom: 0;
        }
      `}</style>

      <div className="cutscene-letterbox-bar cutscene-letterbox-top" />
      <div className="cutscene-letterbox-bar cutscene-letterbox-bottom" />
      <div className={`cutscene-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
