import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface IntroCutsceneProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function IntroCutscene({ onComplete, onError }: IntroCutsceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [fadeState, setFadeState] = useState<'fadeIn' | 'visible' | 'fadeOut'>('fadeIn');

  useEffect(() => {
    let animId: number;
    let isDisposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020409, 0.0035);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020409);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sunLight = new THREE.DirectionalLight(0xfffaed, 3.2);
    sunLight.position.set(40, 30, -20);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x3b82f6, 1.8);
    rimLight.position.set(-40, -10, 20);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x1a2636, 1.2);
    scene.add(ambientLight);

    const starCount = 1200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 400;
      starPos[i + 1] = (Math.random() - 0.5) * 300;
      starPos[i + 2] = (Math.random() - 0.5) * 500;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 0.9, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

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

    let xwing: THREE.Group | null = null;
    let tieLeft: THREE.Group | null = null;
    let tieRight: THREE.Group | null = null;

    let startTime = 0;

    Promise.all([
      loadModel('/models/x-wing.glb'),
      loadModel('/models/tie.glb')
    ])
      .then(([xwingScene, tieScene]) => {
        if (isDisposed) return;

        xwing = xwingScene;
        xwing.scale.setScalar(0.7);
        xwing.position.set(12, -2, 10);
        xwing.rotation.set(0, -Math.PI * 0.72, -0.2);
        scene.add(xwing);

        tieLeft = tieScene.clone();
        tieLeft.scale.setScalar(0.65);
        tieLeft.position.set(22, 0, 35);
        tieLeft.rotation.set(0, -Math.PI * 0.72, 0.1);
        scene.add(tieLeft);

        tieRight = tieScene.clone();
        tieRight.scale.setScalar(0.65);
        tieRight.position.set(30, -3, 45);
        tieRight.rotation.set(0, -Math.PI * 0.72, -0.15);
        scene.add(tieRight);

        setFadeState('visible');
        startTime = performance.now();
        requestAnimationFrame(renderLoop);
      })
      .catch((err) => {
        if (!isDisposed) {
          onError(err.message || 'Ошибка загрузки моделей');
        }
      });

    const renderLoop = (timestamp: number) => {
      if (isDisposed) return;

      const elapsed = (timestamp - startTime) / 1000;

      if (xwing) {
        const xProgress = elapsed * 58;
        xwing.position.x = 12 - xProgress * 0.35;
        xwing.position.y = -2 + xProgress * 0.05;
        xwing.position.z = 10 - xProgress * 0.95;

        if (elapsed < 1.1) {
          const lookTarget = new THREE.Vector3().copy(xwing.position);
          camera.lookAt(lookTarget);
        }
      }

      if (elapsed >= 1.0) {
        const chaseElapsed = elapsed - 1.0;
        const tieSpeed = chaseElapsed * 64;

        if (tieLeft) {
          tieLeft.position.x = 10 - tieSpeed * 0.35;
          tieLeft.position.y = 0 + tieSpeed * 0.05;
          tieLeft.position.z = 12 - tieSpeed * 0.95;
          tieLeft.rotation.z = Math.sin(chaseElapsed * 3) * 0.1;
        }

        if (tieRight) {
          tieRight.position.x = 16 - tieSpeed * 0.35;
          tieRight.position.y = -3 + tieSpeed * 0.05;
          tieRight.position.z = 18 - tieSpeed * 0.95;
          tieRight.rotation.z = -Math.sin(chaseElapsed * 3) * 0.1;
        }
      }

      if (elapsed >= 3.0 && fadeState !== 'fadeOut') {
        setFadeState('fadeOut');
      }

      if (elapsed >= 3.8) {
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

      <div
        className={`cutscene-curtain ${fadeState === 'visible' ? 'curtain-clear' : 'curtain-black'}`}
      />

      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
