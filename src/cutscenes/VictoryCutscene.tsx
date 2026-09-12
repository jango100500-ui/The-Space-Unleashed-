import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PreloadedAssets } from '../App.tsx';
import {
  createExplosionGlowTexture,
  createExplosionRingTexture,
  RetroExplosionInstance,
  ExplosionSmokeParticle
} from '../game/GameData.ts';

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

    // Ретро-освещение
    const ambient = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
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

    // Убираем черный PBR-глянец
    destroyer.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m) {
          m.roughness = 1.0;
          m.metalness = 0.0;
          m.needsUpdate = true;
        }
      }
    });
    scene.add(destroyer);

    // === ТЕКСТУРЫ НОВОГО ВЗРЫВА ===
    const sharedGlowTexture = createExplosionGlowTexture();
    const sharedRingTexture = createExplosionRingTexture();
    const ringPlaneGeo = new THREE.PlaneGeometry(1, 1);

    const explosions: RetroExplosionInstance[] = [];

    const spawnExplosion = (pos: THREE.Vector3, scale = 1.0) => {
      const expGroup = new THREE.Group();
      expGroup.position.copy(pos);
      scene.add(expGroup);

      const outerMat = new THREE.SpriteMaterial({
        map: sharedGlowTexture,
        color: 0xff3300,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerCore = new THREE.Sprite(outerMat);
      outerCore.scale.set(2.0 * scale, 2.0 * scale, 1);
      expGroup.add(outerCore);

      const coreMat = new THREE.SpriteMaterial({
        map: sharedGlowTexture,
        color: 0xffaa00,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const core = new THREE.Sprite(coreMat);
      core.scale.set(1.0 * scale, 1.0 * scale, 1);
      expGroup.add(core);

      const innerMat = new THREE.SpriteMaterial({
        map: sharedGlowTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const innerCore = new THREE.Sprite(innerMat);
      innerCore.scale.set(0.5 * scale, 0.5 * scale, 1);
      expGroup.add(innerCore);

      const ringMat = new THREE.MeshBasicMaterial({
        map: sharedRingTexture,
        color: 0xffddaa,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringPlaneGeo, ringMat);
      ringMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      ringMesh.scale.set(1.0 * scale, 1.0 * scale, 1);
      expGroup.add(ringMesh);

      const smoke: ExplosionSmokeParticle[] = [];
      const particleCount = 18;
      for (let i = 0; i < particleCount; i++) {
        const sMat = new THREE.SpriteMaterial({
          map: sharedGlowTexture,
          color: 0xff5500,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(sMat);
        const pScale = (2.2 + Math.random() * 2.5) * scale;
        sprite.scale.set(pScale, pScale, 1);
        expGroup.add(sprite);

        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
        smoke.push({
          sprite,
          velocity: dir.multiplyScalar((16 + Math.random() * 26) * scale),
          life: 1.3,
          age: 0,
          initialScale: pScale
        });
      }

      const light = new THREE.PointLight(0xff6622, 12.0 * scale, 120 * scale);
      light.position.copy(pos);
      scene.add(light);

      explosions.push({
        group: expGroup,
        smoke,
        shockwaveMesh: ringMesh,
        shockwaveAge: 0,
        shockwaveLife: 0.9,
        shockwaveMaxScale: 40.0 * scale,
        outerCore,
        core,
        innerCore,
        light,
        age: 0,
        duration: 1.4
      });

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
        spawnExplosion(pt.clone().add(jitter), 1.8 + Math.random() * 0.6);
      }

      if (elapsed >= 4.2 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 5.0) {
        onCompleteRef.current();
        return;
      }

      // Анимация взрывов по формуле референса
      for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.age += dt;
        const p = THREE.MathUtils.clamp(exp.age / exp.duration, 0, 1);

        const alpha = Math.max(0, 1.0 - p);
        (exp.outerCore.material as THREE.SpriteMaterial).opacity = alpha * 0.9;
        (exp.core.material as THREE.SpriteMaterial).opacity = Math.pow(alpha, 1.2) * 0.95;
        (exp.innerCore.material as THREE.SpriteMaterial).opacity = Math.pow(alpha, 1.5);

        const expExpansion = 1 - Math.pow(1 - p, 1.8);
        exp.outerCore.scale.addScalar(expExpansion * 5.0 * dt);
        exp.core.scale.addScalar(expExpansion * 3.0 * dt);

        if (exp.shockwaveMesh) {
          exp.shockwaveAge += dt;
          const sP = THREE.MathUtils.clamp(exp.shockwaveAge / exp.shockwaveLife, 0, 1);
          const currentScale = (1 - Math.pow(1 - sP, 2.0)) * exp.shockwaveMaxScale;
          exp.shockwaveMesh.scale.set(currentScale, currentScale, 1);
          (exp.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - sP, 1.2) * 0.95;

          if (sP >= 1.0) {
            exp.group.remove(exp.shockwaveMesh);
            (exp.shockwaveMesh.material as THREE.Material).dispose();
            exp.shockwaveMesh = null;
          }
        }

        for (let sIdx = exp.smoke.length - 1; sIdx >= 0; sIdx--) {
          const s = exp.smoke[sIdx];
          s.age += dt;
          if (s.age >= s.life || alpha <= 0) {
            exp.group.remove(s.sprite);
            (s.sprite.material as THREE.Material).dispose();
            exp.smoke.splice(sIdx, 1);
            continue;
          }
          s.velocity.multiplyScalar(0.95);
          s.sprite.position.addScaledVector(s.velocity, dt);
          const sProg = s.age / s.life;
          const currentScale = s.initialScale + sProg * 9.0;
          s.sprite.scale.set(currentScale, currentScale, 1);
          (s.sprite.material as THREE.SpriteMaterial).opacity = (1 - sProg) * 0.65;
        }

        if (exp.light) {
          exp.light.intensity = alpha * 12.0;
        }

        if (exp.age >= exp.duration) {
          scene.remove(exp.group);
          if (exp.light) scene.remove(exp.light);
          (exp.outerCore.material as THREE.Material).dispose();
          (exp.core.material as THREE.Material).dispose();
          (exp.innerCore.material as THREE.Material).dispose();
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
        scene.remove(e.group);
        if (e.light) scene.remove(e.light);
      });
      ringPlaneGeo.dispose();
      sharedGlowTexture.dispose();
      sharedRingTexture.dispose();
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
