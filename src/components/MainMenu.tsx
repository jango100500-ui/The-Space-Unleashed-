import { useState } from 'react';

export default function MainMenu() {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const menuItems = ['НАЧАТЬ', 'АНГАР', 'НАСТРОЙКИ'];

  const playClickSound = () => {
    const audio = new Audio('/sounds/click.mp3');
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const handleItemClick = (index: number) => {
    playClickSound();
    setSelectedIndex(index);
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
          justify-content: center;
          padding: 20px;
          overflow: hidden;
        }
        .tfu-center-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
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
          max-height: 155px;
          width: 48vw;
          object-fit: contain;
          filter: drop-shadow(0 0 16px rgba(100, 180, 255, 0.7));
        }
        .tfu-menu-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: min(640px, 88vw);
        }
        .tfu-bar-button {
          width: 100%;
          height: 40px;
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
    </div>
  );
}
