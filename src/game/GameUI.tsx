import React from 'react';
import type { PreloadedAssets } from '../App.tsx';
import type { GeneratorScreenTarget } from './GameData.ts';

interface GameUIProps {
  assets: PreloadedAssets;
  mountRef: React.RefObject<HTMLDivElement>;
  curtainVisible: boolean;
  hp: number;
  maxShield: number;
  shieldHp: number;
  healBonus: number;
  score: number;
  enemiesKilled: number;
  damageDealt: number;
  stagesCompleted: number;
  creditsEarned: number;
  endGameModal: 'defeat' | 'victory' | null;
  joystickActive: boolean;
  joystickOffset: { x: number; y: number };
  ability1Cooldown: number;
  ability2Cooldown: number;
  ability3Cooldown?: number;
  hasAbility3?: boolean;
  inBiomeTransition: boolean;
  biomeTitle: string;
  biomeSubtext: string;
  isPaused: boolean;
  isConsoleOpen: boolean;
  consoleInput: string;
  consoleFeedback: string;
  currentStage: number;
  stageProgressPercent: number;
  bossActive: boolean;
  bossShieldsDown: boolean;
  bossBarMode: 'shield' | 'hull' | 'raid';
  bossBarPercent: number;
  bossCutsceneActive: boolean;
  playerStunned: boolean;
  comboStreak: number;
  isRageActive: boolean;
  crosshairScreenPos: { x: number; y: number };
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
  onRestartGame: () => void;
  onQuit: () => void;
  onConsoleInputChange: (val: string) => void;
  onApplyCheat: () => void;
  onFirePointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onFirePointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onFirePointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onTriggerAbility1: () => void;
  onTriggerAbility2: () => void;
  onTriggerAbility3?: () => void;
}

