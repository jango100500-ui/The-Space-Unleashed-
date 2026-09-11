import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';
import { HANGAR_SHIPS } from '../components/HangarScreen.tsx';

interface IntroCutsceneProps {
  assets: PreloadedAssets;
  selectedShipId?: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function IntroCutscene({ assets, selectedShipId = 'xwing', onComplete }: IntroCutsceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const { models, audioBuffers, audioCtx } = assets;

    const muffle = audioCtx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 520;
    muffle.connect(audioCtx.destination);

    const xwingEngineGain = audioCtx.createGain();
    xwingEngineGain.gain.value = 0;
    xwingEngineGain.connect(muffle);

    const tieEngineGain = audioCtx.createGain();
    tieEngineGain.gain.value = 0;
    tieEngineGain.connect(muffle);

    let xwingSource: AudioBufferSourceNode | null = null;
    let tieSource: AudioBufferSourceNode | null = null;

    if (audioBuffers.xwingEngine) {
      xwingSource = audioCtx.createBufferSource();
      xwingSource.buffer = audioBuffers.xwingEngine;
      xwingSource.loop = true;
      xwingSource.connect(xwingEngineGain);
      xwingSource.start(0);
    }

    if (audioBuffers.tieEngine) {
      tieSource = audioCtx.createBufferSource();
      tieSource.buffer = audioBuffers.tieEngine;
      tieSource.loop = true;
      tieSource.connect(tieEngineGain);
      tieSource.start(0);
    }

    const playCutsceneSound = (buf: AudioBuffer | undefined, vol: number) => {
      if (!buf || isDisposed) return;
      try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const g = audioCtx.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(muffle);
        src.start(0);
      } catch {
        return;
      }
    };

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000205, 0.001);

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 5000);
    const cameraBasePos = new THREE.Vector3(0, 0, 0);
    camera.position.copy(cameraBasePos);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000205);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const flatAmbient = new THREE.AmbientLight(0x444444, 2.2);
    scene.add(flatAmbient);

    const mainSun = new THREE.DirectionalLight(0xffffff, 3.8);
    mainSun.position.set(60, 90, 45);
    scene.add(mainSun);

    const fillLight = new THREE.DirectionalLight(0x888888, 1.4);
    fillLight.position.set(-60, -30, -50);
    scene.add(fillLight);

    const starCount = 2500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 1500;
      starPos[i + 1] = (Math.random() - 0.5) * 1200;
      starPos[i + 2] = (Math.random() - 0.5) * 2000;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.2, transparent: true, opacity: 0.9 });
    scene.add(new THREE.Points(starGeo, starMat));

    const startPos = new THREE.Vector3(180, 5, -15);
    const endPos = new THREE.Vector3(-320, -5, -260);
    const flightDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const sideNormal = new THREE.Vector3(-flightDir.z, 0, flightDir.x).normalize();

    const shipSpeed = 290;
    const laserSpeed = 620;

    const alignAndSway = (
      ship: THREE.Group,
      pos: THREE.Vector3,
      time: number,
      rollPhase: number
    ) => {
      ship.position.copy(pos);
      ship.lookAt(pos.clone().add(flightDir));
      ship.rotateY(Math.PI);
      ship.rotateZ(Math.sin(time * 3.4 + rollPhase) * 0.07);
      ship.rotateX(Math.cos(time * 2.6) * 0.03);
    };

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

    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    const shipConf = HANGAR_SHIPS.find((s) => s.id === selectedShipId) || HANGAR_SHIPS[0];
    const gltfLoader = new GLTFLoader();

    const attachShipMesh = (mesh: THREE.Group) => {
      tuneTextures(mesh);
      const xBox = new THREE.Box3().setFromObject(models.xwing);
      const xSize = new THREE.Vector3();
      xBox.getSize(xSize);
      const xMax = Math.max(xSize.x, xSize.y, xSize.z) || 1;

      const mBox = new THREE.Box3().setFromObject(mesh);
      const mSize = new THREE.Vector3();
      mBox.getSize(mSize);
      const mMax = Math.max(mSize.x, mSize.y, mSize.z) || 1;

      const targetScale = selectedShipId === 'ywing' ? 5.2 : 4.6;
      const normalizedScale = (xMax / mMax) * targetScale;

      mesh.scale.setScalar(normalizedScale);
      mesh.rotation.set(shipConf.rot[0], shipConf.rot[1], shipConf.rot[2]);
      playerGroup.add(mesh);
    };

    if (selectedShipId === 'xwing') {
      const xwing = models.xwing.clone();
      attachShipMesh(xwing);
    } else if (shipConf.modelUrl) {
      gltfLoader.load(
        shipConf.modelUrl,
        (gltf) => {
          if (isDisposed) return;
          attachShipMesh(gltf.scene);
        },
        undefined,
        () => {
          if (isDisposed) return;
          const fb = models.xwing.clone();
          attachShipMesh(fb);
        }
      );
    } else {
      const fb = models.xwing.clone();
      attachShipMesh(fb);
    }

    alignAndSway(playerGroup, startPos, 0, 0);

    const tieLeftStart = startPos.clone().addScaledVector(sideNormal, -24);
    const tieLeft = models.tie.clone();
    tieLeft.scale.setScalar(3.8);
    tuneTextures(tieLeft);
    alignAndSway(tieLeft, tieLeftStart.clone().addScaledVector(flightDir, -300), 0, 1.2);
    scene.add(tieLeft);

    const tieRightStart = startPos.clone().addScaledVector(sideNormal, 24);
    const tieRight = models.tie.clone();
    tieRight.scale.setScalar(3.8);
    tuneTextures(tieRight);
    alignAndSway(tieRight, tieRightStart.clone().addScaledVector(flightDir, -300), 0, -1.5);
    scene.add(tieRight);

    const laserGeo = new THREE.CylinderGeometry(0.18, 0.18, 6, 6);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x33ff44 });

    const lasers: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

    const spawnLaser = (origin: THREE.Vector3) => {
      const mesh = new THREE.Mesh(laserGeo, laserMat);
      mesh.position.copy(origin);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), flightDir);
      scene.add(mesh);
      lasers.push({
        mesh,
        vel: flightDir.clone().multiplyScalar(laserSpeed),
        life: 2.2,
      });
    };

    camera.lookAt(new THREE.Vector3(90, 3, -10));
    renderer.compile(scene, camera);
    renderer.render(scene, camera);

    let startTime = 0;
    const lockedCameraDir = new THREE.Vector3();
    let hasLockedCamera = false;
    let firedBurst1 = false;
    let firedBurst2 = false;

    setTimeout(() => {
      if (isDisposed) return;
      setCurtainVisible(false);

      setTimeout(() => {
        if (isDisposed) return;
        startTime = performance.now();
        requestAnimationFrame(renderLoop);
      }, 400);
    }, 30);

    const renderLoop = (timestamp: number) => {
      if (isDisposed) return;

      const elapsed = (timestamp - startTime) / 1000;
      let currentShake = 0;
      const shakeRadius = 50;

      const xDist = elapsed * shipSpeed;
      const xCurrentPos = startPos.clone().addScaledVector(flightDir, xDist);
      alignAndSway(playerGroup, xCurrentPos, elapsed, 0);

      const xCamDist = playerGroup.position.distanceTo(cameraBasePos);
      if (xCamDist < shakeRadius) {
        const factor = Math.pow(1 - xCamDist / shakeRadius, 2);
        currentShake = Math.max(currentShake, factor * 0.95);
      }

      if (xCamDist < 120) {
        const factor = Math.max(0, 1 - xCamDist / 120);
        xwingEngineGain.gain.value = factor * 0.28;
      } else {
        xwingEngineGain.gain.value = 0;
      }

      if (elapsed < 1.05) {
        camera.lookAt(playerGroup.position.x * 0.9, playerGroup.position.y, playerGroup.position.z);
      } else if (!hasLockedCamera) {
        hasLockedCamera = true;
        camera.getWorldDirection(lockedCameraDir);
      }

      if (hasLockedCamera) {
        camera.lookAt(cameraBasePos.clone().add(lockedCameraDir));
      }

      if (elapsed >= 1.9) {
        const tieElapsed = elapsed - 1.9;
        const tieDist = tieElapsed * shipSpeed;

        const leftPos = tieLeftStart.clone().addScaledVector(flightDir, tieDist);
        alignAndSway(tieLeft, leftPos, tieElapsed, 1.2);

        const rightPos = tieRightStart.clone().addScaledVector(flightDir, tieDist);
        alignAndSway(tieRight, rightPos, tieElapsed, -1.5);

        const tieCamDist = Math.min(
          tieLeft.position.distanceTo(cameraBasePos),
          tieRight.position.distanceTo(cameraBasePos)
        );

        if (tieCamDist < shakeRadius) {
          const factor = Math.pow(1 - tieCamDist / shakeRadius, 2);
          currentShake = Math.max(currentShake, factor * 0.9);
        }

        if (tieCamDist < 130) {
          const factor = Math.max(0, 1 - tieCamDist / 130);
          tieEngineGain.gain.value = factor * 0.32;
        } else {
          tieEngineGain.gain.value = 0;
        }

        if (tieElapsed > 0.35 && !firedBurst1) {
          firedBurst1 = true;
          spawnLaser(tieLeft.position.clone().add(new THREE.Vector3(0, -0.6, 0)));
          spawnLaser(tieRight.position.clone().add(new THREE.Vector3(0, -0.6, 0)));
          playCutsceneSound(audioBuffers.tieShot, 0.24);
        }

        if (tieElapsed > 0.8 && !firedBurst2) {
          firedBurst2 = true;
          spawnLaser(tieLeft.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
          spawnLaser(tieRight.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
          playCutsceneSound(audioBuffers.tieShot, 0.24);
        }
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.life -= 0.016;
        l.mesh.position.addScaledVector(l.vel, 0.016);
        if (l.life <= 0) {
          scene.remove(l.mesh);
          lasers.splice(i, 1);
        }
      }

      if (currentShake > 0) {
        camera.position.set(
          cameraBasePos.x + (Math.random() - 0.5) * currentShake,
          cameraBasePos.y + (Math.random() - 0.5) * currentShake,
          cameraBasePos.z + (Math.random() - 0.5) * currentShake
        );
      } else {
        camera.position.copy(cameraBasePos);
      }

      if (elapsed >= 4.5 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 5.1) {
        onComplete();
        return;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

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
      if (xwingSource) xwingSource.stop();
      if (tieSource) tieSource.stop();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets, selectedShipId, onComplete]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <style>{`
        .cutscene-curtain {
          position: absolute;
          inset: 0;
          background-color: #000000;
          pointer-events: none;
          transition: opacity 0.45s ease-in-out;
          z-index: 50;
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
          height: 16%;
          background-color: #000000;
          z-index: 40;
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

      <div className={`cutscene-curtain ${curtainVisible ? 'cutscene-black' : 'curtain-clear'}`} />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
