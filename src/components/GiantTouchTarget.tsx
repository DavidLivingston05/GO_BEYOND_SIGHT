import React from 'react';
import { Eye, Volume2, Sparkles, Camera } from 'lucide-react';

interface GiantTouchTargetProps {
  onUnlock: () => void;
  isUnlocked: boolean;
  isLoadingModels: boolean;
}

export const GiantTouchTarget: React.FC<GiantTouchTargetProps> = ({
  onUnlock,
  isUnlocked,
  isLoadingModels,
}) => {
  if (isUnlocked) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Tap anywhere on screen to activate Beyond Sight, unlock 3D binaural radar, camera autofocus, and voice navigation."
      onClick={onUnlock}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onUnlock();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-8 bg-black/75 backdrop-blur-md text-white cursor-pointer select-none transition-all active:scale-[0.99] focus:outline-none focus:ring-8 focus:ring-yellow-400"
    >
      {/* Top Branding Bar */}
      <div className="w-full flex items-center justify-between border-b border-yellow-400/30 pb-3 max-w-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-yellow-400/20 border-2 border-yellow-400 flex items-center justify-center text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-yellow-400">BEYOND SIGHT</h1>
            <p className="text-[11px] uppercase tracking-widest text-cyan-400 font-bold">Blind Mobility & Camera Radar</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/40 text-yellow-300 text-xs font-mono font-bold">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>DAILY MOBILITY</span>
        </div>
      </div>

      {/* Center Giant Tactile Activation Target */}
      <div className="flex flex-col items-center justify-center text-center my-auto max-w-md space-y-6 pointer-events-none">
        <div className="relative">
          {/* Pulsing ring aura */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-yellow-400/30 via-cyan-400/30 to-emerald-400/30 blur-2xl animate-pulse" />

          <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-b from-yellow-400 to-amber-500 text-black flex flex-col items-center justify-center shadow-[0_0_60px_rgba(250,204,21,0.6)] border-4 border-yellow-200">
            <Camera className="w-12 h-12 sm:w-14 sm:h-14 mb-1 animate-bounce" />
            <span className="text-lg sm:text-xl font-black uppercase tracking-wider">TAP SCREEN</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-black/80">TO START CAMERA</span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Tap Anywhere To Begin
          </h2>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
            Touch anywhere on the display to activate the live camera viewfinder, spatial audio radar, and voice navigation.
          </p>
          {isLoadingModels ? (
            <p className="text-xs text-cyan-300 font-mono animate-pulse">
              Loading local zero-carbon AI models on-device...
            </p>
          ) : (
            <p className="text-xs text-emerald-400 font-mono">
              ✓ Local AI Vision Engine Ready
            </p>
          )}
        </div>
      </div>

      {/* Bottom Wake-Word & Gesture Hint */}
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/40">
            <Volume2 className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-xs sm:text-sm font-bold text-white">Always-On Voice & Camera Tracking</p>
            <p className="text-[11px] text-slate-400">
              Say <strong className="text-yellow-400">&quot;Hey Vision&quot;</strong> or hold screen to speak
            </p>
          </div>
        </div>
        <span className="text-xs font-black bg-yellow-400 text-black px-4 py-2 rounded-xl uppercase tracking-wider shadow">
          Tap to Open Viewfinder
        </span>
      </div>
    </div>
  );
};
