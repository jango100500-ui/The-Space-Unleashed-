import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface IntroCutsceneProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function IntroCutscene({ onComplete, onError }: IntroCutsceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [curtainVisible, setCurtainVisible] = useState<boolean>(true);

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020409, 0.003);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1500);
    camera.position.set(0, 0, 0);

    const initialLookAt = new THREE.Vector3(40, 0, -10);
    camera.lookAt(initialLookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020409);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sunLight = new THREE.DirectionalLight(0xfffaed, 3.5);
    sunLight.position.set(40, 30, 20);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x3b82f6, 2.0);
    rimLight.position.set(-40, -15, -30);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x1a2636, 1.4);
    scene.add(ambientLight);

    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 500;
      starPos[i + 1] = (Math.random() - 0.5) * 400;
      starPos[i + 2] = (Math.random() - 0.5) * 600;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 0.9, transparent: true, opacity: 0.85 });
    scene.add(new THREE.Points(starGeo, starMat));

    const loader = new GLTFLoader();

    const loadModel = (url: string): Promise<THREE.Group> => {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            const group = gltf.scene;
            group.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                  const m = mesh.material as THREE.MeshStandardMaterial;
                  m.roughness = 0.45;
                  m.metalness = 0.65;
                }
              }
            });
            resolve(group);
          },
          undefined,
          () => reject(new Error(`Не удалось загрузить файл: ${url}`))
        );
      });
    };

    const startPos = new THREE.Vector3(50, 0, 20);
    const endPos = new THREE.Vector3(-120, 0, -220);
    const flightDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const flightDist = startPos.distanceTo(endPos);

    const sideNormal = new THREE.Vector3(-flightDir.z, 0, flightDir.x).normalize();

    let xwing: THREE.Group | null = null;
    let tieLeft: THREE.Group | null = null;
    let tieRight: THREE.Group | null = null;

    let startTime = 0;
    let lockedCameraLook = new THREE.Vector3();
    let hasLockedCamera = false;

    Promise.all([
      loadModel('/models/x-wing.glb'),
      loadModel('/models/tie.glb')
    ])
      .then(([xwingScene, tieScene]) => {
        if (isDisposed) return;

        xwing = xwingScene;
        xwing.scale.setScalar(2.2);
        xwing.position.copy(startPos);
        xwing.lookAt(new THREE.Vector3().addVectors(startPos, flightDir));
        scene.add(xwing);

        tieLeft = tieScene.clone();
        tieLeft.scale.setScalar(1.9);
        const tieLeftStart = startPos.clone().addScaledVector(sideNormal, -5.5);
        tieLeft.position.copy(tieLeftStart);
        tieLeft.lookAt(new THREE.Vector3().addVectors(tieLeftStart, flightDir));
        tieLeft.visible = false;
        scene.add(tieLeft);

        tieRight = tieScene.clone();
        tieRight.scale.setScalar(1.9);
        const tieRightStart = startPos.clone().addScaledVector(sideNormal, 5.5);
        tieRight.position.copy(tieRightStart);
        tieRight.lookAt(new THREE.Vector3().addVectors(tieRightStart, flightDir));
        tieRight.visible = false;
        scene.add(tieRight);

        renderer.render(scene, camera);

        setTimeout(() => {
          if (isDisposed) return;
          setCurtainVisible(false);

          setTimeout(() => {
            if (isDisposed) return;
            startTime = performance.now();
            requestAnimationFrame(renderLoop);
          }, 500);
        }, 50);
      })
      .catch((err) => {
        if (!isDisposed) {
          onError(err.message || 'Ошибка загрузки моделей');
        }
      });

    const renderLoop = (timestamp: number) => {
      if (isDisposed) return;

      const elapsed = (timestamp - startTime) / 1000;
      let currentShake = 0;

      if (elapsed <= 2.5 && xwing) {
        const xSpeed = flightDist / 2.3;
        const progressDist = elapsed * xSpeed;
        xwing.position.copy(startPos).addScaledVector(flightDir, progressDist);
        xwing.lookAt(new THREE.Vector3().addVectors(xwing.position, flightDir));

        const distToCam = xwing.position.distanceTo(camera.position);
        if (distToCam < 25) {
          currentShake = (1 - distToCam / 25) * 0.45;
        }

        camera.lookAt(xwing.position);
      } else if (elapsed > 2.5 && !hasLockedCamera && xwing) {
        hasLockedCamera = true;
        lockedCameraLook.copy(xwing.position);
      }

      if (hasLockedCamera) {
        camera.lookAt(lockedCameraLook);
      }

      if (elapsed >= 5.5 && elapsed <= 8.2) {
        const chaseElapsed = elapsed - 5.5;
        const tieSpeed = flightDist / 2.3;
        const tieProgress = chaseElapsed * tieSpeed;

        if (tieLeft) {
          tieLeft.visible = true;
          const leftBase = startPos.clone().addScaledVector(sideNormal, -5.5);
          tieLeft.position.copy(leftBase).addScaledVector(flightDir, tieProgress);
          tieLeft.lookAt(new THREE.Vector3().addVectors(tieLeft.position, flightDir));
        }

        if (tieRight) {
          tieRight.visible = true;
          const rightBase = startPos.clone().addScaledVector(sideNormal, 5.5);
          tieRight.position.copy(rightBase).addScaledVector(flightDir, tieProgress);
          tieRight.lookAt(new THREE.Vector3().addVectors(tieRight.position, flightDir));
        }

        if (tieLeft) {
          const distTie = tieLeft.position.distanceTo(camera.position);
          if (distTie < 25) {
            currentShake = (1 - distTie / 25) * 0.45;
          }
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

      if (elapsed >= 8.2 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 8.8) {
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
  }, [onComplete, onError]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <style>{`
        .cutscene-curtain {
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
      `}</style>

      <div className={`cutscene-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
