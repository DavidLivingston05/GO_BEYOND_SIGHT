import React from 'react';
import { X, Volume2, Mic, HelpCircle, Navigation, Users, Eye } from 'lucide-react';
import { speechManager } from '../services/speechSynthesis';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleSpeakCommands = () => {
    speechManager.speakReply(
      'Here are key voice commands you can say anytime: Hey Vision, start camera. Where is the door? Where is the chair? Who is in front of me? Remember this person as John. Describe the room. Or, stop camera.'
    );
  };

  const commandCategories = [
    {
      title: 'Wake Words & Controls',
      icon: <Mic className="w-5 h-5 text-yellow-400" />,
      items: [
        { phrase: '"Hey Vision"', desc: 'Activates the assistant chime & listener' },
        { phrase: '"Start Camera" / "Turn on camera"', desc: 'Begins 30FPS real-time spatial navigation' },
        { phrase: '"Stop Camera" / "Go to sleep"', desc: 'Stops camera and enters standby mode' },
      ],
    },
    {
      title: 'Object & Spatial Navigation',
      icon: <Navigation className="w-5 h-5 text-cyan-400" />,
      items: [
        { phrase: '"Where is the chair / table / bottle?"', desc: 'Gives exact clock direction and distance in steps' },
        { phrase: '"Where is the door / exit / stairs?"', desc: 'Identifies doorways and exits with safe walking advice' },
        { phrase: '"Is the path clear?"', desc: 'Scans immediate 1.2m danger zone for obstacles' },
      ],
    },
    {
      title: 'People & Face Memory',
      icon: <Users className="w-5 h-5 text-emerald-400" />,
      items: [
        { phrase: '"Who is in front of me?"', desc: 'Identifies recognized people by name or describes them' },
        { phrase: '"Remember this person as [Name]"', desc: 'Stores person\'s visual profile and greets them by name' },
      ],
    },
    {
      title: 'Scene Intelligence & Reading',
      icon: <Eye className="w-5 h-5 text-purple-400" />,
      items: [
        { phrase: '"Describe the room"', desc: 'Paints a warm, concise spatial summary of your surroundings' },
        { phrase: '"Read text" / "Read this"', desc: 'Reads out loud visible signs, letters, and labels' },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] bg-[#0c0d12] border-2 border-yellow-400/60 rounded-3xl p-6 text-white overflow-y-auto shadow-2xl flex flex-col space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-yellow-400">
            <HelpCircle className="w-6 h-6" />
            <h2 id="help-title" className="text-xl font-black uppercase tracking-wider text-white">
              Voice Commands Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice guide"
            className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center hover:text-white border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read Commands Out Loud Button */}
        <button
          type="button"
          onClick={handleSpeakCommands}
          className="w-full py-3 px-4 rounded-2xl bg-yellow-400/10 border-2 border-yellow-400 text-yellow-300 font-extrabold flex items-center justify-center space-x-2 hover:bg-yellow-400/20 transition-colors uppercase tracking-wider text-xs sm:text-sm"
        >
          <Volume2 className="w-5 h-5 text-yellow-400" />
          <span>Read Voice Commands Out Loud</span>
        </button>

        {/* Command list */}
        <div className="space-y-4">
          {commandCategories.map((cat, idx) => (
            <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm text-white">
                {cat.icon}
                <span>{cat.title}</span>
              </div>
              <div className="space-y-2 pt-1">
                {cat.items.map((item, i) => (
                  <div key={i} className="bg-black/60 rounded-xl p-2.5 border border-slate-800/80">
                    <p className="text-sm font-black text-yellow-300 font-mono">{item.phrase}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-yellow-400 text-black font-extrabold rounded-xl hover:bg-yellow-300 transition-colors uppercase tracking-wider text-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
