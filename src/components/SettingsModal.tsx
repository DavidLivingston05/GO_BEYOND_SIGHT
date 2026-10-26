import React, { useState } from 'react';
import { X, Key, Cpu, Volume2, Users, Trash2, Check, Sparkles, ShieldCheck, Home } from 'lucide-react';
import { geminiVisionService } from '../services/geminiVision';
import { speechManager } from '../services/speechSynthesis';
import { personMemoryService } from '../services/personMemory';
import type { PersonProfile, VisionSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VisionSettings;
  onUpdateSettings: (newSettings: Partial<VisionSettings>) => void;
}

const SettingsModalContent: React.FC<{
  onClose: () => void;
  settings: VisionSettings;
  onUpdateSettings: (newSettings: Partial<VisionSettings>) => void;
}> = ({ onClose, settings, onUpdateSettings }) => {
  const [apiKey, setApiKey] = useState(() => geminiVisionService.getApiKey());
  const [model, setModel] = useState(() => geminiVisionService.getModel());
  const [savedKeyFeedback, setSavedKeyFeedback] = useState(false);
  const [availableVoices] = useState<SpeechSynthesisVoice[]>(() => speechManager.getVoices());
  const [profiles, setProfiles] = useState<PersonProfile[]>(() => personMemoryService.getAllProfiles());

  const handleSaveApiKey = () => {
    geminiVisionService.setApiKey(apiKey);
    geminiVisionService.setModel(model);
    onUpdateSettings({ geminiApiKey: apiKey, geminiModel: model });
    setSavedKeyFeedback(true);
    setTimeout(() => setSavedKeyFeedback(false), 2500);
  };

  const handleDeleteProfile = (id: string) => {
    personMemoryService.deleteProfile(id);
    setProfiles(personMemoryService.getAllProfiles());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0d0e12] border-2 border-yellow-400/50 rounded-3xl p-6 overflow-y-auto text-white shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400 text-yellow-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-heading" className="text-xl font-black text-white">
                Vision &amp; Assistant Settings
              </h2>
              <p className="text-xs text-slate-400">Configure Cloud AI, Voices &amp; Person Memory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Gemini Multimodal Vision API Config */}
        <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <Key className="w-4 h-4" />
            <span>Google Gemini Multimodal Vision API (Optional)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Local real-time obstacle detection works 100% offline via TensorFlow.js. Connecting a Google AI Studio Gemini API key enables deep scene descriptions, precise door/exit guidance, and text reading.
          </p>

          <div className="space-y-2">
            <label htmlFor="gemini-key" className="text-xs font-semibold text-slate-400 block">
              Gemini API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="gemini-key"
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
              />
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-5 py-2.5 rounded-xl bg-yellow-400 text-black font-extrabold text-sm hover:bg-yellow-300 transition-colors flex items-center justify-center space-x-1.5 shrink-0"
              >
                {savedKeyFeedback ? <Check className="w-4 h-4 text-black" /> : null}
                <span>{savedKeyFeedback ? 'Saved!' : 'Save Key'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <label htmlFor="gemini-model" className="text-xs font-semibold text-slate-300">
                Model:
              </label>
              <select
                id="gemini-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-black border border-slate-700 text-xs text-cyan-300 focus:outline-none focus:border-yellow-400"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast &amp; Accurate)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Standard)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              </select>
            </div>
            {geminiVisionService.hasApiKey() && (
              <span className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Cloud Multimodal Active</span>
              </span>
            )}
          </div>
        </section>

        {/* 2. Voice Persona & Speech Settings */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-yellow-400 font-bold text-sm">
            <Volume2 className="w-4 h-4" />
            <span>Voice Persona &amp; Natural Audio</span>
          </div>

          <div className="space-y-2">
            <label htmlFor="voice-select" className="text-xs font-semibold text-slate-400 block">
              Google Assistant / System Voice:
            </label>
            <select
              id="voice-select"
              value={settings.selectedVoiceURI}
              onChange={(e) => {
                onUpdateSettings({ selectedVoiceURI: e.target.value });
                speechManager.setVoiceByURI(e.target.value);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-black border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-yellow-400"
            >
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="speech-rate" className="text-xs font-semibold text-slate-400 block mb-1">
                Speech Rate: {settings.speechRate.toFixed(2)}x
              </label>
              <input
                id="speech-rate"
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={settings.speechRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateSettings({ speechRate: val });
                  speechManager.setRate(val);
                }}
                className="w-full accent-yellow-400"
              />
            </div>
            <div>
              <label htmlFor="radar-vol" className="text-xs font-semibold text-slate-400 block mb-1">
                3D Radar Sonar Volume: {Math.round(settings.radarVolume * 100)}%
              </label>
              <input
                id="radar-vol"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.radarVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateSettings({ radarVolume: val });
                }}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>
        </section>

        {/* 3. Person Memory Profiles */}
        <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <Users className="w-4 h-4" />
              <span>Enrolled People Memory ({profiles.length})</span>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            People remembered via voice command <strong className="text-yellow-400">&quot;Hey Vision, remember this person as [Name]&quot;</strong>.
          </p>

          {profiles.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No people enrolled yet. Point the camera at a person and say &quot;Remember this person as Dharshan&quot;.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black border border-slate-800"
                >
                  <div className="flex items-center space-x-3">
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover border border-emerald-400/50"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-300 font-bold">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Enrolled {new Date(p.enrolledAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(p.id)}
                    aria-label={`Forget profile for ${p.name}`}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Environment & Indoor Comfort Mode */}
        <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <Home className="w-4 h-4" />
            <span>Environment &amp; Indoor Comfort Mode</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Standard Home Mode creates a calm, comfortable indoor experience by suppressing repetitive emergency obstacle sirens for everyday household furniture and people.
          </p>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between bg-black/60 p-3 rounded-xl border border-slate-800">
              <div>
                <p className="text-xs font-bold text-white">Ignore Self in Front Camera / Webcam</p>
                <p className="text-[11px] text-slate-400">Prevents obstacle alarm from triggering when facing your own camera</p>
              </div>
              <input
                type="checkbox"
                checked={settings.ignoreSelfInFrontCamera !== false}
                onChange={(e) => onUpdateSettings({ ignoreSelfInFrontCamera: e.target.checked })}
                className="w-5 h-5 accent-emerald-400 rounded cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Modal Done Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 bg-yellow-400 text-black font-extrabold rounded-2xl hover:bg-yellow-300 transition-colors uppercase tracking-wider text-sm shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <SettingsModalContent
      onClose={onClose}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
    />
  );
};
