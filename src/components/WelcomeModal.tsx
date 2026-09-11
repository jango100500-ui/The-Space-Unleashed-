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
          clip-path: polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%);
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
          color: #e6f2ff;
          text-transform: uppercase;
          text-align: left;
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
          border-radius: 3px;
        }
        .tfu-welcome-btn:active {
          transform: scale(0.98);
        }
      `}</style>

      <div className="tfu-welcome-box">
        <div className="tfu-welcome-title">ДОБРО ПОЖАЛОВАТЬ!</div>
        <div className="tfu-welcome-content">
          <p>
            Проект <strong>The Space Unleashed</strong> в настоящее время находится на этапе активной разработки и закрытого альфа-тестирования.
          </p>
          <p>
            Все игровые механики, визуальные эффекты, физика космических перехватов и баланс финальных поединков непрерывно дорабатываются.
          </p>
          <p>
            Если в процессе вылета вы обнаружили графическую ошибку, сбой управления или проблемы с производительностью, пожалуйста, сообщите об этом разработчикам напрямую: <span className="tfu-welcome-contacts">@temkazavr</span> или <span className="tfu-welcome-contacts">@ribapibaa</span>.
          </p>
          <p>
            Выражаем отдельную искреннюю признательность гильдии <span className="tfu-welcome-guild">Those Who Are In The Shadows</span> и каждому её участнику за активную помощь, содействие в проверке игровых систем и конструктивные отзывы.
          </p>
          <p>
            Готовьтесь к вылету, пилот. Да пребудет с вами Сила.
          </p>
        </div>
        <div className="tfu-welcome-actions">
          <button type="button" className="tfu-welcome-btn" onClick={onClose}>
            ПРОДОЛЖИТЬ
          </button>
        </div>
      </div>
    </div>
  );
}
