// Always-On Voice Wake-Word & Continuous Conversational Engine
import { speechManager } from './speechSynthesis';

export type VoiceCommandHandler = (
  commandType:
    | 'wake'
    | 'start_camera'
    | 'stop_camera'
    | 'find_object'
    | 'find_door'
    | 'who_is_there'
    | 'remember_person'
    | 'describe_room'
    | 'read_text'
    | 'toggle_torch'
    | 'toggle_curtain'
    | 'check_path'
    | 'toggle_road_mode'
    | 'check_traffic_light'
    | 'which_direction_door'
    | 'which_direction_person'
    | 'check_compass'
    | 'general_query',
  rawTranscript: string,
  extra?: { targetObject?: string; personName?: string }
) => void;

interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

class SpeechRecognitionService {
  private recognition: any = null;
  private isListeningRef = false;
  private isMutedForAppVoice = false;
  private manuallyStopped = false;
  private restartTimeout: any = null;
  private commandHandler: VoiceCommandHandler | null = null;
  private onTranscriptUpdate: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onStatusChange: ((isListening: boolean) => void) | null = null;

  constructor() {
    this.initRecognition();
    // Hook into speech manager so we mute transcript processing whenever app speaks
    speechManager.onSpeakingChange((speaking) => {
      this.isMutedForAppVoice = speaking;
      if (speaking) {
        // App is talking - ignore mic feedback
      }
    });
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const win = window as unknown as IWindowSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('SpeechRecognition API not natively supported on this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListeningRef = true;
        this.notifyStatus(true);
      };

      this.recognition.onresult = (event: any) => {
        // CRITICAL ANTI-INTERRUPTION CHECK:
        // If app is currently speaking or speech synthesis is active, discard hearing our own voice
        if (this.isMutedForAppVoice || speechManager.getIsSpeaking()) {
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0].transcript;
          if (item.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const displayTranscript = finalTranscript || interimTranscript;
        if (displayTranscript && this.onTranscriptUpdate) {
          this.onTranscriptUpdate(displayTranscript.trim(), Boolean(finalTranscript));
        }

        if (finalTranscript) {
          this.parseVoiceCommand(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;
        // Benign errors: 'no-speech' happens when user pauses; 'aborted' happens when stopped
        if (error !== 'no-speech' && error !== 'aborted') {
          console.warn('Speech recognition status:', error);
        }
        this.isListeningRef = false;
        this.notifyStatus(false);
        this.scheduleRestart(350);
      };

      this.recognition.onend = () => {
        this.isListeningRef = false;
        this.notifyStatus(false);
        if (!this.manuallyStopped) {
          this.scheduleRestart(250); // 250ms debounce prevents crashing or duplicate instances
        }
      };
    } catch (err) {
      console.warn('Failed to initialize SpeechRecognition:', err);
    }
  }

  private scheduleRestart(delayMs = 250): void {
    if (this.manuallyStopped) return;
    if (this.restartTimeout) clearTimeout(this.restartTimeout);

    this.restartTimeout = setTimeout(() => {
      this.start();
    }, delayMs);
  }

  public registerCommandHandler(handler: VoiceCommandHandler): void {
    this.commandHandler = handler;
  }

  public registerTranscriptCallback(cb: (transcript: string, isFinal: boolean) => void): void {
    this.onTranscriptUpdate = cb;
  }

  public registerStatusCallback(cb: (isListening: boolean) => void): void {
    this.onStatusChange = cb;
  }

  private notifyStatus(listening: boolean): void {
    if (this.onStatusChange) {
      this.onStatusChange(listening);
    }
  }

  public start(): boolean {
    if (!this.recognition) return false;
    this.manuallyStopped = false;

    if (this.isListeningRef) {
      return true; // Already running smoothly
    }

    try {
      this.recognition.start();
      this.isListeningRef = true;
      this.notifyStatus(true);
      return true;
    } catch {
      // If recognition was already queued or starting, catch safely
      return false;
    }
  }

  public stop(): void {
    this.manuallyStopped = true;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition && this.isListeningRef) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.isListeningRef = false;
    this.notifyStatus(false);
  }

  public getIsListening(): boolean {
    return this.isListeningRef;
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  /**
   * Natural Language Intent Parser for assistive commands
   */
  public parseVoiceCommand(transcript: string): void {
    if (!this.commandHandler) return;
    const clean = transcript.toLowerCase().trim();

    // 1. Wake word triggers
    if (
      clean.includes('hey vision') ||
      clean.includes('beyond sight') ||
      clean.includes('vision mate') ||
      clean.includes('wake up')
    ) {
      this.commandHandler('wake', transcript);
      return;
    }

    // 2. Start / Stop Camera
    if (
      clean.includes('start camera') ||
      clean.includes('turn on camera') ||
      clean.includes('open camera') ||
      clean.includes('start scanning')
    ) {
      this.commandHandler('start_camera', transcript);
      return;
    }

    if (
      clean.includes('stop camera') ||
      clean.includes('turn off camera') ||
      clean.includes('close camera') ||
      clean.includes('go to sleep') ||
      clean.includes('sleep mode')
    ) {
      this.commandHandler('stop_camera', transcript);
      return;
    }

    // 2b. Flashlight / Torch toggle
    if (
      clean.includes('flashlight') ||
      clean.includes('turn on light') ||
      clean.includes('turn off light') ||
      clean.includes('torch')
    ) {
      this.commandHandler('toggle_torch', transcript);
      return;
    }

    // 2c. Screen Curtain / OLED Eco Mode
    if (
      clean.includes('curtain') ||
      clean.includes('screen off') ||
      clean.includes('screen on') ||
      clean.includes('eco mode') ||
      clean.includes('save battery') ||
      clean.includes('battery saver')
    ) {
      this.commandHandler('toggle_curtain', transcript);
      return;
    }

    // 2d. Check walking path & step count
    if (
      clean.includes('is path clear') ||
      clean.includes('is my path clear') ||
      clean.includes('can i walk') ||
      clean.includes('how many steps') ||
      clean.includes('step count') ||
      clean.includes('is it safe to walk')
    ) {
      this.commandHandler('check_path', transcript);
      return;
    }

    // 2e. Road / Street Safety Sentinel Mode
    if (
      clean.includes('road mode') ||
      clean.includes('street mode') ||
      clean.includes('traffic mode') ||
      clean.includes('near the road') ||
      clean.includes('road safety') ||
      clean.includes('traffic alert')
    ) {
      this.commandHandler('toggle_road_mode', transcript);
      return;
    }

    // 2f. Traffic Light & Road Crossing Safety Query
    if (
      clean.includes('traffic light') ||
      clean.includes('can i cross') ||
      clean.includes('safe to cross') ||
      clean.includes('is it red or green') ||
      clean.includes('walk signal') ||
      clean.includes('cross the road') ||
      clean.includes('crosswalk') ||
      clean.includes('zebra crossing')
    ) {
      this.commandHandler('check_traffic_light', transcript);
      return;
    }

    // 2g. Which direction is the door located?
    if (
      clean.includes('which direction is the door') ||
      clean.includes('where is the door facing') ||
      clean.includes('which way is the door') ||
      clean.includes('direction of the door') ||
      clean.includes('door compass')
    ) {
      this.commandHandler('which_direction_door', transcript);
      return;
    }

    // 2h. Which direction are they standing / facing?
    if (
      clean.includes('which direction are they standing') ||
      clean.includes('which direction is the person') ||
      clean.includes('where are they facing') ||
      clean.includes('are they facing me') ||
      clean.includes('are they looking at me') ||
      clean.includes('standing direction')
    ) {
      this.commandHandler('which_direction_person', transcript);
      return;
    }

    // 2i. Compass & Cardinal Direction Heading ("Where am I facing?")
    if (
      clean.includes('what direction am i facing') ||
      clean.includes('which direction am i facing') ||
      clean.includes('compass heading') ||
      clean.includes('where is north') ||
      clean.includes('my heading')
    ) {
      this.commandHandler('check_compass', transcript);
      return;
    }

    // 3. Person enrollment: "Remember this person as [Name]"
    const rememberRegex = /(?:remember|save)\s+(?:this\s+)?person\s+(?:as|is|name\s+is)\s+([a-zA-Z\s]+)/i;
    const rememberMatch = clean.match(rememberRegex);
    if (rememberMatch && rememberMatch[1]) {
      const name = rememberMatch[1].trim();
      this.commandHandler('remember_person', transcript, { personName: name });
      return;
    }

    // 4. Person identity query: "Who is in front of me?"
    if (
      clean.includes('who is in front of me') ||
      clean.includes('who is this') ||
      clean.includes('who is that') ||
      clean.includes('who is there') ||
      clean.includes('who is here') ||
      clean.includes('who is standing')
    ) {
      this.commandHandler('who_is_there', transcript);
      return;
    }

    // 5. Door / Exit / Stairs query
    if (
      clean.includes('where is the door') ||
      clean.includes('where is the exit') ||
      clean.includes('find the door') ||
      clean.includes('find exit') ||
      clean.includes('where is the stairs') ||
      clean.includes('where are the stairs') ||
      clean.includes('where is the doorway')
    ) {
      this.commandHandler('find_door', transcript);
      return;
    }

    // 6. Describe room / What do you see?
    if (
      clean.includes('describe the room') ||
      clean.includes('what do you see') ||
      clean.includes('describe everything') ||
      clean.includes('tell me what is around me') ||
      clean.includes('describe environment') ||
      clean.includes('what is in front of me') ||
      clean.includes('is the path clear')
    ) {
      this.commandHandler('describe_room', transcript);
      return;
    }

    // 7. Read text
    if (
      clean.includes('read text') ||
      clean.includes('read this') ||
      clean.includes('read what is written') ||
      clean.includes('read sign') ||
      clean.includes('read document')
    ) {
      this.commandHandler('read_text', transcript);
      return;
    }

    // 8. Specific object query: "Where is the chair / table / bottle / phone?"
    const whereIsRegex = /(?:where\s+is\s+(?:the\s+)?|find\s+(?:the\s+)?|look\s+for\s+(?:the\s+)?)([a-zA-Z\s]+)/i;
    const whereMatch = clean.match(whereIsRegex);
    if (whereMatch && whereMatch[1]) {
      const target = whereMatch[1].trim();
      if (
        !target.includes('door') &&
        !target.includes('exit') &&
        !target.includes('who') &&
        !target.includes('camera')
      ) {
        this.commandHandler('find_object', transcript, { targetObject: target });
        return;
      }
    }

    // 9. General conversational query
    if (clean.length > 3) {
      this.commandHandler('general_query', transcript);
    }
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
