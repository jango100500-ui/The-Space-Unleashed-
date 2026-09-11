import React from 'react';
import HallwayCutscene from '../cutscenes/HallwayCutscene.tsx';
import type { PreloadedAssets } from '../App.tsx';
import type { GeneratorScreenTarget } from './GameData.ts';

interface GameUIProps {
  assets: PreloadedAssets;
  mountRef: React.RefObject<HTMLDivElement>;
  curtainVisible: boolean;
  hp: number;
  healBonus: number;
  joystickActive: boolean;
  joystickOffset: { x: number; y: number };
  inBiomeTransition: boolean;
  biomeTitle: string;
  biomeSubtext: string;
  isPaused: boolean;
  isConsoleOpen: boolean;
  consoleInput: string;
  consoleFeedback: string;
  showHallwayCutscene: boolean;
  currentStage: number;
  stageProgressPercent: number;
  bossActive: boolean;
  bossShieldsDown: boolean;
  bossBarMode: 'shield' | 'hull' | 'raid';
  bossBarPercent: number;
  bossCutsceneActive: boolean;
  bossVictoryActive: boolean;
  showVictoryText: boolean;
  playerStunned: boolean;
  zoneAttackUi: { visible: boolean; leftPct: number; widthPct: number };
  tractorBeamUi: { visible: boolean; leftPct: number; widthPct: number };
  generatorTargets: GeneratorScreenTarget[];
  onStickPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onStickMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onStickPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTogglePause: () => void;
  onResume: () => void;
  onOpenConsole: () => void;
  onCloseConsole: () => void;
  onQuit: () => void;
  onConsoleInputChange: (val: string) => void;
  onApplyCheat: () => void;
  onFirePointerDown: () => void;
  onFirePointerUp: () => void;
  onFirePointerCancel: () => void;
  onHallwayComplete: () => void;
}

