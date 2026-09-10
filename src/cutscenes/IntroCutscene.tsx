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
    scene.fog = new THREE.FogExp2(0x020409, 0.0025);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 2000);
    camera.position.set(0, 0, 0);

    const initialLookAt = new THREE.Vector3(50, 0, 10);
    camera.lookAt(initialLookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020409);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sunLight = new THREE.DirectionalLight(0xfffaed, 3.8);
    sunLight.position.set(60, 40, 30);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x3b82f6, 2.2);
    rimLight.position.set(-60, -20, -40);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x1a2636, 1.5);
    scene.add(ambientLight);

    const starCount = 1600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 600;
      starPos[i + 1] = (Math.random() - 0.5) * 500;
      starPos[i + 2] = (Math.random() - 0.5) * 800;
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

    const startPos = new THREE.Vector3(90, 0, 35);
    const endPos = new THREE.Vector3(-260, 0, -320);
    const flightDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();

    const sideNormal = new THREE.Vector3(-flightDir.z, 0, flightDir.x).normalize();

    const xwingSpeed = 82;
    const tieSpeed = 88;

    let xwing: THREE.Group | null = null;
    let tieLeft: THREE.Group | null = null;
    let tieRight: THREE.Group | null = null;

    let startTime = 0;
    const lockedCameraDir = new THREE.Vector3();
    let hasLockedCamera = false;

    const alignShip = (ship: THREE.Group, pos: THREE.Vector3) => {
      ship.position.copy(pos);
      ship.lookAt(pos.clone().add(flightDir));
      ship.rotateY(Math.PI);
    };

    Promise.all([
      loadModel('/models/x-wing.glb'),
      loadModel('/models/tie.glb')
    ])
      .then(([xwingScene, tieScene]) => {
        if (isDisposed) return;

        xwing = xwingScene;
        xwing.scale.setScalar(3.2);
        alignShip(xwing, startPos);
        scene.add(xwing);

        tieLeft = tieScene.clone();
        tieLeft.scale.setScalar(2.7);
        const tieLeftStart = startPos.clone().addScaledVector(sideNormal, -8);
        alignShip(tieLeft, tieLeftStart);
        tieLeft.visible = false;
        scene.add(tieLeft);

        tieRight = tieScene.clone();
        tieRight.scale.setScalar(2.7);
        const tieRightStart = startPos.clone().addScaledVector(sideNormal, 8);
        alignShip(tieRight, tieRightStart);
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

      if (xwing) {
        const xDist = elapsed * xwingSpeed;
        const currentPos = startPos.clone().addScaledVector(flightDir, xDist);
        alignShip(xwing, currentPos);

        const distToCam = xwing.position.distanceTo(camera.position);
        if (distToCam < 32) {
          currentShake = Math.max(currentShake, (1 - distToCam / 32) * 0.55);
        }

        if (elapsed < 1.6) {
          camera.lookAt(xwing.position);
        } else if (!hasLockedCamera) {
          hasLockedCamera = true;
          camera.getWorldDirection(lockedCameraDir);
        }
      }

      if (hasLockedCamera) {
        camera.lookAt(camera.position.clone().add(lockedCameraDir));
      }

      if (elapsed >= 2.0) {
        const tieElapsed = elapsed - 2.0;
        const tieDist = tieElapsed * tieSpeed;

        if (tieLeft) {
          tieLeft.visible = true;
          const leftPos = startPos.clone().addScaledVector(sideNormal, -8).addScaledVector(flightDir, tieDist);
          alignShip(tieLeft, leftPos);

          const distLeft = tieLeft.position.distanceTo(camera.position);
          if (distLeft < 32) {
            currentShake = Math.max(currentShake, (1 - distLeft / 32) * 0.5);
          }
        }

        if (tieRight) {
          tieRight.visible = true;
          const rightPos = startPos.clone().addScaledVector(sideNormal, 8).addScaledVector(flightDir, tieDist);
          alignShip(tieRight, rightPos);

          const distRight = tieRight.position.distanceTo(camera.position);
          if (distRight < 32) {
            currentShake = Math.max(currentShake, (1 - distRight / 32) * 0.5);
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

      if (elapsed >= 5.0 && !curtainVisible) {
        setCurtainVisible(true);
      }

      if (elapsed >= 5.6) {
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
