import React from 'react';
import { Mic, Volume2, Sparkles } from 'lucide-react';
import type { AssistantState } from '../types';

interface VoiceOrbProps {
  state: AssistantState;
  transcript: string;
  isListening: boolean;
  onOrbClick: () => void;
  statusMessage?: string;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  transcript,
  isListening,
  onOrbClick,
  statusMessage,
}) => {
  // Determine state labels and theme colors
  let stateTitle = 'Wake-Word Ready ("Hey Vision")';
  let stateSubtitle = 'Always listening for your command';
  let orbClass = '';
  let orbGradient = 'from-yellow-400 to-amber-600';
  let badgeColor = 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30';
  let icon = <Mic className="w-8 h-8 text-black" />;

  if (state === 'speaking') {
    stateTitle = 'Speaking Guidance';
    stateSubtitle = 'Describing your path and surroundings';
    orbClass = 'orb-speaking';
    orbGradient = 'from-emerald-400 via-teal-400 to-emerald-600';
    badgeColor = 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40';
    icon = <Volume2 className="w-8 h-8 text-black animate-pulse" />;
  } else if (state === 'thinking') {
    stateTitle = 'Analyzing Scene...';
    stateSubtitle = 'Processing spatial intelligence';
    orbClass = 'orb-thinking';
    orbGradient = 'from-purple-500 via-pink-500 to-indigo-600';
    badgeColor = 'bg-purple-400/20 text-purple-300 border-purple-400/40';
    icon = <Sparkles className="w-8 h-8 text-white animate-spin" />;
  } else if (state === 'listening' || isListening) {
    stateTitle = 'Listening to You...';
    stateSubtitle = 'Say "Where is the door?", "Who is this?", "Describe room"';
    orbClass = 'orb-listening';
    orbGradient = 'from-cyan-300 via-sky-400 to-blue-600';
    badgeColor = 'bg-cyan-400/20 text-cyan-300 border-cyan-400/40';
    icon = <Mic className="w-8 h-8 text-black" />;
  }

  return (
    <div className="relative flex flex-col items-center justify-center w-full px-4 py-2 pointer-events-auto">
      {/* Subtitles & Transcripts Banner */}
      {(transcript || statusMessage) && (
        <div
          aria-live="polite"
          className="mb-3 max-w-xl w-full bg-black/85 backdrop-blur-md border border-cyan-400/30 rounded-2xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-center space-x-3 text-left transition-all animate-fadeIn"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 animate-ping" />
          <div className="flex-1 overflow-hidden">
            {transcript && (
              <p className="text-sm sm:text-base font-semibold text-white tracking-wide truncate">
                &ldquo;{transcript}&rdquo;
              </p>
            )}
            {statusMessage && !transcript && (
              <p className="text-xs sm:text-sm text-cyan-200 font-medium truncate">
                {statusMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Interactive Pulsing Orb Container */}
      <div className="flex flex-col items-center">
        {/* State Pill */}
        <div
          className={`flex items-center space-x-2 px-3.5 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider mb-3 transition-colors ${badgeColor}`}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <span>{stateTitle}</span>
        </div>

        {/* Gemini-Style Pulsing Orb */}
        <button
          type="button"
          onClick={onOrbClick}
          aria-label={`${stateTitle}. Click to speak or trigger voice command.`}
          className="relative group cursor-pointer focus:outline-none focus:ring-4 focus:ring-yellow-400 rounded-full transition-transform active:scale-95"
        >
          {/* Subtle outer glow ambient layer */}
          <div
            className={`absolute -inset-4 rounded-full bg-gradient-to-tr ${orbGradient} opacity-60 blur-xl transition-all duration-500`}
          />

          {/* Central Sphere */}
          <div
            className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr ${orbGradient} flex items-center justify-center shadow-2xl border-2 border-white/60 ${orbClass}`}
          >
            {icon}
          </div>
        </button>

        {/* Orb subtitle note */}
        <p className="mt-2 text-xs text-slate-400 text-center font-medium max-w-xs">
          {stateSubtitle}
        </p>
      </div>
    </div>
  );
};
