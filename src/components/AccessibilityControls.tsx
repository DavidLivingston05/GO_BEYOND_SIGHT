import React from 'react';
import { Camera, CameraOff, Mic, UserPlus, Settings, Volume2, VolumeX, HelpCircle, Sparkles } from 'lucide-react';

interface AccessibilityControlsProps {
  isCameraActive: boolean;
  onToggleCamera: () => void;
  isRadarMuted: boolean;
  onToggleRadar: () => void;
  onOpenPersonEnrollment: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onPushToTalk: () => void;
  isListening: boolean;
  onDescribeScene: () => void;
}

export const AccessibilityControls: React.FC<AccessibilityControlsProps> = ({
  isCameraActive,
  onToggleCamera,
  isRadarMuted,
  onToggleRadar,
  onOpenPersonEnrollment,
  onOpenSettings,
  onOpenHelp,
  onPushToTalk,
  isListening,
  onDescribeScene,
}) => {
  return (
    <nav
      aria-label="Assistive navigation controls"
      className="w-full bg-[#0a0a0c]/95 border-t border-slate-800/80 backdrop-blur-lg px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2 max-w-4xl mx-auto rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)]"
    >
      {/* 1. Camera Toggle Button */}
      <button
        type="button"
        onClick={onToggleCamera}
        aria-label={isCameraActive ? 'Turn off camera stream' : 'Turn on camera stream'}
        className={`flex-1 min-w-[70px] max-w-[120px] py-3 px-2 rounded-2xl flex flex-col items-center justify-center space-y-1 text-center transition-all focus:outline-none focus:ring-4 focus:ring-yellow-400 active:scale-95 ${
          isCameraActive
            ? 'bg-slate-800 text-yellow-400 border border-yellow-400/40'
            : 'bg-yellow-400 text-black font-extrabold shadow-lg'
        }`}
      >
        {isCameraActive ? <Camera className="w-5 h-5 sm:w-6 sm:h-6" /> : <CameraOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
          {isCameraActive ? 'Camera On' : 'Start Cam'}
        </span>
      </button>

      {/* 2. Push-To-Talk Mic Button */}
      <button
        type="button"
        onClick={onPushToTalk}
        aria-label="Tap to speak or give a voice command"
        className={`flex-1 min-w-[75px] max-w-[130px] py-3 px-2 rounded-2xl flex flex-col items-center justify-center space-y-1 text-center transition-all focus:outline-none focus:ring-4 focus:ring-cyan-400 active:scale-95 ${
          isListening
            ? 'bg-cyan-400 text-black font-black animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.6)]'
            : 'bg-slate-800 text-cyan-400 border border-cyan-400/30'
        }`}
      >
        <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
          {isListening ? 'Listening' : 'Ask Vision'}
        </span>
      </button>

      {/* 3. Instant Describe Scene AI Button */}
      <button
        type="button"
        onClick={onDescribeScene}
        aria-label="Describe entire room using AI Vision"
        className="flex-1 min-w-[70px] max-w-[120px] py-3 px-2 rounded-2xl bg-slate-800 text-emerald-400 border border-emerald-400/30 flex flex-col items-center justify-center space-y-1 text-center transition-all focus:outline-none focus:ring-4 focus:ring-emerald-400 active:scale-95 hover:bg-slate-700"
      >
        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
          Describe
        </span>
      </button>

      {/* 4. Save Person / Face Memory Button */}
      <button
        type="button"
        onClick={onOpenPersonEnrollment}
        aria-label="Remember this person in front of you"
        className="flex-1 min-w-[65px] max-w-[110px] py-3 px-2 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 flex flex-col items-center justify-center space-y-1 text-center transition-all focus:outline-none focus:ring-4 focus:ring-yellow-400 active:scale-95 hover:bg-slate-700"
      >
        <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate w-full">
          Save Person
        </span>
      </button>

      {/* 5. Spatial Radar Sound Toggle */}
      <button
        type="button"
        onClick={onToggleRadar}
        aria-label={isRadarMuted ? 'Unmute 3D audio spatial radar' : 'Mute 3D audio spatial radar'}
        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border transition-all focus:outline-none focus:ring-4 focus:ring-yellow-400 active:scale-95 shrink-0 ${
          isRadarMuted
            ? 'bg-slate-900 border-slate-700 text-slate-500'
            : 'bg-slate-800 border-cyan-400/40 text-cyan-300'
        }`}
      >
        {isRadarMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* 6. Settings Modal Button */}
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Open settings and Gemini API key configuration"
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition-all focus:outline-none focus:ring-4 focus:ring-yellow-400 active:scale-95 hover:bg-slate-700 shrink-0"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* 7. Help & Commands Button */}
      <button
        type="button"
        onClick={onOpenHelp}
        aria-label="Open voice command guide and shortcuts"
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-800 border border-slate-700 text-yellow-400 flex items-center justify-center transition-all focus:outline-none focus:ring-4 focus:ring-yellow-400 active:scale-95 hover:bg-slate-700 shrink-0"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </nav>
  );
};
