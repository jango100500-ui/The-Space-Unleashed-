interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <div className="tfu-welcome-overlay">
      <style>{`
        .tfu-welcome-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.88);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .tfu-welcome-box {
          background: #0d1520;
          border: 2px solid #5a738e;
          border-top: 2px solid #8fa9c4;
          border-radius: 0px;
          width: min(520px, 92vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          padding: 24px 28px 20px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.9);
        }
        .tfu-welcome-title {
          font-family: Arial, sans-serif;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #ffffff;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 14px;
        }
        .tfu-welcome-content {
          overflow-y: auto;
          padding-right: 8px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-family: Arial, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #a4b8cc;
          text-align: left;
          max-height: 52vh;
        }
        .tfu-welcome-content::-webkit-scrollbar {
          width: 4px;
        }
        .tfu-welcome-content::-webkit-scrollbar-thumb {
          background: #3d586e;
        }
        .tfu-welcome-contacts {
          color: #64b5f6;
          font-weight: bold;
        }
        .tfu-welcome-guild {
          color: #ff9f43;
          font-weight: bold;
        }
        .tfu-welcome-actions {
          margin-top: 18px;
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .tfu-welcome-btn {
          width: min(240px, 100%);
          height: 40px;
          background: 
            repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px),
            linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%);
          border: 2px solid #e2e8f0;
          box-shadow: 0 0 0 1px #200000;
          color: #ffffff;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 0px;
        }
        .tfu-welcome-btn:active {
          transform: scale(0.98);
        }
      `}</style>

      <div className="tfu-welcome-box">
        <div className="tfu-welcome-title">ДОБРО ПОЖАЛОВАТЬ!</div>
        <div className="tfu-welcome-content">
          <p>
            Проект <strong>The Space Unleashed</strong> сейчас находится в активной разработке и закрытом тесте.
          </p>
          <p>
            Все механики кораблей, баланс лазеров и битвы с боссами непрерывно дорабатываются прямо по ходу вылетов.
          </p>
          <p>
            Если заметишь графический баг, странное поведение прицела или просадку кадров — сразу пиши разработчикам: <span className="tfu-welcome-contacts">@temkazavr</span> или <span className="tfu-welcome-contacts">@ribapibaa</span>.
          </p>
          <p>
            Огромное спасибо гильдии <span className="tfu-welcome-guild">Those Who Are In The Shadows</span> и каждому её бойцу за поддержку, тесты и дельные отзывы!
          </p>
          <p>
            Готовься к бою, пилот. Да пребудет с тобой Сила!
          </p>
        </div>
        <div className="tfu-welcome-actions">
          <button type="button" className="tfu-welcome-btn" onClick={onClose}>
            В АНГАР
          </button>
        </div>
      </div>
    </div>
  );
}
