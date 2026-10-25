import React, { useState } from 'react';
import { X, UserCheck, Camera, Sparkles } from 'lucide-react';

interface EnrollPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnroll: (name: string) => void;
  previewThumbnail: string | null;
}

export const EnrollPersonModal: React.FC<EnrollPersonModalProps> = ({
  isOpen,
  onClose,
  onEnroll,
  previewThumbnail,
}) => {
  const [personName, setPersonName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (personName.trim()) {
      onEnroll(personName.trim());
      setPersonName('');
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-[#0e1015] border-2 border-emerald-400/60 rounded-3xl p-6 text-white shadow-[0_0_60px_rgba(16,185,129,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Sparkles className="w-5 h-5" />
            <h2 id="enroll-title" className="text-lg font-black uppercase tracking-wider text-white">
              Remember Person
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {previewThumbnail ? (
            <div className="flex flex-col items-center">
              <img
                src={previewThumbnail}
                alt="Captured person preview"
                className="w-24 h-32 rounded-2xl object-cover border-2 border-emerald-400 shadow-md mb-2"
              />
              <span className="text-xs text-emerald-400 font-mono font-semibold">Visual Signature Captured</span>
            </div>
          ) : (
            <div className="w-full h-24 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-400">
              <Camera className="w-6 h-6 mb-1 text-slate-500" />
              <span className="text-xs">Ensure person is in camera view</span>
            </div>
          )}

          <div>
            <label htmlFor="person-name-input" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Person&apos;s Name:
            </label>
            <input
              id="person-name-input"
              type="text"
              required
              autoFocus
              placeholder="e.g. Dharshan, Mom, Sarah"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-black border-2 border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 text-base"
            />
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Or say out loud anytime: <strong className="text-yellow-400">&quot;Hey Vision, remember this person as [Name]&quot;</strong>.
          </p>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!personName.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-black text-sm uppercase tracking-wider hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
