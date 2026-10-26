// Offline Voice & Speech Capabilities Manager
// Selects local offline TTS voices (localService: true) and manages offline speech recognition
import { speechManager } from '../speechSynthesis';

const LOCAL_VOICE_HINT_KEY = 'beyond_sight_local_voice_hint_given';

export class OfflineVoiceService {
  private offlineVoiceHintAnnounced = false;

  /**
   * Selects an offline local voice from the browser's available voice list
   */
  public selectBestOfflineVoice(): SpeechSynthesisVoice | null {
    const voices = speechManager.getVoices();
    if (!voices || voices.length === 0) return null;

    // Filter voices where localService is true
    const localVoices = voices.filter((v) => v.localService === true);

    if (localVoices.length > 0) {
      // Find an English or device-preferred local voice
      const preferred = localVoices.find(
        (v) => v.lang.startsWith('en') || v.lang.startsWith('en-US')
      );
      const chosen = preferred || localVoices[0];
      speechManager.setVoiceByURI(chosen.voiceURI);
      return chosen;
    }

    // If no localService voice reported, provide one-time guidance
    this.maybeAdviseInstallingLocalVoice();
    return null;
  }

  /**
   * Spoken hint if no local voice is installed
   */
  public maybeAdviseInstallingLocalVoice(): void {
    if (typeof window === 'undefined' || this.offlineVoiceHintAnnounced) return;

    try {
      const alreadyAdvised = localStorage.getItem(LOCAL_VOICE_HINT_KEY);
      if (!alreadyAdvised) {
        this.offlineVoiceHintAnnounced = true;
        localStorage.setItem(LOCAL_VOICE_HINT_KEY, 'true');
        setTimeout(() => {
          speechManager.speakBackground(
            'Tip: To hear spoken alerts without internet, enable an offline text-to-speech voice in your device accessibility settings.'
          );
        }, 5000);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Attempts to enable on-device local recognition on Web Speech API
   */
  public configureOfflineRecognition(recognitionInstance: any): void {
    if (!recognitionInstance) return;
    try {
      // Chrome / Edge experimental on-device flag
      if ('processLocally' in recognitionInstance) {
        recognitionInstance.processLocally = true;
      }
    } catch {
      // Ignore
    }
  }
}

export const offlineVoiceService = new OfflineVoiceService();
