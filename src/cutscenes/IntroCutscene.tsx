import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PreloadedModels } from '../App.tsx';

interface IntroCutsceneProps {
  models: PreloadedModels;
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function IntroCutscene({ models, onComplete }: IntroCutsceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020409, 0.0018);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 3000);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020409);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sunLight = new THREE.DirectionalLight(0xfffaed, 4.2);
    sunLight.position.set(70, 50, 40);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x4080ff, 2.5);
    rimLight.position.set(-70, -30, -50);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x1a2636, 1.6);
    scene.add(ambientLight);

    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 800;
      starPos[i + 1] = (Math.random() - 0.5) * 600;
      starPos[i + 2] = (Math.random() - 0.5) * 1200;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.1, transparent: true, opacity: 0.9 });
    scene.add(new THREE.Points(starGeo, starMat));

    const streakCount = 120;
    const streakPos = new Float32Array(streakCount * 6);
    for (let i = 0; i < streakCount; i++) {
      const x = (Math.random() - 0.5) * 120;
      const y = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 200;
      streakPos[i * 6] = x;
      streakPos[i * 6 + 1] = y;
      streakPos[i * 6 + 2] = z;
      streakPos[i * 6 + 3] = x;
      streakPos[i * 6 + 4] = y;
      streakPos[i * 6 + 5] = z - 6;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
    const streakMat = new THREE.LineBasicMaterial({ color: 0x64b5f6, transparent: true, opacity: 0.35 });
    scene.add(new THREE.LineSegments(streakGeo, streakMat));

    const startPos = new THREE.Vector3(120, 2, 45);
    const endPos = new THREE.Vector3(-360, -8, -500);
    const flightDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const sideNormal = new THREE.Vector3(-flightDir.z, 0, flightDir.x).normalize();

    const xwingSpeed = 145;
    const tieSpeed = 160;

    const alignShip = (ship: THREE.Group, pos: THREE.Vector3) => {
      ship.position.copy(pos);
      ship.lookAt(pos.clone().add(flightDir));
      ship.rotateY(Math.PI);
    };

    const xwing = models.xwing.clone();
    xwing.scale.setScalar(4.2);
    alignShip(xwing, startPos);
    scene.add(xwing);

    const tieLeft = models.tie.clone();
    tieLeft.scale.setScalar(3.4);
    const tieLeftStart = startPos.clone().addScaledVector(sideNormal, -12);
    alignShip(tieLeft, tieLeftStart);
    tieLeft.visible = false;
    scene.add(tieLeft);

    const tieRight = models.tie.clone();
    tieRight.scale.setScalar(3.4);
    const tieRightStart = startPos.clone().addScaledVector(sideNormal, 12);
    alignShip(tieRight, tieRightStart);
    tieRight.visible = false;
    scene.add(tieRight);

    const laserGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 6);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x33ff44 });

    const lasers: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

    const spawnTieLaser = (origin: THREE.Vector3) => {
      const mesh = new THREE.Mesh(laserGeo, laserMat);
      mesh.position.copy(origin);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), flightDir);
      scene.add(mesh);
      lasers.push({
        mesh,
        vel: flightDir.clone().multiplyScalar(260),
        life: 1.8,
      });
    };

    camera.lookAt(startPos.clone().multiplyScalar(0.7));
    renderer.render(scene, camera);

    let startTime = 0;
    const lockedCameraDir = new THREE.Vector3();
    let hasLockedCamera = false;
    let firedSalvo1 = false;
    let firedSalvo2 = false;

    setTimeout(() => {
      if (isDisposed) return;
      setCurtainVisible(false);

      setTimeout(() => {
        if (isDisposed) return;
        startTime = performance.now();
        requestAnimationFrame(renderLoop);
      }, 420);
    }, 40);

    const renderLoop = (timestamp: number) => {
      if (isDisposed) return;

      const elapsed = (timestamp - startTime) / 1000;
      let currentShake = 0;

      const xDist = elapsed * xwingSpeed;
      const xCurrentPos = startPos.clone().addScaledVector(flightDir, xDist);
      alignShip(xwing, xCurrentPos);

      const xCamDist = xwing.position.distanceTo(camera.position);
      if (xCamDist < 42) {
        currentShake = Math.max(currentShake, (1 - xCamDist / 42) * 0.85);
      }

      if (elapsed < 1.4) {
        camera.lookAt(xwing.position);
      } else if (!hasLockedCamera) {
        hasLockedCamera = true;
        camera.getWorldDirection(lockedCameraDir);
      }

      if (hasLockedCamera) {
        camera.lookAt(camera.position.clone().add(lockedCameraDir));
      }

      if (elapsed >= 1.8) {
        const tieElapsed = elapsed - 1.8;
        const tieDist = tieElapsed * tieSpeed;

        tieLeft.visible = true;
        const leftPos = startPos.clone().addScaledVector(sideNormal, -12).addScaledVector(flightDir, tieDist);
        alignShip(tieLeft, leftPos);

        tieRight.visible = true;
        const rightPos = startPos.clone().addScaledVector(sideNormal, 12).addScaledVector(flightDir, tieDist);
        alignShip(tieRight, rightPos);

        const tieCamDist = Math.min(
          tieLeft.position.distanceTo(camera.position),
          tieRight.position.distanceTo(camera.position)
        );

        if (tieCamDist < 42) {
          currentShake = Math.max(currentShake, (1 - tieCamDist / 42) * 0.75);
        }

        if (tieElapsed > 0.4 && !firedSalvo1) {
          firedSalvo1 = true;
          spawnTieLaser(tieLeft.position.clone().add(new THREE.Vector3(0, -0.5, 0)));
          spawnTieLaser(tieRight.position.clone().add(new THREE.Vector3(0, -0.5, 0)));
        }

        if (tieElapsed > 0.85 && !firedSalvo2) {
          firedSalvo2 = true;
          spawnTieLaser(tieLeft.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
          spawnTieLaser(tieRight.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
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
          (Math.random() - 0.5) * currentShake,
          (Math.random() - 0.5) * currentShake,
          (Math.random() - 0.5) * currentShake
        );
      } else {
        camera.position.set(0, 0, 0);
      }

      if (elapsed >= 4.6 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 5.2) {
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
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [models, onComplete]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <style>{`
        .cutscene-curtain {
          position: absolute;
          inset: 0;
          background-color: #000000;
          pointer-events: none;
          transition: opacity 0.4s ease-in-out;
          z-index: 50;
        }
        .curtain-black {
          opacity: 1;
        }
        .curtain-clear {
          opacity: 0;
        }
      `}</style>

      <div className={`cutscene-curtain ${curtainVisible ? 'cutscene-black' : 'curtain-clear'}`} />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