export default function GameUI(props: GameUIProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <style>{`
        .game-curtain { position: absolute; inset: 0; background-color: #000000; pointer-events: none; transition: opacity 0.4s ease-in-out; z-index: 80; }
        .curtain-black { opacity: 1; }
        .curtain-clear { opacity: 0; }
        .tfu-hud { position: absolute; inset: 0; pointer-events: none; z-index: 10; transition: opacity 0.4s ease; }
        .tfu-hud.hidden-hud { opacity: 0; }
        .tfu-hp-container { position: absolute; top: 14px; left: 18px; display: flex; flex-direction: column; gap: 4px; }
        .tfu-hp-label { font-family: Arial, sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #ff4757; text-shadow: 0 1px 3px #000; }
        .tfu-shield-label { font-family: Arial, sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #00e5ff; text-shadow: 0 1px 3px #000; margin-top: 2px; }
        .tfu-hp-frame { width: min(220px, 30vw); height: 13px; background-color: rgba(58, 5, 8, 0.75); border: 1px solid #ff4757; box-shadow: 0 0 0 1px #000; padding: 1px; clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%); position: relative; }
        .tfu-shield-frame { width: min(220px, 30vw); height: 9px; background-color: rgba(5, 30, 48, 0.75); border: 1px solid #00e5ff; box-shadow: 0 0 0 1px #000; padding: 1px; clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%); position: relative; }
        .tfu-hp-fill { height: 100%; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%); clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%); transition: width 0.15s ease-out; }
        .tfu-shield-fill { height: 100%; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #0284c7 0%, #00e5ff 50%, #0369a1 100%); clip-path: polygon(4px 0%, calc(100% - 4px) 0%, 100% 100%, 0% 100%); transition: width 0.15s ease-out; }
        .tfu-hp-heal-sector { position: absolute; top: 1px; bottom: 1px; background: #ff2a3a; opacity: 0.9; transition: all 0.2s ease-out; }
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
        .tfu-boss-hp-frame.raid { background-color: rgba(255, 255, 255, 0.15); border-color: #ffffff; }
        .tfu-boss-hp-fill { height: 100%; clip-path: polygon(6px 0%, calc(100% - 6px) 0%, 100% 100%, 0% 100%); transition: width 0.15s ease-out; }
        .tfu-boss-hp-fill.shield { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #0984e3 0%, #00d2d3 45%, #0652dd 55%, #002366 100%); }
        .tfu-boss-hp-fill.hull { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #f39c12 0%, #f1c40f 45%, #d68910 55%, #7d6608 100%); }
        .tfu-boss-hp-fill.raid { background: #ffffff; }
        .tfu-boss-raid-subtext { font-family: Arial, sans-serif; font-size: 9px; font-weight: 900; letter-spacing: 2px; color: #ff4757; text-shadow: 0 1px 3px #000; text-transform: uppercase; margin-top: 2px; animation: blinkRaidText 0.5s infinite alternate; }
        @keyframes blinkRaidText { from { opacity: 0.65; } to { opacity: 1; } }
        .tfu-top-right-group { position: absolute; top: 12px; right: 18px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; pointer-events: auto; }
        .tfu-pause-btn { background: linear-gradient(180deg, #3d586e 0%, #15202b 100%); border: 1px solid #6e8fa8; color: #8faec4; padding: 4px 22px; clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%); display: flex; align-items: center; justify-content: center; cursor: pointer; height: 28px; }
        .tfu-pause-btn:active { filter: brightness(1.2); }
        .tfu-pause-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .tfu-score-display { font-family: monospace; font-size: 12px; font-weight: 900; letter-spacing: 2px; color: #8faec4; background: linear-gradient(180deg, #3d586e 0%, #15202b 100%); border: 1px solid #6e8fa8; border-radius: 0px; padding: 4px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
        .tfu-joystick-zone { position: absolute; left: 25px; bottom: 20px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(255, 255, 255, 0.22); display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none; transition: background 0.15s, border-color 0.15s; }
        .tfu-joystick-zone.active { background: rgba(255, 255, 255, 0.14); border-color: rgba(255, 255, 255, 0.45); }
        .tfu-joystick-knob { width: 46px; height: 46px; border-radius: 50%; background: rgba(255, 255, 255, 0.28); border: 2px solid rgba(255, 255, 255, 0.5); pointer-events: none; }
        .tfu-cluster-zone { position: absolute; right: 26px; bottom: 38px; width: 168px; height: 168px; pointer-events: auto; }
        .tfu-pad-btn { position: absolute; width: 54px; height: 54px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); border: 2px solid rgba(255, 255, 255, 0.35); display: flex; align-items: center; justify-content: center; cursor: pointer; touch-action: none; user-select: none; color: rgba(255, 255, 255, 0.9); }
        .tfu-pad-btn:active { background: rgba(255, 255, 255, 0.38); transform: scale(0.94); }
        .tfu-pad-btn svg { width: 26px; height: 26px; pointer-events: none; }
        .tfu-pad-top { top: 0; left: 50%; transform: translateX(-50%); }
        .tfu-pad-top:active { transform: translateX(-50%) scale(0.94); }
        .tfu-pad-left { top: 50%; left: 0; transform: translateY(-50%); }
        .tfu-pad-left:active { transform: translateY(-50%) scale(0.94); }
        .tfu-pad-right { top: 50%; right: 0; transform: translateY(-50%); }
        .tfu-pad-right:active { transform: translateY(-50%) scale(0.94); }
        .tfu-pad-bottom { bottom: 0; left: 50%; transform: translateX(-50%); }
        .tfu-pad-bottom:active { transform: translateX(-50%) scale(0.94); }
        .tfu-pad-timer-text { font-family: monospace; font-size: 16px; font-weight: 900; color: #ffffff; }
        
        /* Плашки комбо (синяя) и буйства (жёлтая): без свечения и без масштабирования */
        .hud-target-overlay {
          position: absolute;
          transform: translate(-50%, -100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          pointer-events: none;
          z-index: 25;
        }
        .hud-combo-label {
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #64b5f6;
          text-shadow: 0 1px 3px #000000;
          animation: fadeBlinkAnim 0.32s infinite alternate ease-in-out;
        }
        .hud-rage-label {
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #f1c40f;
          text-transform: uppercase;
          text-shadow: 0 1px 3px #000000;
          animation: fadeBlinkAnim 0.35s infinite alternate ease-in-out;
        }
        @keyframes fadeBlinkAnim {
          from { opacity: 0.35; }
          to { opacity: 1; }
        }

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
        .biome-text { font-family: Arial, sans-serif; font-size: clamp(20px, 4vw, 30px); font-weight: 800; letter-spacing: 6px; color: #ffffff; text-transform: uppercase; text-align: center; }
        .biome-subtext { font-family: Arial, sans-serif; font-size: clamp(10px, 2vw, 13px); font-weight: bold; letter-spacing: 4px; color: #ff6b81; text-transform: uppercase; text-align: center; }
        .no-signal-indicator { position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%); font-family: monospace; font-size: 16px; font-weight: 900; letter-spacing: 3px; color: #ff3838; pointer-events: none; z-index: 15; animation: blinkSignal 0.25s infinite alternate; }
        @keyframes blinkSignal { from { opacity: 0.3; } to { opacity: 1; } }
        .pause-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 46; pointer-events: auto; }
        .pause-title { font-family: Arial, sans-serif; font-size: clamp(22px, 4.5vw, 32px); font-weight: 900; letter-spacing: 5px; color: #ffffff; text-transform: uppercase; text-align: center; }
        .pause-menu-list { display: flex; flex-direction: column; gap: 9px; width: min(340px, 75vw); }
        .pause-button { width: 100%; height: 38px; border-radius: 0px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: Arial, sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
        .pause-btn-primary { border: 2px solid #e2e8f0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #d31820 0%, #ff3b30 45%, #b50e17 55%, #66050b 100%); color: #ffffff; }
        .pause-btn-secondary { border: 2px solid #b2c2d4; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px), linear-gradient(180deg, #e4edf7 0%, #bdcfdf 45%, #768a9f 50%, #44566b 52%, #8ba0b7 100%); color: #0b141e; }
        .console-window { background: #0d151f; border: 2px solid #5a738e; border-top: 2px solid #8fa9c4; border-radius: 0px; padding: 20px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(380px, 80vw); }
        .console-title { font-family: Arial, sans-serif; font-size: 18px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase; text-align: center; }
        .console-desc { font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 1px; color: #8faec4; text-align: center; }
        .console-input { width: 100%; background: #060b10; border: 1px solid #3d586e; border-radius: 0px; color: #ffffff; padding: 9px 12px; font-family: monospace; font-size: 13px; letter-spacing: 2px; text-align: center; outline: none; }
        .console-feedback { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; letter-spacing: 1.5px; color: #ff4757; min-height: 14px; text-align: center; }
        .end-game-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; pointer-events: auto; background: rgba(0, 0, 0, 0.7); }
        .end-modal-box { background: #0b141e; border: 2px solid #5a738e; border-top: 2px solid #8fa9c4; border-radius: 0px; padding: 24px 30px; width: min(380px, 85vw); display: flex; flex-direction: column; gap: 16px; box-shadow: 0 15px 40px rgba(0, 0, 0, 0.95); }
        .end-modal-title { font-family: Arial, sans-serif; font-size: 24px; font-weight: 900; letter-spacing: 4px; color: #ffffff; text-transform: uppercase; text-align: center; border-bottom: 1px solid #233446; padding-bottom: 8px; }
        .end-stats-rows { display: flex; flex-direction: column; gap: 8px; }
        .end-stat-line { display: flex; justify-content: space-between; font-family: Arial, sans-serif; font-size: 12px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #ffffff; }
        .end-stat-val { color: #ffffff; font-family: monospace; font-size: 14px; }
        .end-actions-row { display: flex; gap: 10px; margin-top: 6px; }
      `}</style>

      <div className={`game-curtain ${props.curtainVisible ? 'curtain-black' : 'curtain-clear'}`} />

      {props.bossActive && !props.bossShieldsDown && !props.bossCutsceneActive &&
        props.generatorTargets.map((gt) => (
          <div key={gt.id} className="generator-reticle" style={{ left: `${gt.x}px`, top: `${gt.y}px` }} />
        ))}

      {/* Индикаторы над прицелом */}
      {!props.inBiomeTransition && !props.isPaused && !props.isConsoleOpen && !props.bossCutsceneActive && !props.playerStunned && !props.endGameModal && (
        <div
          className="hud-target-overlay"
          style={{
            left: `${props.crosshairScreenPos.x}px`,
            top: `${props.crosshairScreenPos.y - 18}px`
          }}
        >
          {props.isRageActive && (
            <div className="hud-rage-label">БУЙСТВО</div>
          )}
          {props.comboStreak >= 3 && (
            <div className="hud-combo-label">
              КОМБО Х{props.comboStreak}
            </div>
          )}
        </div>
      )}

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

      {props.playerStunned && <div className="no-signal-indicator">НЕТ СИГНАЛА</div>}

      {props.endGameModal && (
        <div className="end-game-overlay">
          <div className="end-modal-box">
            <div className="end-modal-title">
              {props.endGameModal === 'defeat' ? 'ПОРАЖЕНИЕ' : 'ПОБЕДА'}
            </div>
            <div className="end-stats-rows">
              <div className="end-stat-line">
                <span>СБИТО ВРАГОВ:</span>
                <span className="end-stat-val">{props.enemiesKilled}</span>
              </div>
              <div className="end-stat-line">
                <span>НАНЕСЕНО УРОНА:</span>
                <span className="end-stat-val">{props.damageDealt}</span>
              </div>
              <div className="end-stat-line">
                <span>СЧЕТ:</span>
                <span className="end-stat-val">{props.score}</span>
              </div>
              <div className="end-stat-line">
                <span>ПРОЙДЕНО ЭТАПОВ:</span>
                <span className="end-stat-val">{props.stagesCompleted}</span>
              </div>
              <div className="end-stat-line" style={{ borderTop: '1px solid #233446', paddingTop: '6px' }}>
                <span>ЗАРАБОТАНО КРЕДИТОВ:</span>
                <span className="end-stat-val">+{props.creditsEarned}</span>
              </div>
            </div>
            <div className="end-actions-row">
              <button type="button" className="pause-button pause-btn-primary" onClick={props.onRestartGame}>ЕЩЕ РАЗ</button>
              <button type="button" className="pause-button pause-btn-secondary" onClick={props.onQuit}>В МЕНЮ</button>
            </div>
          </div>
        </div>
      )}

      {props.isPaused && !props.isConsoleOpen && !props.endGameModal && (
        <div className="pause-overlay">
          <div className="pause-title">ИГРА НА ПАУЗЕ</div>
          <div className="pause-menu-list">
            <button type="button" className="pause-button pause-btn-primary" onClick={props.onResume}>ПРОДОЛЖИТЬ</button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={props.onOpenConsole}>КОНСОЛЬ</button>
            <button type="button" className="pause-button pause-btn-secondary" onClick={props.onQuit}>ВЫЙТИ</button>
          </div>
        </div>
      )}

      {props.isPaused && props.isConsoleOpen && !props.endGameModal && (
        <div className="pause-overlay">
          <div className="console-window">
            <div className="console-title">КОНСОЛЬ</div>
            <div className="console-desc">Введи читкод...</div>
            <input
              type="text"
              className="console-input"
              value={props.consoleInput}
              onChange={(e) => props.onConsoleInputChange(e.target.value)}
              placeholder="Введи читкод..."
            />
            <div className="console-feedback">{props.consoleFeedback}</div>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button type="button" className="pause-button pause-btn-primary" onClick={props.onApplyCheat}>ВВОД</button>
              <button type="button" className="pause-button pause-btn-secondary" onClick={props.onCloseConsole}>НАЗАД</button>
            </div>
          </div>
        </div>
      )}

      <div className={`tfu-hud ${props.inBiomeTransition || props.isPaused || props.isConsoleOpen || props.bossCutsceneActive || props.endGameModal ? 'hidden-hud' : ''}`}>
        <div className="tfu-hp-container">
          <div className="tfu-hp-label">СОСТОЯНИЕ</div>
          <div className="tfu-hp-frame">
            <div className="tfu-hp-fill" style={{ width: `${props.hp}%` }} />
            {props.healBonus > 0 && (
              <div className="tfu-hp-heal-sector" style={{ left: `${Math.max(0, props.hp - props.healBonus)}%`, width: `${props.healBonus}%` }} />
            )}
          </div>
          {props.maxShield > 0 && (
            <>
              <div className="tfu-shield-label">ЭНЕРГОЩИТЫ</div>
              <div className="tfu-shield-frame">
                <div className="tfu-shield-fill" style={{ width: `${(props.shieldHp / props.maxShield) * 100}%` }} />
              </div>
            </>
          )}
        </div>

        {props.bossActive ? (
          <div className="tfu-boss-hp-container">
            <div className={`tfu-boss-hp-label ${props.bossBarMode}`}>
              {props.bossBarMode === 'shield' ? 'ЭНЕРГОЩИТЫ' : props.bossBarMode === 'raid' ? 'НАЛЕТ' : 'ЗВЕЗДНЫЙ РАЗРУШИТЕЛЬ'}
            </div>
            <div className={`tfu-boss-hp-frame ${props.bossBarMode}`}>
              <div className={`tfu-boss-hp-fill ${props.bossBarMode}`} style={{ width: `${props.bossBarPercent}%` }} />
            </div>
            {props.bossBarMode === 'raid' && (
              <div className="tfu-boss-raid-subtext">УНИЧТОЖЬТЕ ВСЕХ ВРАГОВ</div>
            )}
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

        <div className="tfu-top-right-group">
          <button type="button" className="tfu-pause-btn" onClick={props.onTogglePause}>
            <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          </button>
          <div className="tfu-score-display">СЧЕТ: {String(props.score).padStart(6, '0')}</div>
        </div>

        <div
          className={`tfu-joystick-zone ${props.joystickActive ? 'active' : ''}`}
          onPointerDown={props.onStickPointerDown}
          onPointerMove={props.onStickMove}
          onPointerUp={props.onStickPointerUp}
          onPointerCancel={props.onStickPointerUp}
        >
          <div className="tfu-joystick-knob" style={{ transform: `translate(${props.joystickOffset.x}px, ${props.joystickOffset.y}px)` }} />
        </div>

        <div className="tfu-cluster-zone">
          <button
            type="button"
            className="tfu-pad-btn tfu-pad-top"
            onPointerDown={(e) => { e.stopPropagation(); props.onTriggerAbility1(); }}
          >
            {props.ability1Cooldown > 0 ? (
              <span className="tfu-pad-timer-text">{props.ability1Cooldown}</span>
            ) : (
              <svg viewBox="0 0 24 24"><polygon points="12,5 20,19 4,19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
            )}
          </button>

          <button
            type="button"
            className="tfu-pad-btn tfu-pad-left"
            onPointerDown={(e) => { e.stopPropagation(); if (props.onTriggerAbility3) props.onTriggerAbility3(); }}
          >
            {props.ability3Cooldown && props.ability3Cooldown > 0 ? (
              <span className="tfu-pad-timer-text">{props.ability3Cooldown}</span>
            ) : (
              <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
            )}
          </button>

          <button
            type="button"
            className="tfu-pad-btn tfu-pad-right"
            onPointerDown={(e) => { e.stopPropagation(); props.onTriggerAbility2(); }}
          >
            {props.ability2Cooldown > 0 ? (
              <span className="tfu-pad-timer-text">{props.ability2Cooldown}</span>
            ) : (
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
            )}
          </button>

          <button
            type="button"
            className="tfu-pad-btn tfu-pad-bottom"
            onPointerDown={props.onFirePointerDown}
            onPointerUp={props.onFirePointerUp}
            onPointerCancel={props.onFirePointerCancel}
          >
            <svg viewBox="0 0 24 24"><path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      <div ref={props.mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
