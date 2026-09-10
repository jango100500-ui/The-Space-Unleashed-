import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState<number>(0);
  const [fadeOut, setFadeOut] = useState<boolean>(false);

  useEffect(() => {
    const checkpoints = [
      { value: 16, time: 700 },
      { value: 38, time: 1600 },
      { value: 61, time: 2700 },
      { value: 82, time: 3500 },
      { value: 94, time: 4200 },
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
        .ls-logo-wrapper {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .ls-logo-base {
          max-width: 440px;
          max-height: 180px;
          width: 50vw;
          object-fit: contain;
          opacity: 0.25;
          filter: brightness(0.6);
          display: block;
        }
        .ls-logo-fill {
          position: absolute;
          inset: 0;
          max-width: 440px;
          max-height: 180px;
          width: 50vw;
          height: 100%;
          object-fit: contain;
          opacity: 1;
          filter: drop-shadow(0 0 14px rgba(100, 180, 255, 0.7));
          transition: clip-path 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
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
        <div className="ls-logo-wrapper">
          <img src="/mocs/tsu.png" alt="TSU Background" className="ls-logo-base" />
          <img
            src="/mocs/tsu.png"
            alt="TSU Fill"
            className="ls-logo-fill"
            style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
          />
        </div>
      </div>

      <div className="ls-bar-frame">
        <div className="ls-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
