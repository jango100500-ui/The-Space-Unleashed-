export default function MainMenu() {
  return (
    <div className="mm-container">
      <style>{`
        .mm-container {
          position: absolute;
          inset: 0;
          background-color: #03060c;
          background-image: 
            radial-gradient(1px 1px at 30px 40px, #fff, transparent),
            radial-gradient(1.5px 1.5px at 160px 120px, #ddd, transparent),
            radial-gradient(1px 1px at 280px 240px, #aaa, transparent),
            radial-gradient(2px 2px at 450px 80px, #fff, transparent),
            radial-gradient(1.5px 1.5px at 620px 290px, #eee, transparent),
            radial-gradient(1px 1px at 780px 170px, #fff, transparent);
          background-size: 550px 550px;
          background-repeat: repeat;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 28px;
          overflow: hidden;
        }
        .mm-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 35%, #000000 95%);
          pointer-events: none;
        }
        .mm-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .mm-logo {
          max-width: 420px;
          max-height: 150px;
          width: 45vw;
          object-fit: contain;
          filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.9));
        }
        .mm-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: min(320px, 70vw);
        }
        .mm-btn {
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(180deg, #2b3a4a 0%, #17212b 55%, #0d1319 100%);
          border: 1px solid #4a637d;
          border-top: 2px solid #7c9bbd;
          border-bottom: 2px solid #080d12;
          clip-path: polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%);
          color: #dce7f3;
          font-family: 'Trebuchet MS', Arial, sans-serif;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 3px;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.75);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .mm-btn:hover {
          filter: brightness(1.15);
        }
        .mm-btn:active {
          transform: translateY(1px);
        }
        .mm-btn span {
          text-shadow: 0 2px 4px #000000;
        }
      `}</style>

      <div className="mm-vignette" />

      <div className="mm-content">
        <img src="/mocs/tsu.png" alt="TSU" className="mm-logo" />

        <div className="mm-buttons">
          <button className="mm-btn" type="button">
            <span>НАЧАТЬ</span>
          </button>
          <button className="mm-btn" type="button">
            <span>АНГАР</span>
          </button>
          <button className="mm-btn" type="button">
            <span>НАСТРОЙКИ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