export default function GameUI(props: GameUIProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <style>{`
        .game-curtain { position: absolute; inset: 0; background-color: #000000; pointer-events: none; transition: opacity 0.5s ease-in-out; z-index: 50; }
        .curtain-black { opacity: 1; }
        .curtain-clear { opacity: 0; }
        .tfu-hud { position: absolute; inset: 0; pointer-events: none; z-index: 10; transition: opacity 0.4s ease; }
        .tfu-hud.hidden-hud { opacity: 0; }
        .tfu-hp-container { position: absolute; top: 14px; left: 18px; display: flex; flex-direction: column; gap: 3px; }
        .tfu-hp-label { font-family: Arial, sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #ff4757; text-shadow: 0 1px 3px #000; }
        .tfu-hp-frame { width: min(220px, 30vw); height: 13px; background-color: rgba(58, 5, 8, 0.75); border: 1px solid #ff4757; box-shadow: 0 0 0 1px #000; padding: 1px; clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%); position: relative; }
        .tfu-hp-fill { height: 100%; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%); clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%); transition: width 0.15s ease-out; }
        .tfu-hp-heal-sector { position: absolute; top: 1px; bottom: 1px; background: #4cd137; opacity: 0.85; transition: all 0.2s ease-out; }
        .tfu-progress-tracker { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; }
        .tracker-node { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #5a738e; background: #09131d; transition: all 0.2s; }
        .tracker-node.active { border-color: #64b5f6; background: #2196f3; }
        .tracker-line { width: 22px; height: 2px; background: #233446; position: relative; overflow: hidden; }
        .tracker-line-fill { height: 100%; background: #64b5f6; transition: width 0.12s linear; }
        .tracker-boss { width: 12px; height: 12px; transform: rotate(45deg); border: 1.5px solid #ff4757; background: #200508; transition: all 0.2s; }
        .tracker-boss.active { border-color: #ff3838; background: #ff3838; }
        .tfu-boss-hp-container { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .tfu-boss-hp-label { font-family: Arial, sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-shadow: 0 1px 3px #000; }
        .tfu-boss-hp-label.shield { color: #00d2d3; }
        .tfu-boss-hp-label.hull { color: #f1c40f; }
        .tfu-boss-hp-label.raid { color: #ffffff; }
        .tfu-boss-hp-frame { width: min(260px, 40vw); height: 13px; border-width: 1px; border-style: solid; box-shadow: 0 0 0 1px #000; padding: 1px; clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%); position: relative; }
        .tfu-boss-hp-frame.shield { background-color: rgba(5, 45, 60, 0.75); border-color: #00d2d3; }
        .tfu-boss-hp-frame.hull { background-color: rgba(60, 50, 5, 0.75); border-color: #f1c40f; }
        .tfu-boss-hp-frame.raid { background-color: rgba(40, 40, 45, 0.75); border-color: #ffffff; }
        .tfu-boss-hp-fill { height: 100%; clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%); transition: width 0.15s ease-out; }
        .tfu-boss-hp-fill.shield { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #0984e3 0%, #00d2d3 45%, #0652dd 55%, #002366 100%); }
        .tfu-boss-hp-fill.hull { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #f39c12 0%, #f1c40f 45%, #d68910 55%, #7d6608 100%); }
        .tfu-boss-hp-fill.raid { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #ffffff 0%, #e0e0e0 45%, #b0b0b0 55%, #707070 100%); }
        .tfu-pause-btn { position: absolute; top: 12px; right: 18px; background: linear-gradient(180deg, #3d586e 0%, #15202b 100%); border: 1px solid #6e8fa8; color: #8faec4; padding: 4px 22px; clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%); display: flex; align-items: center; justify-content: center; cursor: pointer; height: 28px; pointer-events: auto; }
        .tfu-pause-btn:active { filter: brightness(1.2); }
        .tfu-pause-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .tfu-joystick-zone { position: absolute; left: 25px; bottom: 20px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(20, 35, 55, 0.4) 0%, rgba(5, 12, 20, 0.2) 70%, transparent 100%); border: 2px solid rgba(120, 160, 200, 0.35); display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none; opacity: 0.35; transition: opacity 0.2s ease; }
        .tfu-joystick-zone.active { opacity: 0.95; border-color: rgba(120, 180, 255, 0.8); }
        .tfu-joystick-knob { width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(180deg, #415b76 0%, #1a2735 100%); border: 2px solid #8faec4; pointer-events: none; }
        .tfu-fire-btn { position: absolute; right: 30px; bottom: 25px; width: 72px; height: 72px; border-radius: 50%; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%); border: 2px solid #ff6b81; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer; touch-action: none; }
        .tfu-fire-btn:active { transform: scale(0.94); filter: brightness(1.2); }
        .tfu-fire-btn svg { width: 32px; height: 32px; fill: #ffffff; }
        .zone-attack-indicator { position: absolute; top: 0; bottom: 0; background: rgba(255, 30, 30, 0.2); border-left: 2px dashed rgba(255, 80, 80, 0.65); border-right: 2px dashed rgba(255, 80, 80, 0.65); pointer-events: none; z-index: 8; animation: zoneBlink 0.22s infinite alternate; }
        .tractor-beam-indicator { position: absolute; top: 0; bottom: 0; background: rgba(255, 10, 10, 0.28); border-left: 3px solid rgba(255, 60, 60, 0.85); border-right: 3px solid rgba(255, 60, 60, 0.85); pointer-events: none; z-index: 8; animation: tractorBlink 0.18s infinite alternate; }
        @keyframes zoneBlink { from { opacity: 0.15; } to { opacity: 0.55; } }
        @keyframes tractorBlink { from { opacity: 0.2; } to { opacity: 0.7; } }
        .generator-reticle { position: absolute; width: 22px; height: 22px; border: 2px solid #ff3838; transform: translate(-50%, -50%); pointer-events: none; z-index: 12; }
        .generator-reticle::before { content: ''; position: absolute; inset: 3px; border: 1px dashed rgba(255, 80, 80, 0.7); }
        .letterbox-bar { position: absolute; left: 0; right: 0; background-color: #000000; z-index: 40; transition: height 0.45s ease-out; pointer-events: none; }
        .letterbox-top { top: 0; height: 0; }
        .letterbox-bottom { bottom: 0; height: 0; }
        .letterbox-active.letterbox-top, .letterbox-active.letterbox-bottom { height: 18%; }
        .biome-banner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; pointer-events: none; z-index: 45; opacity: 0; transition: opacity 0.5s ease-in-out; }
        .biome-banner.show-banner { opacity: 1; }
        .biome-text { font-family: Arial, sans-serif; font-size: clamp(20px, 4vw, 30px); font-weight: 800; letter-spacing: 6px; color: #ffffff; text-transform: uppercase; }
        .biome-subtext { font-family: Arial, sans-serif; font-size: clamp(10px, 2vw, 13px); font-weight: bold; letter-spacing: 4px; color: #ff6b81; text-transform: uppercase; }
        .victory-text { font-family: Arial, sans-serif; font-size: clamp(28px, 6vw, 46px); font-weight: 900; letter-spacing: 8px; color: #ffffff; text-transform: uppercase; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 55; pointer-events: none; }
        .no-signal-indicator { position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%); font-family: monospace; font-size: 16px; font-weight: 900; letter-spacing: 3px; color: #ff3838; pointer-events: none; z-index: 15; animation: blinkSignal 0.25s infinite alternate; }
        @keyframes blinkSignal { from { opacity: 0.3; } to { opacity: 1; } }
        .pause-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 46; pointer-events: auto; }
        .pause-title { font-family: Arial, sans-serif; font-size: clamp(22px, 4.5vw, 32px); font-weight: 900; letter-spacing: 5px; color: #ffffff; text-transform: uppercase; }
        .pause-menu-list { display: flex; flex-direction: column; gap: 9px; width: min(340px, 75vw); }
        .pause-button { width: 100%; height: 38px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: Arial, sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
        .pause-btn-primary { border: 2px solid #e2e8f0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%); color: #ffffff; }
        .pause-btn-secondary { border: 2px solid #b2c2d4; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%); color: #0b141e; }
        .console-window { background: #0d151f; border: 2px solid #5a738e; border-top: 2px solid #8fa9c4; clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%); padding: 20px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(380px, 80vw); }
        .console-title { font-family: Arial, sans-serif; font-size: 18px; font-weight: 900; letter-spacing: 3px; color: #64b5f6; text-transform: uppercase; }
        .console-desc { font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 1px; color: #8faec4; text-align: center; }
        .console-input { width: 100%; background: #060b10; border: 1px solid #3d586e; color: #ffffff; padding: 9px 12px; font-family: monospace; font-size: 13px; letter-spacing: 2px; text-align: center; outline: none; }
        .console-feedback { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; letter-spacing: 1.5px; color: #ff4757; min-height: 14px; }
      `}</style>

      <div className={`game-curtain ${props.curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />

      {props.bossActive && !props.bossShieldsDown && !props.bossCutsceneActive &&
        props.generatorTargets.map((gt) => (
          <div key={gt.id} className="generator-reticle" style={{ left: `${gt.x}px`, top: `${gt.y}px` }} />
        ))}

      {props.zoneAttackUi.visible && (
        <div className="zone-attack-indicator" style={{ left: `${props.zoneAttackUi.leftPct}%`, width: `${props.zoneAttackUi.widthPct}%` }} />
      )}

      {props.tractorBeamUi.visible && (
        <div className="tractor-beam-indicator" style={{ left: `${props.tractorBeamUi.leftPct}%`, width: `${props.tractorBeamUi.widthPct}%` }} />
      )}

      <div className={`letterbox-bar letterbox-top ${props.inBiomeTransition || props.isPaused || props.isConsoleOpen || props.bossCutsceneActive ? 'letterbox-active' : ''}`} />
      <div className={`letterbox-bar letterbox-bottom ${props.inBiomeTransition || props.isPaused || props.isConsoleOpen || props.bossCutsceneActive ? 'letterbox-active' : ''}`} />

      <div className={`biome-banner ${props.inBiomeTransition && !props.isPaused && !props.isConsoleOpen ? 'show-banner' : ''}`}>
        <div className="biome-text">{props.biomeTitle}</div>
        {props.biomeSubtext && <div className="biome-subtext">{props.biomeSubtext}</div>}
      </div>

      <div className={`biome-banner ${props.bossCutsceneActive ? 'show-banner' : ''}`}>
        <div className="biome-text">ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ</div>
        <div className="biome-subtext">ВЫХОДИТ ИЗ ГИПЕРПРОСТРАНСТВА</div>
      </div>

      {props.showVictoryText && (
        <div className="victory-text">ПОБЕДА!</div>
      )}

      {props.showHallwayCutscene && (
        <HallwayCutscene assets={props.assets} onComplete={props.onHallwayComplete} />
      )}

      {props.playerStunned && <div className="no-signal-indicator">НЕТ СИГНАЛА</div>}

      {props.isPaused && !props.isConsoleOpen && (
        <div className="pause-overlay">
          <div className="pause-title">ИГРА НА ПАУЗЕ</div>
          <div className="pause-menu-list">
            <button type="button" className="pause-button pause-btn-primary" onClick={props.onResume}>ПРОДОЛЖИТЬ</button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={props.onOpenConsole}>КОНСОЛЬ</button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={props.onQuit}>ВЫЙТИ</button>
          </div>
        </div>
      )}

      {props.isPaused && props.isConsoleOpen && (
        <div className="pause-overlay">
          <div className="console-window">
            <div className="console-title">КОНСОЛЬ</div>
            <div className="console-desc">Введи читкод для консоли</div>
            <input
              type="text"
              className="console-input"
              value={props.consoleInput}
              onChange={(e) => props.onConsoleInputChange(e.target.value)}
              placeholder="КОД..."
            />
            <div className="console-feedback">{props.consoleFeedback}</div>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button type="button" className="pause-button pause-btn-primary" onClick={props.onApplyCheat}>ВВОД</button>
              <button type="button" className="pause-button pause-btn-secondary" onClick={props.onCloseConsole}>НАЗАД</button>
            </div>
          </div>
        </div>
      )}

      <div className={`tfu-hud ${props.inBiomeTransition || props.isPaused || props.isConsoleOpen || props.bossCutsceneActive ? 'hidden-hud' : ''}`}>
        <div className="tfu-hp-container">
          <div className="tfu-hp-label">HULL INTEGRITY</div>
          <div className="tfu-hp-frame">
            <div className="tfu-hp-fill" style={{ width: `${props.hp}%` }} />
            {props.healBonus > 0 && (
              <div className="tfu-hp-heal-sector" style={{ left: `${Math.max(0, props.hp - props.healBonus)}%`, width: `${props.healBonus}%` }} />
            )}
          </div>
        </div>

        {props.bossActive ? (
          <div className="tfu-boss-hp-container">
            <div className={`tfu-boss-hp-label ${props.bossBarMode}`}>
              {props.bossBarMode === 'shield' ? 'ЭНЕРГОЩИТЫ' : props.bossBarMode === 'raid' ? 'НАЛЕТ' : 'ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ'}
            </div>
            <div className={`tfu-boss-hp-frame ${props.bossBarMode}`}>
              <div className={`tfu-boss-hp-fill ${props.bossBarMode}`} style={{ width: `${props.bossBarPercent}%` }} />
            </div>
          </div>
        ) : (
          <div className="tfu-progress-tracker">
            <div className={`tracker-node ${props.currentStage >= 0 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div className="tracker-line-fill" style={{ width: `${props.currentStage > 0 ? 100 : props.currentStage === 0 ? props.stageProgressPercent : 0}%` }} />
            </div>
            <div className={`tracker-node ${props.currentStage >= 1 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div className="tracker-line-fill" style={{ width: `${props.currentStage > 1 ? 100 : props.currentStage === 1 ? props.stageProgressPercent : 0}%` }} />
            </div>
            <div className={`tracker-node ${props.currentStage >= 2 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div className="tracker-line-fill" style={{ width: `${props.currentStage > 2 ? 100 : props.currentStage === 2 ? props.stageProgressPercent : 0}%` }} />
            </div>
            <div className={`tracker-node ${props.currentStage >= 3 ? 'active' : ''}`} />
            <div className="tracker-line">
              <div className="tracker-line-fill" style={{ width: `${props.currentStage > 3 ? 100 : props.currentStage === 3 ? props.stageProgressPercent : 0}%` }} />
            </div>
            <div className={`tracker-boss ${props.currentStage >= 4 ? 'active' : ''}`} />
          </div>
        )}

        <button type="button" className="tfu-pause-btn" onClick={props.onTogglePause}>
          <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
        </button>

        <div
          className={`tfu-joystick-zone ${props.joystickActive ? 'active' : ''}`}
          onPointerDown={props.onStickPointerDown}
          onPointerMove={props.onStickMove}
          onPointerUp={props.onStickPointerUp}
          onPointerCancel={props.onStickPointerUp}
        >
          <div className="tfu-joystick-knob" style={{ transform: `translate(${props.joystickOffset.x}px, ${props.joystickOffset.y}px)` }} />
        </div>

        <button
          type="button"
          className="tfu-fire-btn"
          onPointerDown={props.onFirePointerDown}
          onPointerUp={props.onFirePointerUp}
          onPointerCancel={props.onFirePointerCancel}
        >
          <svg viewBox="0 0 24 24"><path d="M12 2C9.5 2 7.5 4 7.5 6.5v9l4.5 4.5 4.5-4.5v-9C16.5 4 14.5 2 12 2zm0 3c.8 0 1.5.7 1.5 1.5v6h-3v-6c0-.8.7-1.5 1.5-1.5z" /></svg>
        </button>
      </div>
    </>
  );
}
