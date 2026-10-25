import React from 'react';
import { Eye, Mic, Volume2, Sparkles } from 'lucide-react';

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
      aria-label="Tap anywhere on the screen to activate Beyond Sight, unlock microphone, camera, and voice assistant permissions."
      onClick={onUnlock}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onUnlock();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-[#050505] text-white cursor-pointer select-none transition-all active:scale-[0.99] focus:outline-none focus:ring-8 focus:ring-yellow-400"
    >
      {/* Top Branding */}
      <div className="w-full flex items-center justify-between border-b border-yellow-400/30 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border-2 border-yellow-400 flex items-center justify-center text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]">
            <Eye className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider text-yellow-400">BEYOND SIGHT</h1>
            <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Vision Mate - Go Beyond</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-yellow-400/10 px-3 py-1.5 rounded-full border border-yellow-400/40 text-yellow-300 text-xs font-mono font-bold">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>VOICE ACCESSIBILITY</span>
        </div>
      </div>

      {/* Center Giant Tactile Activation Target */}
      <div className="flex flex-col items-center justify-center text-center my-auto max-w-lg space-y-8 pointer-events-none">
        <div className="relative">
          {/* Pulsing ring aura */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-yellow-400/30 via-cyan-400/30 to-emerald-400/30 blur-2xl animate-pulse" />
          
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-gradient-to-b from-yellow-400 to-amber-500 text-black flex flex-col items-center justify-center shadow-[0_0_60px_rgba(250,204,21,0.5)] border-4 border-yellow-200">
            <Mic className="w-16 h-16 sm:w-20 sm:h-20 mb-2 animate-bounce" />
            <span className="text-xl sm:text-2xl font-black uppercase tracking-wider">TAP SCREEN</span>
            <span className="text-xs font-extrabold uppercase tracking-widest text-black/80">TO START</span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tap Anywhere To Begin
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-medium">
            Touch anywhere on the display to activate the spatial radar, voice navigation, and wake-word listener.
          </p>
          {isLoadingModels && (
            <p className="text-sm text-cyan-300 font-mono animate-pulse">
              Initializing zero-latency spatial models...
            </p>
          )}
        </div>
      </div>

      {/* Bottom Wake-word Hint Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/40">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Always-On Wake-Word Ready</p>
            <p className="text-xs text-slate-400">Say <strong className="text-yellow-400 font-bold">&quot;Hey Vision&quot;</strong> or <strong className="text-yellow-400 font-bold">&quot;Beyond Sight&quot;</strong> anytime</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-yellow-400 text-black px-4 py-2 rounded-xl uppercase tracking-wider shadow">
          Single Tap Starts
        </span>
      </div>
    </div>
  );
};
