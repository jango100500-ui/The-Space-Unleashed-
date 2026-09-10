import { useState } from 'react';
import LoadingScreen from './components/LoadingScreen.tsx';
import MainMenu from './components/MainMenu.tsx';

export default function App() {
  const [stage, setStage] = useState<'loading' | 'menu'>('loading');

  return (
    <div className="game-wrapper">
      {stage === 'loading' && <LoadingScreen onComplete={() => setStage('menu')} />}
      {stage === 'menu' && <MainMenu />}
    </div>
  );
}
