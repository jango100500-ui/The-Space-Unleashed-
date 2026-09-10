import { useEffect, useRef, useState } from 'react';

export default function MainMenu() {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const menuItems = ['НАЧАТЬ', 'АНГАР', 'НАСТРОЙКИ'];

  useEffect(() => {
    const initAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const response = await fetch('/sounds/click.mp3');
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = decodedBuffer;
      } catch {
        return;
      }
    };

    initAudio();
  }, []);

  const playClickSound = () => {
    if (isMuted || !audioBufferRef.current || !audioCtxRef.current) return;

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioCtxRef.current.destination);
    source.start(0);
  };

  const handleItemClick = (index: number) => {
    playClickSound();
    setSelectedIndex(index);
  };

  const toggleSound = () => {
    setIsMuted(!isMuted);
    if (isMuted) {
      setTimeout(() => playClickSound(), 0);
    }
  };

  return (
    <div className="tfu-menu-container">
      <style>{`
        .tfu-menu-container {
          position: absolute;
          inset: 0;
          background-color: #030408;
          background-image: 
            radial-gradient(ellipse at 50% 32%, rgba(65, 30, 95, 0.45) 0%, transparent 60%),
            radial-gradient(1.5px 1.5px at 15% 20%, #ffffff, transparent),
            radial-gradient(1px 1px at 35% 65%, #ddddff, transparent),
            radial-gradient(2px 2px at 70% 25%, #ffffff, transparent),
            radial-gradient(1.5px 1.5px at 85% 75%, #ffffff, transparent),
            radial-gradient(1px 1px at 50% 85%, #aaaaff, transparent),
            radial-gradient(1px 1px at 90% 15%, #ffffff, transparent);
          background-size: 100% 100%, 350px 350px, 450px 450px, 400px 400px, 500px 500px, 300px 300px, 600px 600px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px 24px;
          overflow: hidden;
        }
        .tfu-top-triggers {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
          z-index: 5;
        }
        .tfu-trigger {
          background: linear-gradient(180deg, #3d586e 0%, #15202b 100%);
          border: 1px solid #6e8fa8;
          color: #8faec4;
          padding: 4px 22px;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          height: 28px;
        }
        .tfu-trigger:active {
          filter: brightness(1.2);
        }
        .tfu-trigger svg {
          width: 15px;
          height: 15px;
          fill: currentColor;
        }
        .tfu-center-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-top: -15px;
        }
        .tfu-logo-wrapper {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .tfu-logo-glow {
          position: absolute;
          width: 130%;
          height: 140%;
          background: radial-gradient(circle, rgba(70, 160, 255, 0.65) 0%, rgba(30, 80, 220, 0.4) 40%, transparent 70%);
          filter: blur(14px);
          pointer-events: none;
        }
        .tfu-logo {
          position: relative;
          max-width: 460px;
          max-height: 145px;
          width: 48vw;
          object-fit: contain;
          filter: drop-shadow(0 0 16px rgba(100, 180, 255, 0.7));
        }
        .tfu-menu-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: min(640px, 86vw);
        }
        .tfu-bar-button {
          width: 100%;
          height: 38px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          transition: transform 0.05s ease;
          position: relative;
        }
        .tfu-bar-button:active {
          transform: scale(0.99);
        }
        .tfu-bar-selected {
          border: 2px solid #e2e8f0;
          box-shadow: 0 0 0 1px #200000, 0 4px 10px rgba(0, 0, 0, 0.9);
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          color: #ffffff;
          text-shadow: 0 1px 3px #000000;
        }
        .tfu-bar-unselected {
          border: 2px solid #b2c2d4;
          box-shadow: 0 0 0 1px #111a24, 0 3px 8px rgba(0, 0, 0, 0.75);
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%);
          color: #0b141e;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
        }
      `}</style>

      <div className="tfu-top-triggers">
        <button type="button" className="tfu-trigger">
          <svg viewBox="0 0 24 24">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>

        <button type="button" className="tfu-trigger" onClick={toggleSound}>
          {isMuted ? (
            <svg viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      </div>

      <div className="tfu-center-block">
        <div className="tfu-logo-wrapper">
          <div className="tfu-logo-glow" />
          <img src="/mocs/tsu.png" alt="Logo" className="tfu-logo" />
        </div>

        <div className="tfu-menu-list">
          {menuItems.map((item, index) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={item}
                type="button"
                className={`tfu-bar-button ${isSelected ? 'tfu-bar-selected' : 'tfu-bar-unselected'}`}
                onClick={() => handleItemClick(index)}
              >
                <span>{item}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: '10px' }} />
    </div>
  );
}
