import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedModels } from '../App.tsx';

interface LoadingScreenProps {
  onComplete: (models: PreloadedModels) => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('ПОДГОТОВКА СИСТЕМ...');
  const [fadeOut, setFadeOut] = useState<boolean>(false);

  useEffect(() => {
    let isDisposed = false;
    const loader = new GLTFLoader();

    const optimizeModel = (group: THREE.Group) => {
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const m = mesh.material as THREE.MeshStandardMaterial;
            m.roughness = 0.38;
            m.metalness = 0.75;
          }
        }
      });
    };

    const load = (url: string, onProg: (p: number) => void): Promise<THREE.Group> => {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            optimizeModel(gltf.scene);
            resolve(gltf.scene);
          },
          (xhr) => {
            if (xhr.total > 0) {
              onProg(xhr.loaded / xhr.total);
            }
          },
          (err) => reject(err)
        );
      });
    };

    const runLoading = async () => {
      let loadedXwing: THREE.Group | null = null;
      let loadedTie: THREE.Group | null = null;

      try {
        setStatusText('ЗАГРУЗКА T-65B X-WING...');
        setProgress(15);

        loadedXwing = await load('/models/x-wing.glb', (p) => {
          if (!isDisposed) setProgress(Math.floor(15 + p * 35));
        });

        if (isDisposed) return;
        setStatusText('ЗАГРУЗКА СИД-ИСТРЕБИТЕЛЕЙ...');
        setProgress(55);

        loadedTie = await load('/models/tie.glb', (p) => {
          if (!isDisposed) setProgress(Math.floor(55 + p * 35));
        });

        if (isDisposed) return;
        setStatusText('СИНХРОНИЗАЦИЯ НАВИГАЦИИ...');
        setProgress(95);

        await new Promise((r) => setTimeout(r, 600));
        if (isDisposed) return;

        setProgress(100);
        setStatusText('СИСТЕМЫ ГОТОВЫ');

        await new Promise((r) => setTimeout(r, 400));
        if (isDisposed) return;

        setFadeOut(true);

        setTimeout(() => {
          if (!isDisposed && loadedXwing && loadedTie) {
            onComplete({ xwing: loadedXwing, tie: loadedTie });
          }
        }, 550);
      } catch {
        const createBox = (w: number, h: number, d: number, color: number) => {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color })));
          return g;
        };

        const fbXwing = loadedXwing || createBox(3, 0.8, 4, 0xbdc3c7);
        const fbTie = loadedTie || createBox(2, 2, 1.8, 0x475569);

        setProgress(100);
        setStatusText('РЕЗЕРВНЫЙ СТАРТ');
        setFadeOut(true);

        setTimeout(() => {
          if (!isDisposed) {
            onComplete({ xwing: fbXwing, tie: fbTie });
          }
        }, 550);
      }
    };

    runLoading();

    return () => {
      isDisposed = true;
    };
  }, [onComplete]);

  return (
    <div className={`ls-container ${fadeOut ? 'ls-fading' : ''}`}>
      <style>{`
        .ls-container {
          position: absolute;
          inset: 0;
          background-color: #000000;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          padding: 30px 0 10px;
          opacity: 1;
          transition: opacity 0.55s ease-in-out;
          z-index: 100;
        }
        .ls-fading {
          opacity: 0;
        }
        .ls-logo-box {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .ls-logo-wrapper {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .ls-logo-base {
          max-width: 440px;
          max-height: 175px;
          width: 50vw;
          object-fit: contain;
          opacity: 0.22;
          filter: brightness(0.5);
          display: block;
        }
        .ls-logo-fill {
          position: absolute;
          inset: 0;
          max-width: 440px;
          max-height: 175px;
          width: 50vw;
          height: 100%;
          object-fit: contain;
          opacity: 1;
          filter: drop-shadow(0 0 18px rgba(100, 180, 255, 0.75));
          transition: clip-path 0.15s linear;
        }
        .ls-bottom-block {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .ls-status {
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 2px;
          color: #7b9ab8;
          text-transform: uppercase;
        }
        .ls-bar-frame {
          width: min(440px, 60vw);
          height: 11px;
          background-color: #040608;
          border: 1px solid #2a3440;
          padding: 1px;
          clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%);
        }
        .ls-bar-fill {
          height: 100%;
          background-color: #ffffff;
          clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%);
        }
      `}</style>

      <div className="ls-logo-box">
        <div className="ls-logo-wrapper">
          <img src="/mocs/tsu.png" alt="TSU" className="ls-logo-base" />
          <img
            src="/mocs/tsu.png"
            alt="TSU Active"
            className="ls-logo-fill"
            style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
          />
        </div>
      </div>

      <div className="ls-bottom-block">
        <div className="ls-status">{statusText}</div>
        <div className="ls-bar-frame">
          <div className="ls-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
