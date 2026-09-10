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
    scene.fog = new THREE.FogExp2(0x020409, 0.0015);

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 4000);
    const cameraBasePos = new THREE.Vector3(0, 0, 0);
    camera.position.copy(cameraBasePos);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020409);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sunLight = new THREE.DirectionalLight(0xfffaed, 4.0);
    sunLight.position.set(100, 60, 50);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x4080ff, 2.5);
    rimLight.position.set(-100, -30, -70);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x1a2636, 1.8);
    scene.add(ambientLight);

    const starCount = 2200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 1200;
      starPos[i + 1] = (Math.random() - 0.5) * 900;
      starPos[i + 2] = (Math.random() - 0.5) * 1600;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.15, transparent: true, opacity: 0.9 });
    scene.add(new THREE.Points(starGeo, starMat));

    const startPos = new THREE.Vector3(260, 8, -10);
    const endPos = new THREE.Vector3(-480, -10, -560);
    const flightDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const sideNormal = new THREE.Vector3(-flightDir.z, 0, flightDir.x).normalize();

    const speed = 360;

    const alignAndSway = (
      ship: THREE.Group,
      pos: THREE.Vector3,
      time: number,
      rollPhase: number,
      pitchPhase: number
    ) => {
      ship.position.copy(pos);
      ship.lookAt(pos.clone().add(flightDir));
      ship.rotateY(Math.PI);
      ship.rotateZ(Math.sin(time * 3.2 + rollPhase) * 0.08);
      ship.rotateX(Math.cos(time * 2.4 + pitchPhase) * 0.04);
    };

    const xwing = models.xwing.clone();
    xwing.scale.setScalar(4.5);
    alignAndSway(xwing, startPos, 0, 0, 0);
    scene.add(xwing);

    const tieLeftStart = startPos.clone().addScaledVector(sideNormal, -15);
    const tieLeft = models.tie.clone();
    tieLeft.scale.setScalar(3.8);
    tieLeft.visible = false;
    alignAndSway(tieLeft, tieLeftStart, 0, 1.2, 0.5);
    scene.add(tieLeft);

    const tieRightStart = startPos.clone().addScaledVector(sideNormal, 15);
    const tieRight = models.tie.clone();
    tieRight.scale.setScalar(3.8);
    tieRight.visible = false;
    alignAndSway(tieRight, tieRightStart, 0, -1.5, 1.0);
    scene.add(tieRight);

    camera.lookAt(new THREE.Vector3(120, 4, -5));
    renderer.render(scene, camera);

    let startTime = 0;
    const lockedCameraDir = new THREE.Vector3();
    let hasLockedCamera = false;

    setTimeout(() => {
      if (isDisposed) return;
      setCurtainVisible(false);

      setTimeout(() => {
        if (isDisposed) return;
        startTime = performance.now();
        requestAnimationFrame(renderLoop);
      }, 450);
    }, 40);

    const renderLoop = (timestamp: number) => {
      if (isDisposed) return;

      const elapsed = (timestamp - startTime) / 1000;
      let currentShake = 0;
      const shakeRadius = 36;

      const xDist = elapsed * speed;
      const xCurrentPos = startPos.clone().addScaledVector(flightDir, xDist);
      alignAndSway(xwing, xCurrentPos, elapsed, 0, 0);

      const xCamDist = xwing.position.distanceTo(cameraBasePos);
      if (xCamDist < shakeRadius) {
        const factor = Math.pow(1 - xCamDist / shakeRadius, 2);
        currentShake = Math.max(currentShake, factor * 0.6);
      }

      if (elapsed < 1.1) {
        camera.lookAt(xwing.position.x * 0.85, xwing.position.y, xwing.position.z);
      } else if (!hasLockedCamera) {
        hasLockedCamera = true;
        camera.getWorldDirection(lockedCameraDir);
      }

      if (hasLockedCamera) {
        camera.lookAt(cameraBasePos.clone().add(lockedCameraDir));
      }

      if (elapsed >= 2.0) {
        const tieElapsed = elapsed - 2.0;
        const tieDist = tieElapsed * speed;

        tieLeft.visible = true;
        const leftPos = tieLeftStart.clone().addScaledVector(flightDir, tieDist);
        alignAndSway(tieLeft, leftPos, tieElapsed, 1.2, 0.5);

        tieRight.visible = true;
        const rightPos = tieRightStart.clone().addScaledVector(flightDir, tieDist);
        alignAndSway(tieRight, rightPos, tieElapsed, -1.5, 1.0);

        const tieCamDist = Math.min(
          tieLeft.position.distanceTo(cameraBasePos),
          tieRight.position.distanceTo(cameraBasePos)
        );

        if (tieCamDist < shakeRadius) {
          const factor = Math.pow(1 - tieCamDist / shakeRadius, 2);
          currentShake = Math.max(currentShake, factor * 0.55);
        }
      }

      if (currentShake > 0) {
        camera.position.set(
          (Math.random() - 0.5) * currentShake,
          (Math.random() - 0.5) * currentShake,
          (Math.random() - 0.5) * currentShake
        );
      } else {
        camera.position.copy(cameraBasePos);
      }

      if (elapsed >= 4.2 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 4.8) {
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
          transition: opacity 0.45s ease-in-out;
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
