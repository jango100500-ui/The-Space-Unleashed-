import { useState } from 'react';
import * as THREE from 'three';
import LoadingScreen from './components/LoadingScreen.tsx';
import MainMenu from './components/MainMenu.tsx';
import IntroCutscene from './cutscenes/IntroCutscene.tsx';
import GameScreen from './game/GameScreen.tsx';

export interface PreloadedModels {
  xwing: THREE.Group;
  tie: THREE.Group;
  destroyer: THREE.Group;
}

export interface PreloadedAssets {
  models: PreloadedModels;
  audioBuffers: Record<string, AudioBuffer>;
  audioCtx: AudioContext;
}

export default function App() {
  const [stage, setStage] = useState<'loading' | 'menu' | 'cutscene' | 'game'>('loading');
  const [assets, setAssets] = useState<PreloadedAssets | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoadingComplete = (loaded: PreloadedAssets) => {
    setAssets(loaded);
    setStage('menu');
  };

  const handleStartRequested = () => {
    if (!assets) {
      setErrorMessage('Ресурсы игры ещё не загружены');
      return;
    }
    setStage('cutscene');
  };

  const handleCutsceneError = (err: string) => {
    setErrorMessage(err);
    setStage('menu');
  };

  const handleCutsceneComplete = () => {
    setStage('game');
  };

  const handleGameOver = () => {
    setStage('menu');
  };

  return (
    <div className="game-wrapper">
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.88);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-box {
          background: #111a24;
          border: 2px solid #5a738e;
          border-top: 2px solid #8fa9c4;
          clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
          padding: 24px 32px;
          max-width: 480px;
          width: 85vw;
          text-align: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.9);
        }
        .modal-title {
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #ff4757;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .modal-text {
          font-family: Arial, sans-serif;
          font-size: 13px;
          color: #c8d6e5;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .modal-btn {
          background: linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          border: 1px solid #ff6b81;
          color: #ffffff;
          padding: 10px 24px;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          cursor: pointer;
          clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
        }
      `}</style>

      {stage === 'loading' && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}

      {stage === 'menu' && (
        <MainMenu onStart={handleStartRequested} />
      )}

      {stage === 'cutscene' && assets && (
        <IntroCutscene
          assets={assets}
          onComplete={handleCutsceneComplete}
          onError={handleCutsceneError}
        />
      )}

      {stage === 'game' && assets && (
        <GameScreen
          assets={assets}
          onExit={handleGameOver}
        />
      )}

      {errorMessage && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Ошибка</div>
            <div className="modal-text">{errorMessage}</div>
            <button
              type="button"
              className="modal-btn"
              onClick={() => setErrorMessage(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
