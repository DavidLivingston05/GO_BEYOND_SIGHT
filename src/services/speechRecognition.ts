// Always-On Voice Wake-Word & Continuous Conversational Engine
import { speechManager } from './speechSynthesis';
import { offlineVoiceService } from './offline/OfflineVoice';

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
    | 'flip_camera'
    | 'check_path'
    | 'toggle_road_mode'
    | 'set_home_mode'
    | 'set_road_mode'
    | 'cancel_target'
    | 'check_traffic_light'
    | 'which_direction_door'
    | 'which_direction_person'
    | 'check_compass'
    | 'start_walk_mode'
    | 'stop_walk_mode'
    | 'confirm_yes'
    | 'confirm_no'
    | 'select_choice'
    | 'emergency_help'
    | 'set_emergency_contact'
    | 'explain_vibrations'
    | 'forget_data'
    | 'simulate_walk'
    | 'install_pwa'
    | 'simulate_offline'
    | 'simulate_online'
    | 'simulate_flaky'
    | 'where_am_i'
    | 'general_query',
  rawTranscript: string,
  extra?: {
    targetObject?: string;
    personName?: string;
    destination?: string;
    choiceIndex?: number;
    contactInput?: string;
  }
) => void;

interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

class SpeechRecognitionService {
  private recognition: any = null;
  private isListeningRef = false;
  private manuallyStopped = false;
  private restartTimeout: any = null;
  private commandHandler: VoiceCommandHandler | null = null;
  private onTranscriptUpdate: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onStatusChange: ((isListening: boolean) => void) | null = null;
  private offlineSpeechWarningSpoken = false;
  private lastSpeakingEndTime = 0;

  constructor() {
    this.initRecognition();
    if (typeof window !== 'undefined') {
      speechManager.onSpeakingChange((speaking) => {
        if (!speaking) {
          this.lastSpeakingEndTime = Date.now();
        }
      });
    }
  }

