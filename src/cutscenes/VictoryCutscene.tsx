import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';
import { HANGAR_SHIPS } from '../components/HangarScreen.tsx';

interface VictoryCutsceneProps {
  assets: PreloadedAssets;
  selectedShipId?: string;
  onComplete: () => void;
}

export default function VictoryCutscene({ assets, selectedShipId = 'xwing', onComplete }: VictoryCutsceneProps) {
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

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 10000);
    camera.position.set(0, 16, 85);
    camera.lookAt(0, 12, -220);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000103);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const ambient = new THREE.AmbientLight(0x556677, 2.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffae8, 4.2);
    sun.position.set(120, 160, 90);
    scene.add(sun);

    const starCount = 2800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 3200;
      starPos[i + 1] = (Math.random() - 0.5) * 1800;
      starPos[i + 2] = (Math.random() - 0.5) * 3500;
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
    const shockRingGeo = new THREE.RingGeometry(0.6, 2.0, 18);
    const shockRingMat = new THREE.MeshBasicMaterial({ color: 0xff8822, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });

    const explosions: { mesh: THREE.Mesh; ring: THREE.Mesh; light?: THREE.PointLight; life: number; maxLife: number; scaleSpeed: number }[] = [];

    const spawnExplosion = (pos: THREE.Vector3, scale = 1.0) => {
      const flash = new THREE.Mesh(flashCoreGeo, flashCoreMat);
      flash.position.copy(pos);
      flash.scale.setScalar(2.2 * scale);
      scene.add(flash);

      const ring = new THREE.Mesh(shockRingGeo, shockRingMat.clone());
      ring.position.copy(pos);
      ring.rotation.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, Math.random() * Math.PI);
      scene.add(ring);

      const light = new THREE.PointLight(0xff6622, 5.5 * scale, 80 * scale);
      light.position.copy(pos);
      scene.add(light);

      explosions.push({ mesh: flash, ring, light, life: 0.45, maxLife: 0.45, scaleSpeed: 35.0 * scale });

      if (assets.audioBuffers.explode) {
        try {
          const src = assets.audioCtx.createBufferSource();
          src.buffer = assets.audioBuffers.explode;
          const gain = assets.audioCtx.createGain();
          gain.gain.value = 0.42;
          src.connect(gain);
          gain.connect(assets.audioCtx.destination);
          src.start(0);
        } catch {}
      }
    };

    const destroyerKeyPoints = [
      new THREE.Vector3(-16, 18, -230),
      new THREE.Vector3(18, 14, -250),
      new THREE.Vector3(0, 26, -210),
      new THREE.Vector3(-25, 8, -280),
      new THREE.Vector3(22, 10, -290),
      new THREE.Vector3(0, 16, -320)
    ];

    const tantiveList: THREE.Group[] = [];
    const spawnTantives = () => {
      for (let i = 0; i < 2; i++) {
        let cr: THREE.Group;
        if (assets.models.cr90) {
          cr = assets.models.cr90.clone();
        } else {
          cr = new THREE.Group();
          cr.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 30, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })));
        }
        cr.scale.setScalar(28.0);
        cr.position.set(-280 + i * 40, 20 + (i === 0 ? 35 : -25), -200 + i * 80);
        cr.rotation.set(0, Math.PI / 2, 0);
        scene.add(cr);
        tantiveList.push(cr);
      }
    };

    const fighterList: { mesh: THREE.Group; vel: THREE.Vector3; isRebel: boolean; alive: boolean }[] = [];
    const spawnFighters = () => {
      for (let i = 0; i < 5; i++) {
        const tie = (i % 2 === 0 && assets.models.tie2 ? assets.models.tie2 : assets.models.tie).clone();
        tie.scale.setScalar(2.2);
        tie.position.set(160 + (Math.random() - 0.5) * 60, 10 + (Math.random() - 0.5) * 40, -260 + (Math.random() - 0.5) * 80);
        tie.rotation.set(0, -Math.PI / 2, 0);
        scene.add(tie);
        fighterList.push({ mesh: tie, vel: new THREE.Vector3(-240 - Math.random() * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 30), isRebel: false, alive: true });
      }

      for (let i = 0; i < 4; i++) {
        const xw = assets.models.xwing.clone();
        xw.scale.setScalar(2.4);
        xw.position.set(-240 - i * 35, 25 + (Math.random() - 0.5) * 30, -180 + (Math.random() - 0.5) * 60);
        xw.rotation.set(0, Math.PI / 2, 0);
        scene.add(xw);
        fighterList.push({ mesh: xw, vel: new THREE.Vector3(260 + Math.random() * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 30), isRebel: true, alive: true });
      }
    };

    const playerShipHolder = new THREE.Group();
    playerShipHolder.visible = false;
    scene.add(playerShipHolder);

    const shipConf = HANGAR_SHIPS.find((s) => s.id === selectedShipId) || HANGAR_SHIPS[0];
    const loader = new GLTFLoader();

    if (selectedShipId === 'xwing') {
      const p = assets.models.xwing.clone();
      p.scale.setScalar(0.48);
      playerShipHolder.add(p);
    } else if (shipConf.modelUrl) {
      loader.load(shipConf.modelUrl, (gltf) => {
        if (isDisposed) return;
        const loaded = gltf.scene;
        const xBox = new THREE.Box3().setFromObject(assets.models.xwing);
        const xSize = new THREE.Vector3();
        xBox.getSize(xSize);
        const xMax = Math.max(xSize.x, xSize.y, xSize.z) || 1;

        const mBox = new THREE.Box3().setFromObject(loaded);
        const mSize = new THREE.Vector3();
        mBox.getSize(mSize);
        const mMax = Math.max(mSize.x, mSize.y, mSize.z) || 1;

        const targetScaleRatio = shipConf.id === 'ywing' ? 0.56 : 0.48;
        loaded.scale.setScalar((xMax / mMax) * targetScaleRatio);
        loaded.rotation.set(shipConf.rot[0], shipConf.rot[1], shipConf.rot[2]);
        playerShipHolder.add(loaded);
      });
    }

    const laserGeo = new THREE.CylinderGeometry(0.35, 0.35, 9, 4);
    laserGeo.rotateX(Math.PI / 2);
    const redLaserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const greenLaserMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });
    const lasers: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

    const fireLaser = (origin: THREE.Vector3, dir: THREE.Vector3, isGreen: boolean) => {
      const mesh = new THREE.Mesh(laserGeo, isGreen ? greenLaserMat : redLaserMat);
      mesh.position.copy(origin);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      scene.add(mesh);
      lasers.push({ mesh, vel: dir.multiplyScalar(650), life: 1.8 });
    };

    setTimeout(() => {
      if (!isDisposed) setCurtainVisible(false);
    }, 60);

    let startTime = performance.now();
    let phase2Started = false;
    let phase3Started = false;
    let nextExplosionTime = 0.4;
    let tiltRoll = 0.45;
    let tiltPitch = -0.22;

    const renderLoop = (time: number) => {
      if (isDisposed) return;

      const elapsed = (time - startTime) / 1000;
      const dt = 0.016;

      destroyer.rotation.z += tiltRoll * dt * 0.07;
      destroyer.rotation.x += tiltPitch * dt * 0.05;
      destroyer.position.y -= dt * 1.8;

      if (elapsed < 4.0) {
        if (elapsed >= nextExplosionTime) {
          nextExplosionTime += 0.35 + Math.random() * 0.3;
          const pt = destroyerKeyPoints[Math.floor(Math.random() * destroyerKeyPoints.length)];
          const jitter = new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 30);
          spawnExplosion(pt.clone().add(jitter), 1.4 + Math.random() * 0.8);
        }

        camera.position.set(0, 16 + elapsed * 1.2, 85 - elapsed * 8);
        camera.lookAt(0, 14, -240);
      } else if (elapsed < 9.0) {
        if (!phase2Started) {
          phase2Started = true;
          spawnTantives();
          spawnFighters();
        }

        const p2Elapsed = elapsed - 4.0;
        camera.position.set(0, 40, 220);
        camera.lookAt(-20, 18, -210);

        destroyer.position.x = 90;

        for (const t of tantiveList) {
          t.position.x += 42 * dt;
          if (Math.random() < 0.08) {
            const origin = t.position.clone().add(new THREE.Vector3(10, 4, (Math.random() - 0.5) * 12));
            const dir = new THREE.Vector3(1, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3).normalize();
            fireLaser(origin, dir, false);
          }
        }

        for (const f of fighterList) {
          if (!f.alive) continue;
          f.mesh.position.addScaledVector(f.vel, dt);

          if (Math.random() < 0.04) {
            const dir = f.vel.clone().normalize();
            fireLaser(f.mesh.position, dir, !f.isRebel);
          }

          if (p2Elapsed > 2.0 && Math.random() < 0.008) {
            f.alive = false;
            spawnExplosion(f.mesh.position, 1.8);
            scene.remove(f.mesh);
          }
        }

        if (Math.random() < 0.12) {
          const pt = destroyerKeyPoints[Math.floor(Math.random() * destroyerKeyPoints.length)];
          spawnExplosion(pt.clone().add(new THREE.Vector3(90, 0, 0)), 1.6);
        }
      } else if (elapsed < 14.0) {
        if (!phase3Started) {
          phase3Started = true;
          playerShipHolder.visible = true;
          playerShipHolder.position.set(-18, 12, 110);
        }

        const p3Elapsed = elapsed - 9.0;
        playerShipHolder.position.z -= 180 * dt;
        playerShipHolder.position.y += 2.2 * dt;

        camera.position.set(playerShipHolder.position.x, playerShipHolder.position.y + 3.8, playerShipHolder.position.z + 14);
        camera.lookAt(playerShipHolder.position.x, playerShipHolder.position.y + 1.2, playerShipHolder.position.z - 60);

        if (Math.random() < 0.15) {
          const pt = destroyerKeyPoints[Math.floor(Math.random() * destroyerKeyPoints.length)];
          spawnExplosion(pt.clone().add(new THREE.Vector3(90, 0, 0)), 2.0);
        }

        if (p3Elapsed >= 3.6 && !curtainVisible) {
          setCurtainVisible(true);
        }

        if (p3Elapsed >= 4.8) {
          onCompleteRef.current();
          return;
        }
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.life -= dt;
        l.mesh.position.addScaledVector(l.vel, dt);
        if (l.life <= 0) {
          scene.remove(l.mesh);
          lasers.splice(i, 1);
        }
      }

      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life -= dt;
        const progress = 1 - ex.life / ex.maxLife;
        ex.ring.scale.setScalar(1.0 + progress * ex.scaleSpeed);
        (ex.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ex.life / ex.maxLife);
        if (ex.light) {
          ex.light.intensity = (ex.life / ex.maxLife) * 5.0;
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
      lasers.forEach((l) => scene.remove(l.mesh));
      explosions.forEach((e) => {
        scene.remove(e.mesh);
        scene.remove(e.ring);
        if (e.light) scene.remove(e.light);
      });
      tantiveList.forEach((t) => scene.remove(t));
      fighterList.forEach((f) => scene.remove(f.mesh));
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets, selectedShipId]);

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
