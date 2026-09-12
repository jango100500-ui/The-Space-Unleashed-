import { useState } from 'react';
import * as THREE from 'three';
import LoadingScreen from './components/LoadingScreen.tsx';
import MainMenu from './components/MainMenu.tsx';
import HangarScreen from './components/HangarScreen.tsx';
import IntroCutscene from './cutscenes/IntroCutscene.tsx';
import VictoryCutscene from './cutscenes/VictoryCutscene.tsx';
import GameScreen from './game/GameScreen.tsx';

export interface PreloadedModels {
  xwing: THREE.Group;
  tie: THREE.Group;
  tie2: THREE.Group;
  destroyer: THREE.Group;
  datapad?: THREE.Group;
  cr90?: THREE.Group;
  pilot?: THREE.Group;
}

export interface PreloadedAssets {
  models: PreloadedModels;
  audioBuffers: Record<string, AudioBuffer>;
  audioCtx: AudioContext;
}

export default function App() {
  const [stage, setStage] = useState<'loading' | 'menu' | 'hangar' | 'cutscene' | 'victory_cutscene' | 'game'>('loading');
  const [assets, setAssets] = useState<PreloadedAssets | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number>(0);
  const [credits, setCredits] = useState<number>(0);
  const [selectedShipId, setSelectedShipId] = useState<string>('xwing');

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

  const handleOpenHangar = () => {
    setStage('hangar');
  };

  const handleBackFromHangar = () => {
    setStage('menu');
  };

  const handleSelectShip = (id: string) => {
    setSelectedShipId(id);
  };

  const handleCutsceneError = (err: string) => {
    setErrorMessage(err);
    setStage('menu');
  };

  const handleCutsceneComplete = () => {
    setGameSessionId((prev) => prev + 1);
    setStage('game');
  };

  const handleGameOver = () => {
    setGameSessionId((prev) => prev + 1);
    setStage('menu');
  };

  const handleRestart = () => {
    setGameSessionId((prev) => prev + 1);
    setStage('cutscene');
  };

  const handleTriggerIntroCutscene = () => {
    setStage('cutscene');
  };

  const handleTriggerVictoryCutscene = () => {
    setStage('victory_cutscene');
  };

  const handleVictoryCutsceneComplete = () => {
    setGameSessionId((prev) => prev + 1);
    setStage('menu');
  };

  const handleAddCredits = (amount: number) => {
    setCredits((prev) => prev + amount);
  };

  return (
    <div className="game-wrapper">
      <div className="portrait-rotate-warning">
        <div className="portrait-rotate-icon" />
        <div className="portrait-rotate-text">Переверните устройство</div>
      </div>

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
          border-radius: 0px;
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
          color: #ffffff;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 12px;
        }
        .modal-text {
          font-family: Arial, sans-serif;
          font-size: 13px;
          color: #ffffff;
          line-height: 1.5;
          margin-bottom: 20px;
          text-align: center;
        }
        .modal-btn {
          background: linear-gradient(180deg, #3d586e 0%, #15202b 100%);
          border: 1px solid #6e8fa8;
          color: #ffffff;
          padding: 10px 24px;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 0px;
        }
        .menu-slider {
          position: absolute;
          inset: 0;
          display: flex;
          width: 200vw;
          height: 100vh;
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .menu-slider.slide-hangar {
          transform: translateX(-100vw);
        }
        .menu-slide-pane {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }
      `}</style>

      {stage === 'loading' && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}

      {(stage === 'menu' || stage === 'hangar') && (
        <div className={`menu-slider ${stage === 'hangar' ? 'slide-hangar' : ''}`}>
          <div className="menu-slide-pane">
            <MainMenu
              onStart={handleStartRequested}
              onOpenHangar={handleOpenHangar}
            />
          </div>
          <div className="menu-slide-pane">
            {assets && (
              <HangarScreen
                assets={assets}
                selectedShipId={selectedShipId}
                credits={credits}
                onSelectShip={handleSelectShip}
                onAddCredits={handleAddCredits}
                onBack={handleBackFromHangar}
              />
            )}
          </div>
        </div>
      )}

      {stage === 'cutscene' && assets && (
        <IntroCutscene
          assets={assets}
          selectedShipId={selectedShipId}
          onComplete={handleCutsceneComplete}
          onError={handleCutsceneError}
        />
      )}

      {stage === 'victory_cutscene' && assets && (
        <VictoryCutscene
          assets={assets}
          selectedShipId={selectedShipId}
          onComplete={handleVictoryCutsceneComplete}
        />
      )}

      {stage === 'game' && assets && (
        <GameScreen
          key={gameSessionId}
          assets={assets}
          selectedShipId={selectedShipId}
          onAddCredits={handleAddCredits}
          onRestart={handleRestart}
          onTriggerIntroCutscene={handleTriggerIntroCutscene}
          onTriggerVictoryCutscene={handleTriggerVictoryCutscene}
          onExit={handleGameOver}
        />
      )}

      {errorMessage && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">ОШИБКА</div>
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
