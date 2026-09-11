import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PreloadedAssets } from '../App.tsx';

interface HallwayCutsceneProps {
  assets: PreloadedAssets;
  onComplete: () => void;
}

export default function HallwayCutscene({ assets, onComplete }: HallwayCutsceneProps) {
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

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    camera.position.set(-1.0, 2.6, 4.8);
    camera.rotation.set(-0.05, 0.45, 0.02);

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x05070a);

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const { audioCtx, audioBuffers } = assets;
    let droidAudioSource: AudioBufferSourceNode | null = null;
    let droidGainNode: GainNode | null = null;

    const setupAudio = async () => {
      try {
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const res = await fetch('/sounds/droid.mp3');
        const buf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);

        if (isDisposed) return;

        const src = audioCtx.createBufferSource();
        src.buffer = decoded;
        src.loop = true;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.04;

        src.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(0);

        droidAudioSource = src;
        droidGainNode = gain;
      } catch {
        return;
      }
    };

    setupAudio();

    const playMuffledExplosion = () => {
      if (!audioBuffers.explode || isDisposed) return;
      try {
        const src = audioCtx.createBufferSource();
        src.buffer = audioBuffers.explode;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.55;

        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(0);
      } catch {
        return;
      }
    };

    const hallwayLight = new THREE.PointLight(0x7090b0, 3.0, 40);
    hallwayLight.position.set(0, 4.0, 0);
    scene.add(hallwayLight);

    const hallwayAmbient = new THREE.AmbientLight(0x283444, 2.2);
    scene.add(hallwayAmbient);

    const redEmergency = new THREE.PointLight(0xcc2222, 1.5, 25);
    redEmergency.position.set(4, 3.2, -1);
    scene.add(redEmergency);

    const createProceduralCorridor = () => {
      const g = new THREE.Group();
      const wallMat = new THREE.MeshLambertMaterial({ color: 0x222a35, side: THREE.DoubleSide });
      const floorMat = new THREE.MeshLambertMaterial({ color: 0x0f141a });
      const lightStripMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 30), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0, 0);
      g.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 30), wallMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(0, 4.2, 0);
      g.add(ceiling);

      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), wallMat);
      backWall.rotation.y = Math.PI / 2;
      backWall.position.set(-5, 2.1, 0);
      g.add(backWall);

      const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), wallMat);
      frontWall.rotation.y = -Math.PI / 2;
      frontWall.position.set(5, 2.1, 0);
      g.add(frontWall);

      for (let i = -4; i <= 4; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 1.8), lightStripMat);
        strip.position.set(0, 4.15, i * 3.2);
        g.add(strip);
      }
      return g;
    };

    const createProceduralDroid = () => {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x11161d });
      const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x8a6d3b });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), bodyMat);
      body.position.y = 0.55;
      g.add(body);

      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.45, 16), bronzeMat);
      head.position.y = 1.1;
      g.add(head);

      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), eyeMat);
      eye.position.set(0, 1.1, -0.3);
      g.add(eye);

      return g;
    };

    const loader = new GLTFLoader();

    const loadModel = (url: string, fallback: () => THREE.Group): Promise<THREE.Group> => {
      return new Promise((resolve) => {
        loader.load(
          url,
          (gltf) => resolve(gltf.scene),
          undefined,
          () => resolve(fallback())
        );
      });
    };

    let hallwayGroup: THREE.Group | null = null;
    let droidGroup: THREE.Group | null = null;

    const starCount = 1800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 1400;
      starPos[i + 1] = (Math.random() - 0.5) * 900;
      starPos[i + 2] = -Math.random() * 1600 + 40;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd6eaff, size: 1.1, transparent: true, opacity: 0.85 });
    const spaceStars = new THREE.Points(starGeo, starMat);
    spaceStars.visible = false;
    scene.add(spaceStars);

    const destroyerExterior = assets.models.destroyer.clone();
    destroyerExterior.scale.setScalar(5.5);
    destroyerExterior.position.set(0, 12, -260);
    destroyerExterior.rotation.set(0, Math.PI, 0);
    destroyerExterior.visible = false;
    scene.add(destroyerExterior);

    const spaceLight = new THREE.DirectionalLight(0xfffae8, 3.8);
    spaceLight.position.set(50, 90, 40);
    spaceLight.visible = false;
    scene.add(spaceLight);

    const tieFighters: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const tie = assets.models.tie.clone();
      tie.scale.setScalar(0.75);
      tie.visible = false;
      scene.add(tie);
      tieFighters.push(tie);
    }

    const sparkGeo = new THREE.BufferGeometry();
    const sparkCount = 4;
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkVels: THREE.Vector3[] = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = 2.8;
      sparkPos[i * 3 + 1] = 3.6;
      sparkPos[i * 3 + 2] = 0.5;
      sparkVels.push(new THREE.Vector3());
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffe066, size: 0.12 });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.visible = false;
    scene.add(sparks);

    let sparkTimer = 0;
    let baseCamPos = new THREE.Vector3(-1.0, 2.6, 4.8);

    const triggerSparks = (roofY: number) => {
      sparks.visible = true;
      const positions = sparkGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkCount; i++) {
        positions[i * 3] = 1.8 + (Math.random() - 0.5) * 0.4;
        positions[i * 3 + 1] = roofY - 0.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
        sparkVels[i].set((Math.random() - 0.5) * 1.5, -Math.random() * 4 - 2, (Math.random() - 0.5) * 1.5);
      }
      sparkGeo.attributes.position.needsUpdate = true;
    };

    let startTime = 0;
    let didExplode = false;
    let sceneSwitched = false;
    let didHyperspace = false;
    let hasCurtainedOff = false;
    let floorY = 0;
    let ceilingY = 3.8;

    Promise.all([
      loadModel('/models/hallway.glb', createProceduralCorridor),
      loadModel('/models/r5j2.glb', createProceduralDroid)
    ]).then(([hallway, droid]) => {
      if (isDisposed) return;

      hallwayGroup = hallway;
      scene.add(hallwayGroup);

      const bbox = new THREE.Box3().setFromObject(hallwayGroup);
      floorY = bbox.min.y;
      ceilingY = bbox.max.y;
      const hHeight = Math.max(2.5, ceilingY - floorY);
      const camY = floorY + hHeight * 0.58;

      baseCamPos.set(-1.2, camY, Math.min(6.5, Math.max(3.8, bbox.max.z * 0.65)));
      camera.position.copy(baseCamPos);
      camera.lookAt(bbox.max.x * 0.35 || 4.5, camY - 0.25, 0);

      droidGroup = droid;
      droidGroup.scale.setScalar(1.0);
      droidGroup.position.set(bbox.max.x * 0.75 || 7.5, floorY, 0.4);
      droidGroup.rotation.set(0, -Math.PI / 2, 0);
      scene.add(droidGroup);

      setCurtainVisible(false);
      startTime = performance.now();
      requestAnimationFrame(renderLoop);
    });

    const renderLoop = (timestamp: number) => {
      if (isDisposed) return;

      const elapsed = (timestamp - startTime) / 1000;
      let shake = 0;

      if (elapsed < 6.0) {
        if (droidGroup) {
          droidGroup.position.x -= 1.15 * 0.016;

          const dist = Math.abs(droidGroup.position.x - camera.position.x);
          if (droidGainNode) {
            const vol = THREE.MathUtils.clamp(1 - dist / 9, 0.04, 0.35);
            droidGainNode.gain.value = vol;
          }
        }

        sparkTimer += 0.016;
        if (sparkTimer >= 2.4) {
          sparkTimer = 0;
          triggerSparks(ceilingY);
        }

        if (sparks.visible) {
          const positions = sparkGeo.attributes.position.array as Float32Array;
          let anyAlive = false;
          for (let i = 0; i < sparkCount; i++) {
            positions[i * 3] += sparkVels[i].x * 0.016;
            positions[i * 3 + 1] += sparkVels[i].y * 0.016;
            positions[i * 3 + 2] += sparkVels[i].z * 0.016;
            if (positions[i * 3 + 1] > floorY + 0.05) anyAlive = true;
          }
          sparkGeo.attributes.position.needsUpdate = true;
          if (!anyAlive) sparks.visible = false;
        }

        if (elapsed >= 1.0 && !didExplode) {
          didExplode = true;
          playMuffledExplosion();
        }

        if (elapsed >= 1.0 && elapsed <= 1.45) {
          shake = (1.45 - elapsed) * 0.22;
        }

        camera.position.set(
          baseCamPos.x + (Math.random() - 0.5) * shake,
          baseCamPos.y + (Math.random() - 0.5) * shake,
          baseCamPos.z + (Math.random() - 0.5) * shake
        );
      } else {
        if (!sceneSwitched) {
          sceneSwitched = true;
          if (droidAudioSource) {
            droidAudioSource.stop();
            droidAudioSource = null;
          }

          if (hallwayGroup) hallwayGroup.visible = false;
          if (droidGroup) droidGroup.visible = false;
          sparks.visible = false;
          hallwayLight.visible = false;
          redEmergency.visible = false;
          hallwayAmbient.visible = false;

          renderer.setClearColor(0x000103);
          spaceStars.visible = true;
          destroyerExterior.visible = true;
          spaceLight.visible = true;

          camera.position.set(0, 16, 90);
          camera.rotation.set(-0.05, 0, 0);

          tieFighters[0].position.set(-30, 20, -110);
          tieFighters[1].position.set(38, 10, -140);
          tieFighters[2].position.set(-10, -12, -95);
          for (const tie of tieFighters) {
            tie.rotation.set(0, Math.PI, 0);
          }
        }

        const exteriorElapsed = elapsed - 6.0;

        if (exteriorElapsed >= 1.6 && !didHyperspace) {
          const jumpTime = exteriorElapsed - 1.6;
          destroyerExterior.position.z -= jumpTime * jumpTime * 450;
          const shrink = Math.max(0.0001, 5.5 - jumpTime * 14);
          destroyerExterior.scale.set(shrink, shrink, shrink * (1 + jumpTime * 4));

          if (shrink <= 0.001) {
            didHyperspace = true;
            destroyerExterior.visible = false;
            for (const tie of tieFighters) {
              tie.visible = true;
            }
          }
        }

        if (didHyperspace) {
          tieFighters[0].position.z += 26 * 0.016;
          tieFighters[0].position.x += 8 * 0.016;
          tieFighters[0].rotation.z = -0.2;

          tieFighters[1].position.z += 22 * 0.016;
          tieFighters[1].position.x -= 6 * 0.016;
          tieFighters[1].rotation.z = 0.15;

          tieFighters[2].position.z += 30 * 0.016;
          tieFighters[2].rotation.z = 0.05;
        }

        if (elapsed >= 10.6 && !hasCurtainedOff) {
          hasCurtainedOff = true;
          setCurtainVisible(true);
        }

        if (elapsed >= 11.4) {
          onCompleteRef.current();
          return;
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      if (droidAudioSource) {
        droidAudioSource.stop();
      }
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [assets]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000', zIndex: 60 }}>
      <style>{`
        .hallway-curtain {
          position: absolute;
          inset: 0;
          background-color: #000000;
          pointer-events: none;
          transition: opacity 0.45s ease-in-out;
          z-index: 70;
        }
        .curtain-black {
          opacity: 1;
        }
        .curtain-clear {
          opacity: 0;
        }
        .letterbox-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 14%;
          background-color: #000000;
          z-index: 65;
          pointer-events: none;
        }
        .letterbox-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 14%;
          background-color: #000000;
          z-index: 65;
          pointer-events: none;
        }
      `}</style>

      <div className="letterbox-top" />
      <div className="letterbox-bottom" />
      <div className={`hallway-curtain ${curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
