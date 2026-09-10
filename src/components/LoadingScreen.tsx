import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState<number>(0);
  const [fadeOut, setFadeOut] = useState<boolean>(false);

  useEffect(() => {
    const checkpoints = [
      { value: 14, time: 700 },
      { value: 31, time: 1600 },
      { value: 58, time: 2700 },
      { value: 79, time: 3500 },
      { value: 92, time: 4200 },
      { value: 100, time: 4600 },
    ];

    const timeouts = checkpoints.map(cp =>
      setTimeout(() => setProgress(cp.value), cp.time)
    );

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 4800);

    const finishTimer = setTimeout(() => {
      onComplete();
    }, 5400);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
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
          padding: 40px 0;
          opacity: 1;
          transition: opacity 0.6s ease-in-out;
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
        .ls-logo {
          max-width: 440px;
          max-height: 180px;
          width: 50vw;
          object-fit: contain;
        }
        .ls-bar-frame {
          width: min(420px, 50vw);
          height: 12px;
          background-color: #000000;
          border: 1px solid #2a2a2a;
          padding: 2px;
          clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%);
        }
        .ls-bar-fill {
          height: 100%;
          background-color: #ffffff;
          clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%);
        }
      `}</style>

      <div className="ls-logo-box">
        <img src="/tsu.png" alt="TSU" className="ls-logo" />
      </div>

      <div className="ls-bar-frame">
        <div className="ls-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
