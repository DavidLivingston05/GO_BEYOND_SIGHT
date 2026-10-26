import React from 'react';
import {
  Footprints,
  Coffee,
  Armchair,
  DoorOpen,
  Smartphone,
  FileText,
  Compass,
  Car,
  Home,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { NavigationMode } from '../types';

export interface DailyItemFinderBarProps {
  activeTarget: string | null;
  onSelectTarget: (target: string | null) => void;
  onCheckPath: () => void;
  onReadText: () => void;
  navigationMode?: NavigationMode;
  onToggleNavigationMode?: () => void;
  isRoadMode?: boolean;
  onToggleRoadMode?: () => void;
  onCheckCompass: () => void;
  isRadarMuted: boolean;
  onToggleRadar: () => void;
}

export const DailyItemFinderBar: React.FC<DailyItemFinderBarProps> = ({
  activeTarget,
  onSelectTarget,
  onCheckPath,
  onReadText,
  navigationMode = 'home',
  onToggleNavigationMode,
  isRoadMode = false,
  onToggleRoadMode,
  onCheckCompass,
  isRadarMuted,
  onToggleRadar,
}) => {
  const isRoad = navigationMode === 'road' || isRoadMode;
  const toggleMode = onToggleNavigationMode || onToggleRoadMode;

  const dailyItems = [
    { id: 'door', label: 'Door / Exit', icon: DoorOpen, targetClass: 'door' },
    { id: 'bottle', label: 'Bottle / Cup', icon: Coffee, targetClass: 'bottle' },
    { id: 'chair', label: 'Chair / Seat', icon: Armchair, targetClass: 'chair' },
    { id: 'phone', label: 'Phone', icon: Smartphone, targetClass: 'cell phone' },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Daily quick navigation, compass and road safety bar"
      className="w-full bg-[#0a0a0e]/95 border-t border-slate-800/90 backdrop-blur-xl px-2.5 py-2.5 sm:px-4 sm:py-3 max-w-4xl mx-auto rounded-2xl shadow-2xl flex flex-col space-y-2"
    >
      {/* Top Row: Daily Find & Safety Buttons */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
        {/* 1. Walk / Path Check button (Primary Daily Action) */}
        <button
          type="button"
          onClick={onCheckPath}
          aria-label="Check walking path ahead and step count"
          className="flex-1 min-w-[70px] max-w-[125px] py-2.5 px-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold flex flex-col items-center justify-center space-y-1 text-center transition-all active:scale-95 shadow-md focus:ring-4 focus:ring-yellow-400"
        >
          <Footprints className="w-5 h-5 shrink-0" />
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider truncate w-full">
            Check Path
          </span>
        </button>

        {/* 2. Environment Mode (Home Standard vs Road Outdoor) */}
        <button
          type="button"
          onClick={toggleMode}
          aria-label={isRoad ? 'Switch to Standard Home Mode' : 'Switch to Road Safety Sentinel Mode'}
          aria-pressed={isRoad}
          className={`flex-1 min-w-[70px] max-w-[125px] py-2.5 px-1 rounded-xl flex flex-col items-center justify-center space-y-1 text-center transition-all active:scale-95 border ${
            isRoad
              ? 'bg-red-600 text-white font-black shadow-[0_0_15px_rgba(239,68,68,0.6)] border-red-300 animate-pulse'
              : 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
          }`}
        >
          {isRoad ? (
            <Car className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white" />
          ) : (
            <Home className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-emerald-400" />
          )}
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
            {isRoad ? 'Road Mode' : 'Home (Std)'}
          </span>
        </button>

        {/* 3. Door & Daily Item Finders */}
        {dailyItems.map((item) => {
          const isSelected = activeTarget === item.targetClass;
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (isSelected) {
                  onSelectTarget(null);
                } else {
                  onSelectTarget(item.targetClass);
                }
              }}
              aria-label={`Find ${item.label} with direction beacon`}
              aria-pressed={isSelected}
              className={`flex-1 min-w-[65px] max-w-[115px] py-2.5 px-1 rounded-xl flex flex-col items-center justify-center space-y-1 text-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                isSelected
                  ? 'bg-emerald-500 text-black font-black shadow-[0_0_15px_rgba(16,185,129,0.5)] border-2 border-emerald-300'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800'
              }`}
            >
              <IconComp className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isSelected ? 'text-black' : 'text-cyan-400'}`} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
                {isSelected ? 'Finding...' : item.label.split('/')[0]}
              </span>
            </button>
          );
        })}

        {/* 4. Compass Direction Button */}
        <button
          type="button"
          onClick={onCheckCompass}
          aria-label="Speak compass heading and direction you are facing"
          className="flex-1 min-w-[60px] max-w-[105px] py-2.5 px-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-yellow-300 border border-yellow-500/30 flex flex-col items-center justify-center space-y-1 text-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 shrink-0" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
            Compass
          </span>
        </button>

        {/* 5. Read Text / OCR button */}
        <button
          type="button"
          onClick={onReadText}
          aria-label="Read text or sign in front of camera"
          className="flex-1 min-w-[60px] max-w-[105px] py-2.5 px-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-purple-300 border border-purple-500/30 flex flex-col items-center justify-center space-y-1 text-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
            Read Text
          </span>
        </button>

        {/* 6. Quick Spatial Radar Mute/Unmute */}
        <button
          type="button"
          onClick={onToggleRadar}
          aria-label={isRadarMuted ? 'Unmute 3D audio spatial radar' : 'Mute 3D audio spatial radar'}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border transition-all active:scale-95 shrink-0 ${
            isRadarMuted
              ? 'bg-red-500/20 text-red-400 border-red-500/40'
              : 'bg-slate-900 text-cyan-400 border-slate-800'
          }`}
          title="3D Audio Sonar"
        >
          {isRadarMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Active Target Banner if searching */}
      {activeTarget && (
        <div className="flex items-center justify-between bg-emerald-950/80 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-mono animate-pulse">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>DIRECTION BEACON: <strong>{activeTarget.toUpperCase()}</strong> (Acoustic homing active)</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectTarget(null)}
            className="text-[11px] bg-emerald-800/80 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-bold uppercase"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
