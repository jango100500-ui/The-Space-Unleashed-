import { useState } from 'react';
import LoadingScreen from './components/LoadingScreen.tsx';
import MainMenu from './components/MainMenu.tsx';

export default function App() {
  const [stage, setStage] = useState<'loading' | 'menu'>('loading');

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#000000', overflow: 'hidden' }}>
      <div className="orientation-warning">
        <p>Игра поддерживает только горизонтальный формат</p>
      </div>

      <div className="game-viewport">
        {stage === 'loading' && <LoadingScreen onComplete={() => setStage('menu')} />}
        {stage === 'menu' && <MainMenu />}
      </div>
    </div>
  );
}