  private isExplicitBargeIn(text: string): boolean {
    const clean = text.toLowerCase().trim();
    return (
      clean === 'stop' ||
      clean.startsWith('stop ') ||
      clean.endsWith(' stop') ||
      clean.includes('cancel') ||
      clean.includes('quiet') ||
      clean.includes('silence') ||
      clean.includes('hey vision') ||
      clean.includes('beyond sight')
    );
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
      offlineVoiceService.configureOfflineRecognition(this.recognition);

      this.recognition.onstart = () => {
        this.isListeningRef = true;
        this.notifyStatus(true);
      };

      this.recognition.onspeechstart = () => {
        // Acoustic self-echo protection:
        // Do not interrupt the device's own speech playback on ambient speaker sound.
        // Explicit word interruptions (e.g. "Stop", "Quiet") are handled in onresult.
      };

      this.recognition.onresult = (event: any) => {
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

        const displayTranscript = (finalTranscript || interimTranscript).trim();
        const now = Date.now();
        const isSpeaking = speechManager.getIsSpeaking();
        const inEchoBuffer = now - this.lastSpeakingEndTime < 350;

        // If the app is currently speaking or just finished within 350ms:
        if (isSpeaking || inEchoBuffer) {
          if (displayTranscript && this.isExplicitBargeIn(displayTranscript)) {
            // User intentionally spoke an explicit interrupt command ("stop", "cancel", "quiet", "hey vision")
            speechManager.cancelAll();
          } else {
            // Discard self-echo from speaker audio so the assistant never interrupts itself or self-triggers
            return;
          }
        }

        if (displayTranscript && this.onTranscriptUpdate) {
          this.onTranscriptUpdate(displayTranscript, Boolean(finalTranscript));
        }

        if (finalTranscript) {
          this.parseVoiceCommand(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;
        if (error === 'network') {
          this.handleOfflineNetworkSpeechError();
        }
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

  private handleOfflineNetworkSpeechError(): void {
    if (this.offlineSpeechWarningSpoken) return;
    this.offlineSpeechWarningSpoken = true;
    speechManager.speakUrgent(
      'Speech recognition is unavailable offline on this browser. Voice commands are paused. Use 1 tap to check path, 2 taps to describe room, or 3 taps for screen curtain.'
    );
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

    // 1b. Emergency & SOS Assistance ("Help me", "Emergency")
    if (
      clean.includes('help me') ||
      clean.includes('emergency') ||
      clean.includes('sos') ||
      clean.includes('i need help') ||
      clean.includes('call help')
    ) {
      this.commandHandler('emergency_help', transcript);
      return;
    }

    // 1c. Set Emergency Contact ("Set emergency contact [number/name]")
    if (
      clean.includes('emergency contact') ||
      clean.includes('trusted contact')
    ) {
      this.commandHandler('set_emergency_contact', transcript, { contactInput: transcript });
      return;
    }

    // 1d. Haptic Help: "What do the vibrations mean?"
    if (
      clean.includes('what do the vibrations mean') ||
      clean.includes('what does vibration mean') ||
      clean.includes('explain vibrations') ||
      clean.includes('vibration pattern') ||
      clean.includes('haptic help')
    ) {
      this.commandHandler('explain_vibrations', transcript);
      return;
    }

    // 1e. Privacy: "Forget my data"
    if (
      clean.includes('forget my data') ||
      clean.includes('delete my data') ||
      clean.includes('clear my data') ||
      clean.includes('forget data') ||
      clean.includes('reset my data')
    ) {
      this.commandHandler('forget_data', transcript);
      return;
    }

    // 1f. Simulation / Test Harness: "Simulate walk", "Test walk mode"
    if (
      clean.includes('simulate walk') ||
      clean.includes('simulation walk') ||
      clean.includes('test walk mode') ||
      clean.includes('simulate walking')
    ) {
      this.commandHandler('simulate_walk', transcript);
      return;
    }

    // 1g. Walk Mode: Stop walking / End route
    if (
      clean.includes('stop walking') ||
      clean.includes('stop walk') ||
      clean.includes('end route') ||
      clean.includes('stop navigation') ||
      clean.includes('exit walk mode')
    ) {
      this.commandHandler('stop_walk_mode', transcript);
      return;
    }

    // 1h. Destination Walk: "Take me to [place]", "Walk to [place]", "Navigate to [place]"
    const walkToRegex = /(?:take\s+me\s+to|walk\s+to|navigate\s+to|directions\s+to|route\s+to)\s+([a-zA-Z0-9\s]+)/i;
    const walkToMatch = clean.match(walkToRegex);
    if (walkToMatch && walkToMatch[1]) {
      const dest = walkToMatch[1].trim();
      if (!dest.includes('door') && !dest.includes('exit') && !dest.includes('sleep')) {
        this.commandHandler('start_walk_mode', transcript, { destination: dest });
        return;
      }
    }

    // 1i. Generic Walk Mode Activation: "Walk mode", "Start walking"
    if (
      clean === 'walk mode' ||
      clean.includes('start walking') ||
      clean.includes('walk mode') ||
      clean.includes('walking mode') ||
      clean.includes('start walk')
    ) {
      this.commandHandler('start_walk_mode', transcript);
      return;
    }

    // 1j. Confirmation handlers (for "Say yes to confirm" or numbered choices)
    if (clean === 'yes' || clean === 'confirm' || clean === 'start' || clean === 'yep' || clean === 'yeah') {
      this.commandHandler('confirm_yes', transcript);
      return;
    }
    if (clean === 'no' || clean === 'cancel' || clean === 'nope' || clean === 'abort') {
      this.commandHandler('confirm_no', transcript);
      return;
    }
    if (clean === '1' || clean === 'one' || clean === 'first' || clean === 'number 1') {
      this.commandHandler('select_choice', transcript, { choiceIndex: 0 });
      return;
    }
    if (clean === '2' || clean === 'two' || clean === 'second' || clean === 'number 2') {
      this.commandHandler('select_choice', transcript, { choiceIndex: 1 });
      return;
    }
    if (clean === '3' || clean === 'three' || clean === 'third' || clean === 'number 3') {
      this.commandHandler('select_choice', transcript, { choiceIndex: 2 });
      return;
    }

    // 1k. Install App / Add to Home Screen
    if (
      clean.includes('install app') ||
      clean.includes('install beyond sight') ||
      clean.includes('add to home screen') ||
      clean.includes('home screen')
    ) {
      this.commandHandler('install_pwa', transcript);
      return;
    }

    // 1l. Offline / Online Network Simulations
    if (
      clean.includes('simulate offline') ||
      clean.includes('go offline') ||
      clean.includes('test offline')
    ) {
      this.commandHandler('simulate_offline', transcript);
      return;
    }

    if (
      clean.includes('simulate online') ||
      clean.includes('go online') ||
      clean.includes('test online')
    ) {
      this.commandHandler('simulate_online', transcript);
      return;
    }

    if (
      clean.includes('simulate flaky') ||
      clean.includes('test flaky')
    ) {
      this.commandHandler('simulate_flaky', transcript);
      return;
    }

    // 1m. Where am I? (Offline GPS & Location History)
    if (
      clean === 'where am i' ||
      clean.includes('where am i located') ||
      clean.includes('whats my location') ||
      clean.includes('tell me where i am') ||
      clean.includes('what is my current location')
    ) {
      this.commandHandler('where_am_i', transcript);
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

    // 2c2. Flip / Switch Camera
    if (
      clean.includes('flip camera') ||
      clean.includes('switch camera') ||
      clean.includes('change camera') ||
      clean.includes('front camera') ||
      clean.includes('rear camera') ||
      clean.includes('back camera') ||
      clean.includes('webcam')
    ) {
      this.commandHandler('flip_camera', transcript);
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

    // 2e. Standard / Home Mode (Calm Indoor Navigation)
    if (
      clean.includes('standard') ||
      clean.includes('home mode') ||
      clean.includes('in home') ||
      clean.includes('at home') ||
      clean.includes('indoor') ||
      clean.includes('inside') ||
      clean.includes('quiet mode') ||
      clean.includes('relax mode') ||
      clean.includes('stop alarm') ||
      clean.includes('stop shouting') ||
      clean.includes('irritating')
    ) {
      this.commandHandler('set_home_mode', transcript);
      return;
    }

    // 2f. Road / Street Safety Sentinel Mode
    if (
      clean.includes('road mode') ||
      clean.includes('street mode') ||
      clean.includes('traffic mode') ||
      clean.includes('outdoor mode') ||
      clean.includes('outside') ||
      clean.includes('near the road') ||
      clean.includes('road safety') ||
      clean.includes('traffic alert')
    ) {
      this.commandHandler('set_road_mode', transcript);
      return;
    }

    // 2g. Cancel active target seeker, homing beacon or speech
    if (
      clean.includes('cancel') ||
      clean.includes('stop') ||
      clean.includes('quiet') ||
      clean.includes('shut up') ||
      clean.includes('silence') ||
      clean.includes('stop talking') ||
      clean.includes('stop finding') ||
      clean.includes('stop beacon') ||
      clean.includes('stop seeking') ||
      clean.includes('stop searching')
    ) {
      this.commandHandler('cancel_target', transcript);
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

    // 6. Describe room / Scan surroundings / Where am I?
    if (
      clean.includes('describe') ||
      clean.includes('scan room') ||
      clean.includes('scan the room') ||
      clean.includes('what do you see') ||
      clean.includes('describe everything') ||
      clean.includes('tell me what is around me') ||
      clean.includes('what is around me') ||
      clean.includes('whats around me') ||
      clean.includes('where am i') ||
      clean.includes('where am i located') ||
      clean.includes('tell me where i am') ||
      clean.includes('describe environment') ||
      clean.includes('what is in front of me')
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

    // 8. High-Frequency Direct Object Queries
    // "Where is the chair", "Find chair", "Chair", "Where can I sit"
    if (
      clean.includes('chair') ||
      clean.includes('where can i sit') ||
      clean.includes('seat') ||
      clean.includes('armchair') ||
      clean.includes('couch') ||
      clean.includes('sofa')
    ) {
      this.commandHandler('find_object', transcript, { targetObject: 'chair' });
      return;
    }

    // "Where is the bottle / cup / water / mug"
    if (
      clean.includes('bottle') ||
      clean.includes('cup') ||
      clean.includes('glass') ||
      clean.includes('mug') ||
      clean.includes('water')
    ) {
      this.commandHandler('find_object', transcript, { targetObject: 'bottle' });
      return;
    }

    // "Where is my phone / mobile"
    if (
      clean.includes('phone') ||
      clean.includes('mobile') ||
      clean.includes('cellphone') ||
      clean.includes('cell phone')
    ) {
      this.commandHandler('find_object', transcript, { targetObject: 'phone' });
      return;
    }

    // "Where is the table / desk"
    if (
      clean.includes('table') ||
      clean.includes('desk')
    ) {
      this.commandHandler('find_object', transcript, { targetObject: 'table' });
      return;
    }

    // 8b. General object query: "Where is the [item]?"
    const whereIsRegex = /(?:where\s+is\s+(?:the\s+)?|where\s+are\s+(?:the\s+)?|find\s+(?:the\s+)?|look\s+for\s+(?:the\s+)?)([a-zA-Z\s]+)/i;
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
