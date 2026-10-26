import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { speechManager } from './services/speechSynthesis';
import { speechRecognitionService } from './services/speechRecognition';
import { objectDetectorService, degreesToCardinal } from './services/objectDetector';
import { personMemoryService } from './services/personMemory';
import { geminiVisionService } from './services/geminiVision';
import type {
  AssistantState,
  DetectedObject,
  VisionSettings,
  DoorGuidanceInfo,
  NavigationMode,
  WalkGuidanceState,
  LatLng,
} from './types';
import { guidanceEngine } from './services/walk/GuidanceEngine';
import { obstacleMonitor } from './services/walk/ObstacleMonitor';
import { pocketDetector } from './services/walk/PocketDetector';
import { emergencyService } from './services/walk/Emergency';
import { hapticService } from './services/walk/HapticPatterns';
import { simulationHarness } from './services/walk/SimulationHarness';
import { i18n } from './services/i18n';
import { offlineModeController } from './services/offline/OfflineModeController';
import { cacheManager } from './services/offline/CacheManager';
import { locationHistoryService } from './services/offline/LocationHistory';
import { offlineTestHarness } from './services/offline/OfflineTestHarness';
import { featureGate } from './services/offline/FeatureGate';

import { GiantTouchTarget } from './components/GiantTouchTarget';
import { CameraRadarCanvas } from './components/CameraRadarCanvas';
import { SettingsModal } from './components/SettingsModal';
import { EnrollPersonModal } from './components/EnrollPersonModal';
import { HelpDrawer } from './components/HelpDrawer';

export function App() {
  // App Unlocked & Init State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // Assistant State
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('Standby');
  const [isListening, setIsListening] = useState(false);

  // Camera & Detection State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [doorGuidance, setDoorGuidance] = useState<DoorGuidanceInfo | null>(null);

  // Compass Heading & Direction Orientation
  const [userHeading, setUserHeading] = useState(0); // 0 - 360 degrees
  const userHeadingRef = useRef(0);
  const lastRenderedHeadingRef = useRef(0);

  // Environment Navigation Mode: Standard Home Mode vs Road Mode vs Smart Walk Mode
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('home');
  const isRoadMode = navigationMode === 'road' || navigationMode === 'walk';
  const [crosswalkDetected, setCrosswalkDetected] = useState(false);

  // Smart Walk Mode Guidance State & GPS
  const [walkGuidanceState, setWalkGuidanceState] = useState<WalkGuidanceState>(() => guidanceEngine.getState());
  const [simulatedDetections, setSimulatedDetections] = useState<DetectedObject[]>([]);
  const userLocationRef = useRef<LatLng | null>(null);
  const lowBatteryWarned = useRef(false);
  const [isOffline, setIsOffline] = useState(false);

  // Daily Mobility Features
  const [activeTargetItem, setActiveTargetItem] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isCurtainActive, setIsCurtainActive] = useState(false);
  const [isEcoMode] = useState(true);

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [enrollThumbnail, setEnrollThumbnail] = useState<string | null>(null);

  // App Settings
  const [settings, setSettings] = useState<VisionSettings>({
    geminiApiKey: geminiVisionService.getApiKey(),
    geminiModel: geminiVisionService.getModel(),
    spatialRadarEnabled: true,
    radarVolume: 0.6,
    speechRate: 1.05,
    speechPitch: 1.0,
    selectedVoiceURI: '',
    highContrastMode: true,
    minConfidence: 0.45,
    autoGuidance: true,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const lastVehicleAlertTime = useRef(0);
  const lastTrafficLightAlertTime = useRef(0);
  const lastTargetPingTime = useRef(0);
  const lastCrosswalkAlertTime = useRef(0);

  // 1. Device Orientation & Magnetometer Compass Listener
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading = 0;
      if ((e as any).webkitCompassHeading !== undefined) {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }
      const rounded = Math.round(heading);
      userHeadingRef.current = rounded;
      guidanceEngine.updateHeading(rounded);

      // Deadband smoothing filter: prevent 60fps micro-jitter from re-rendering React components
      if (Math.abs(rounded - lastRenderedHeadingRef.current) >= 2) {
        lastRenderedHeadingRef.current = rounded;
        setUserHeading(rounded);
      }
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // 1b. Smart Walk Guidance Engine Subscription
  useEffect(() => {
    const unsubscribe = guidanceEngine.subscribe((next) => {
      setWalkGuidanceState(next);
    });
    return unsubscribe;
  }, []);

  // 1c. Geolocation WatchPosition (High Accuracy)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const successHandler = (pos: GeolocationPosition) => {
      const loc: LatLng = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      userLocationRef.current = loc;
      guidanceEngine.updateLocation(loc, pos.coords.accuracy);
    };

    const errorHandler = (err: GeolocationPositionError) => {
      console.warn('Geolocation error:', err.message);
      if (err.code === err.PERMISSION_DENIED && navigationMode === 'walk') {
        speechManager.speakUrgent(i18n.t.locationDenied);
      }
    };

    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [navigationMode]);

  // 1d. Low Battery Status Monitor (< 15% alert)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          const checkBattery = () => {
            if (battery.level <= 0.15 && !battery.charging && !lowBatteryWarned.current) {
              lowBatteryWarned.current = true;
              speechManager.speakUrgent(i18n.t.lowBatteryWarning);
            }
          };
          checkBattery();
          battery.addEventListener('levelchange', checkBattery);
        })
        .catch(() => {});
    }
  }, []);

  // 1e. Walk Simulation Harness Callback
  useEffect(() => {
    simulationHarness.setDetectionsCallback((sim) => {
      setSimulatedDetections(sim);
    });
    return () => simulationHarness.setDetectionsCallback(() => {});
  }, []);

  // 1f. Automatic Offline Mode Subscription & Background Precache
  useEffect(() => {
    const unsubscribe = offlineModeController.subscribe((offline) => {
      setIsOffline(offline);
    });
    cacheManager.precacheOfflineAssets();
    return unsubscribe;
  }, []);

  // 2. Initialize local TensorFlow.js COCO-SSD model
  useEffect(() => {
    let isMounted = true;
    objectDetectorService
      .init()
      .then((ready) => {
        if (isMounted) {
          setIsLoadingModels(!ready);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingModels(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Synchronize speech synthesis state with UI and microphone anti-interruption
  useEffect(() => {
    const unsubscribe = speechManager.onSpeakingChange((speaking, text) => {
      if (speaking) {
        setAssistantState('speaking');
        setStatusMessage(text ? `"${text.substring(0, 50)}..."` : 'Speaking');
      } else {
        setAssistantState(speechRecognitionService.getIsListening() ? 'listening' : 'idle');
        setStatusMessage('Ready for next command');
      }
    });

    return unsubscribe;
  }, []);

  // 4. Setup Camera Stream
  const startCamera = useCallback(async (desiredFacing?: 'environment' | 'user') => {
    const targetFacing = desiredFacing || cameraFacing;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Update state if camera reports actual facingMode
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings ? track.getSettings() : undefined;
      if (settings?.facingMode) {
        setCameraFacing(settings.facingMode as any);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setStatusMessage(targetFacing === 'user' ? 'Front Camera / Webcam Active' : 'Scanning environment');
    } catch {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        setCameraFacing('user');
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
        setStatusMessage('Scanning environment (Front Camera / Webcam)');
      } catch (err) {
        console.error('Camera access error:', err);
        speechManager.speakUrgent('Camera access was not granted. Please allow camera permissions.');
      }
    }
  }, [cameraFacing]);

  // Flip Camera between rear navigation and front webcam
  const toggleCameraFacing = useCallback(async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    audioEngine.playGestureFeedback('tap');
    await startCamera(nextFacing);
    speechManager.speakReply(
      nextFacing === 'user'
        ? 'Switched to front webcam. Standard Home Mode will ignore your face.'
        : 'Switched to rear navigation camera.'
    );
  }, [cameraFacing, startCamera]);

  // Auto-request camera on load so user sees camera immediately
  useEffect(() => {
    void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setDetections([]);
    setDoorGuidance(null);
    setIsTorchOn(false);
    setStatusMessage('Camera paused. Wake-word active.');
  }, []);

  const toggleCamera = useCallback(() => {
    if (isCameraActive) {
      stopCamera();
      audioEngine.playDeactivationChime();
      speechManager.speakReply('Camera paused. Beyond Sight is on standby.');
    } else {
      audioEngine.playActivationChime();
      startCamera();
      speechManager.speakReply('Camera resumed. Scanning your path.');
    }
  }, [isCameraActive, startCamera, stopCamera]);

  // Flashlight / Torch Controller
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) {
      speechManager.speakReply('Please turn on the camera first to use the flashlight.');
      return;
    }
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const capabilities = (track.getCapabilities && (track.getCapabilities() as any)) || {};
      if ('torch' in capabilities) {
        const nextState = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setIsTorchOn(nextState);
        audioEngine.playTorchSound(nextState);
        speechManager.speakUrgent(nextState ? 'Flashlight ON. Environment illuminated.' : 'Flashlight OFF.');
      } else {
        audioEngine.playTorchSound(false);
        speechManager.speakReply('Flashlight is not available on this camera hardware.');
      }
    } catch {
      speechManager.speakReply('Could not switch flashlight.');
    }
  }, [isTorchOn]);

  // Eco Screen Curtain
  const toggleCurtain = useCallback(() => {
    setIsCurtainActive((prev) => {
      const next = !prev;
      audioEngine.playGestureFeedback('curtain');
      if (next) {
        speechManager.speakUrgent(
          'Screen curtain active. OLED display powered off to save battery. Camera, compass direction tracking, and road sentinel are running.'
        );
      } else {
        speechManager.speakReply('Screen display revealed.');
      }
      return next;
    });
  }, []);

  // Environment Navigation Mode Toggle: Standard Home Mode vs Road Mode
  const toggleNavigationMode = useCallback(() => {
    setNavigationMode((prev) => {
      const next = prev === 'home' ? 'road' : 'home';
      audioEngine.playGestureFeedback('swipe');
      if (next === 'road') {
        speechManager.speakUrgent(
          'Road Safety Mode activated. Heightened vehicle approach alert, zebra crosswalk scanning, and pedestrian traffic signal detection are active.'
        );
      } else {
        speechManager.speakReply(
          'Standard Home Mode activated. Calming indoor guidance with no false alarms.'
        );
      }
      return next;
    });
  }, []);

  // Compass Heading Check
  const handleCheckCompass = useCallback(() => {
    audioEngine.playGestureFeedback('tap');
    const cardinal = degreesToCardinal(userHeading);
    speechManager.speakReply(`You are currently facing ${userHeading} degrees, heading ${cardinal}.`);
  }, [userHeading]);

  // Quick Walk / Path Check
  const handleCheckPathAhead = useCallback(() => {
    speechManager.cancelAll();
    audioEngine.playGestureFeedback('tap');

    // In active Walk Mode: Tap announces turn progress & path
    if (navigationMode === 'walk' && walkGuidanceState.status === 'walking') {
      const street = walkGuidanceState.nextStreetName ? ` onto ${walkGuidanceState.nextStreetName}` : '';
      const turn = walkGuidanceState.nextManeuverModifier || 'straight';
      speechManager.speakReply(
        `In ${walkGuidanceState.stepsToNextTurn} steps, ${turn}${street}. You are heading ${userHeading} degrees.`
      );
      return;
    }

    const centerObstacles = detections.filter(
      (d) =>
        !d.isSelfUser &&
        (cameraFacing !== 'user' || d.class !== 'person') &&
        (d.clockDirection === "12 o'clock" || d.zone === 'center')
    );

    if (centerObstacles.length === 0) {
      audioEngine.playClearPathChime();
      speechManager.speakReply('Path ahead is completely clear for at least 4 steps.');
      return;
    }

    const closest = [...centerObstacles].sort((a, b) => a.estimatedMeters - b.estimatedMeters)[0];
    const name = closest.matchedPersonName || closest.class;
    const cardinal = closest.cardinalDirection ? ` (${closest.cardinalDirection})` : '';

    speechManager.speakReply(
      `${name} ahead at 12 o'clock${cardinal}, ${closest.estimatedMeters} meters away (${closest.estimatedSteps} steps). Step slightly to your side.`
    );
  }, [detections, cameraFacing, navigationMode, walkGuidanceState, userHeading]);

  const handleOpenEnrollModal = useCallback(() => {
    const video = videoRef.current;
    if (video && isCameraActive) {
      const person = detections.find((d) => d.class === 'person');
      const bbox = person
        ? person.bbox
        : ([video.videoWidth * 0.25, video.videoHeight * 0.2, video.videoWidth * 0.5, video.videoHeight * 0.6] as [
            number,
            number,
            number,
            number
          ]);
      const sig = personMemoryService.extractVisualSignature(video, bbox);
      if (sig) {
        setEnrollThumbnail(sig.thumbnail);
      }
    }
    setIsEnrollModalOpen(true);
  }, [detections, isCameraActive]);

  // 5. Voice Commands Handler
  const handleVoiceCommand = useCallback(
    async (
      commandType: string,
      transcript: string,
      extra?: {
        targetObject?: string;
        personName?: string;
        destination?: string;
        choiceIndex?: number;
        contactInput?: string;
      }
    ) => {
      // 0. Smart Walk Mode commands
      if (commandType === 'start_walk_mode') {
        setNavigationMode('walk');
        setActiveTargetItem(null);
        audioEngine.playActivationChime();
        if (!isCameraActive) {
          await startCamera();
        }
        await guidanceEngine.startWalkMode(extra?.destination, userLocationRef.current || undefined);
        return;
      }

      if (commandType === 'stop_walk_mode') {
        guidanceEngine.stopRoute();
        obstacleMonitor.reset();
        setNavigationMode('home');
        return;
      }

      if (commandType === 'confirm_yes') {
        if (guidanceEngine.getState().status === 'confirming_destination') {
          setNavigationMode('walk');
          await guidanceEngine.confirmDestination(0);
        } else {
          speechManager.speakReply('Confirmed.');
        }
        return;
      }

      if (commandType === 'confirm_no') {
        if (guidanceEngine.getState().status === 'confirming_destination') {
          guidanceEngine.cancelDestination();
          setNavigationMode('home');
        } else {
          speechManager.speakReply('Cancelled.');
        }
        return;
      }

      if (commandType === 'select_choice') {
        if (guidanceEngine.getState().status === 'confirming_destination') {
          setNavigationMode('walk');
          await guidanceEngine.confirmDestination(extra?.choiceIndex ?? 0);
        }
        return;
      }

      if (commandType === 'emergency_help') {
        await emergencyService.triggerEmergency(userLocationRef.current);
        return;
      }

      if (commandType === 'set_emergency_contact') {
        emergencyService.parseAndSaveContact(extra?.contactInput || transcript);
        return;
      }

      if (commandType === 'explain_vibrations') {
        await hapticService.explainPatterns((text) => speechManager.speakReply(text));
        return;
      }

      if (commandType === 'forget_data') {
        emergencyService.forgetAllData();
        return;
      }

      if (commandType === 'simulate_walk') {
        setNavigationMode('walk');
        await simulationHarness.start();
        return;
      }

      if (commandType === 'install_pwa') {
        await cacheManager.promptInstall();
        return;
      }

      if (commandType === 'simulate_offline') {
        offlineTestHarness.simulateOffline();
        return;
      }

      if (commandType === 'simulate_online') {
        offlineTestHarness.simulateOnline();
        return;
      }

      if (commandType === 'simulate_flaky') {
        offlineTestHarness.simulateFlaky();
        return;
      }

      if (commandType === 'where_am_i') {
        const desc = locationHistoryService.getOfflineLocationDescription(userLocationRef.current, userHeading);
        speechManager.speakReply(desc);
        return;
      }
      // 1. Wake word
      if (commandType === 'wake') {
        audioEngine.playActivationChime();
        setAssistantState('listening');
        setStatusMessage('Listening for your command...');
        if (!isCameraActive) {
          await startCamera();
        }
        speechManager.speakReply('Beyond Sight is active. What would you like to find or navigate?');
        return;
      }

      // 2. Start / Stop Camera
      if (commandType === 'start_camera') {
        audioEngine.playActivationChime();
        await startCamera();
        speechManager.speakReply('Camera active. Scanning for obstacles, people, and doors.');
        return;
      }

      if (commandType === 'stop_camera') {
        stopCamera();
        audioEngine.playDeactivationChime();
        speechManager.speakReply('Camera stopped. Standby mode active.');
        return;
      }

      // 2b. Flashlight toggle
      if (commandType === 'toggle_torch') {
        await toggleTorch();
        return;
      }

      // 2c. Screen Curtain
      if (commandType === 'toggle_curtain') {
        toggleCurtain();
        return;
      }

      // 2c2. Flip Camera
      if (commandType === 'flip_camera') {
        await toggleCameraFacing();
        return;
      }

      // 2d. Check Path
      if (commandType === 'check_path') {
        handleCheckPathAhead();
        return;
      }

      // 2e. Set Home / Standard Mode
      if (commandType === 'set_home_mode') {
        setNavigationMode('home');
        setActiveTargetItem(null);
        audioEngine.playGestureFeedback('swipe');
        speechManager.speakReply('Standard Home Mode active. Calming indoor navigation with no false alarms.');
        return;
      }

      // 2f. Set Road Mode
      if (commandType === 'set_road_mode') {
        setNavigationMode('road');
        audioEngine.playGestureFeedback('swipe');
        speechManager.speakUrgent('Road Safety Mode active. Monitoring vehicles and street crossings.');
        return;
      }

      // 2g. Cancel Target & Beacon
      if (commandType === 'cancel_target') {
        setActiveTargetItem(null);
        audioEngine.playDeactivationChime();
        speechManager.speakReply('Target search and acoustic beacons stopped.');
        return;
      }

      // 2h. Road Mode toggle
      if (commandType === 'toggle_road_mode') {
        toggleNavigationMode();
        return;
      }

      // 2f. Traffic Light & Crosswalk Check
      if (commandType === 'check_traffic_light') {
        audioEngine.playThinkingChime();
        const trafficLight = detections.find((d) => d.class === 'traffic light');

        if (trafficLight) {
          if (trafficLight.trafficLightState === 'green') {
            audioEngine.playTrafficLightAPS('green');
            speechManager.speakUrgent('Pedestrian walk signal is GREEN. Safe to cross the street now.');
            return;
          } else if (trafficLight.trafficLightState === 'red') {
            audioEngine.playTrafficLightAPS('red');
            speechManager.speakUrgent("Traffic light is RED. Stop! Do not cross the street.");
            return;
          }
        }

        if (crosswalkDetected) {
          audioEngine.playCrosswalkChime();
          speechManager.speakReply('Zebra crosswalk detected straight ahead. Check for traffic noise before crossing.');
          return;
        }

        speechManager.speakReply('Scanning traffic lights and crosswalks. Point your camera towards the opposite street curb.');
        return;
      }

      // 2g. Which direction is the door located?
      if (commandType === 'which_direction_door') {
        setActiveTargetItem('door');
        audioEngine.playThinkingChime();

        if (doorGuidance && doorGuidance.confidence > 0.35) {
          const turnMsg = doorGuidance.turnOffsetDeg === 0
            ? 'straight ahead'
            : doorGuidance.turnOffsetDeg < 0
            ? `turn ${Math.abs(doorGuidance.turnOffsetDeg)} degrees to your left`
            : `turn ${doorGuidance.turnOffsetDeg} degrees to your right`;

          audioEngine.playDoorHomingBeacon(Math.abs(doorGuidance.turnOffsetDeg) < 10, doorGuidance.turnOffsetDeg);
          speechManager.speakReply(
            `The doorway is located at ${doorGuidance.degrees} degrees ${doorGuidance.cardinalDirection}, at your ${doorGuidance.direction}. To face it directly, ${turnMsg}. It is about ${doorGuidance.meters} meters away (${doorGuidance.estimatedSteps} steps).`
          );
          return;
        }

        speechManager.speakReply(
          'Scanning for doorways. Turn slowly in a circle so the camera can locate the portal and compass heading.'
        );
        return;
      }

      // 2h. Which direction are they standing / facing?
      if (commandType === 'which_direction_person') {
        audioEngine.playThinkingChime();
        const recognizedPerson = detections.find((d) => d.class === 'person' && d.matchedPersonName);

        if (recognizedPerson) {
          const stance = recognizedPerson.personFacing ? `and is ${recognizedPerson.personFacing}` : '';
          speechManager.speakReply(
            `${recognizedPerson.matchedPersonName} is standing at your ${recognizedPerson.clockDirection} (${recognizedPerson.cardinalDirection}), about ${recognizedPerson.estimatedMeters} meters away, ${stance}.`
          );
          return;
        }

        const anyPerson = detections.find((d) => d.class === 'person');
        if (anyPerson) {
          const stance = anyPerson.personFacing ? `and appears to be ${anyPerson.personFacing}` : '';
          speechManager.speakReply(
            `A person is standing at your ${anyPerson.clockDirection} (${anyPerson.cardinalDirection}), about ${anyPerson.estimatedMeters} meters away, ${stance}.`
          );
          return;
        }

        speechManager.speakReply('There is currently no person detected in front of you.');
        return;
      }

      // 2i. Compass Heading
      if (commandType === 'check_compass') {
        handleCheckCompass();
        return;
      }

      // 3. Remember Person
      if (commandType === 'remember_person') {
        if (!extra?.personName) {
          handleOpenEnrollModal();
          return;
        }
        const name = extra.personName;
        const video = videoRef.current;
        if (!video || !isCameraActive) {
          speechManager.speakReply('Please turn on the camera so I can see who you want to remember.');
          return;
        }

        const personDetection = detections.find((d) => d.class === 'person');
        if (personDetection) {
          const sig = personMemoryService.extractVisualSignature(video, personDetection.bbox);
          if (sig) {
            personMemoryService.saveProfile(name, sig.thumbnail, sig.histogram);
            audioEngine.playSuccessTone();
            speechManager.speakReply(`I have remembered this person as ${name}.`);
            return;
          }
        }

        const centerBbox: [number, number, number, number] = [
          video.videoWidth * 0.25,
          video.videoHeight * 0.15,
          video.videoWidth * 0.5,
          video.videoHeight * 0.7,
        ];
        const centerSig = personMemoryService.extractVisualSignature(video, centerBbox);
        if (centerSig) {
          personMemoryService.saveProfile(name, centerSig.thumbnail, centerSig.histogram);
          audioEngine.playSuccessTone();
          speechManager.speakReply(`Saved visual profile for ${name}.`);
        } else {
          speechManager.speakReply(`I could not get a clear view of the person to remember as ${name}. Please step closer.`);
        }
        return;
      }

      // 4. Who is there?
      if (commandType === 'who_is_there') {
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        const recognizedPerson = detections.find((d) => d.class === 'person' && d.matchedPersonName);
        if (recognizedPerson) {
          const stance = recognizedPerson.personFacing ? ` (${recognizedPerson.personFacing})` : '';
          speechManager.speakReply(
            `${recognizedPerson.matchedPersonName} is standing right at your ${recognizedPerson.clockDirection} (${recognizedPerson.cardinalDirection}), about ${recognizedPerson.estimatedMeters} meters away${stance}.`
          );
          return;
        }

        const anyPerson = detections.find((d) => d.class === 'person');
        if (anyPerson) {
          if (geminiVisionService.hasApiKey() && videoRef.current) {
            const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
            if (base64) {
              try {
                const desc = await geminiVisionService.describePerson(base64);
                speechManager.speakReply(desc);
                return;
              } catch {
                // Fallback
              }
            }
          }
          speechManager.speakReply(
            `A person is standing at your ${anyPerson.clockDirection} (${anyPerson.cardinalDirection}), about ${anyPerson.estimatedMeters} meters away.`
          );
          return;
        }

        speechManager.speakReply('There is currently no person detected directly in front of you.');
        return;
      }

      // 5. Door / Exit Search
      if (commandType === 'find_door') {
        setActiveTargetItem('door');
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        if (doorGuidance && doorGuidance.confidence > 0.35) {
          speechManager.speakReply(
            `Doorway detected at ${doorGuidance.degrees} degrees ${doorGuidance.cardinalDirection}, about ${doorGuidance.meters} meters ahead. Step forward cautiously.`
          );
          return;
        }

        speechManager.speakReply(
          'Searching for doors. Turn slowly in a circle so the camera can scan the entire room.'
        );
        return;
      }

      // 6. Describe the room & spatial location
      if (commandType === 'describe_room') {
        speechManager.cancelAll();
        setAssistantState('thinking');
        audioEngine.playThinkingChime();
        setStatusMessage('Scanning room & surroundings...');

        // 1. If online and Gemini Vision key is present, perform deep multimodal spatial room narration
        if (featureGate.evaluate('describe_room') === 'cloud' && geminiVisionService.hasApiKey() && videoRef.current) {
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const desc = await geminiVisionService.describeRoom(base64);
              speechManager.speakReply(desc);
              return;
            } catch (err) {
              console.warn('Gemini vision description fallback:', err);
            }
          }
        }

        // 2. Local Intelligent Spatial Room & Surroundings Narration (100% Offline Capable)
        const cardinal = degreesToCardinal(userHeading);
        const validItems = detections.filter(
          (d) => !d.isSelfUser && (cameraFacing !== 'user' || d.class !== 'person')
        );

        // Path clearance straight ahead
        const pathBlockers = validItems.filter(
          (d) => (d.clockDirection === "12 o'clock" || d.zone === 'center') && d.estimatedMeters < 2.5
        );

        let pathText = 'Straight ahead is completely open for walking at least 4 steps.';
        if (pathBlockers.length > 0) {
          const blocker = [...pathBlockers].sort((a, b) => a.estimatedMeters - b.estimatedMeters)[0];
          pathText = `Directly ahead at 12 o'clock is a ${blocker.class}, about ${blocker.estimatedMeters} meters away (${blocker.estimatedSteps} steps).`;
        }

        const chairs = validItems.filter((d) =>
          ['chair', 'couch', 'bed', 'bench', 'armchair', 'seat', 'sofa'].includes(d.class.toLowerCase())
        );
        const tables = validItems.filter((d) =>
          ['dining table', 'desk', 'table'].includes(d.class.toLowerCase())
        );
        const doors = doorGuidance && doorGuidance.confidence > 0.35 ? [doorGuidance] : [];
        const people = validItems.filter((d) => d.class === 'person');

        const offlinePrefix = isOffline ? 'Basic description, offline. ' : '';
        const narrationParts: string[] = [
          `${offlinePrefix}You are facing ${cardinal} (${userHeading}°).`,
          pathText,
        ];

        if (chairs.length > 0) {
          const c = chairs[0];
          narrationParts.push(`There is a ${c.class} at your ${c.clockDirection}, about ${c.estimatedMeters} meters away (${c.estimatedSteps} steps).`);
        }

        if (tables.length > 0) {
          const t = tables[0];
          narrationParts.push(`A ${t.class} is at your ${t.clockDirection}, ${t.estimatedMeters} meters away.`);
        }

        if (doors.length > 0) {
          const d = doors[0];
          narrationParts.push(`A doorway is at your ${d.direction}, approximately ${d.meters} meters away.`);
        } else if (validItems.length > 0 && chairs.length === 0 && tables.length === 0) {
          const other = validItems.slice(0, 2).map((d) => `${d.class} at ${d.clockDirection}`).join(' and ');
          narrationParts.push(`Nearby items include ${other}.`);
        }

        if (people.length > 0) {
          const p = people[0];
          const name = p.matchedPersonName ? p.matchedPersonName : 'A person';
          narrationParts.push(`${name} is standing at your ${p.clockDirection}, ${p.estimatedMeters} meters away.`);
        }

        speechManager.speakReply(narrationParts.join(' '));
        return;
      }

      // 7. Read Text
      if (commandType === 'read_text') {
        speechManager.cancelAll();
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        if (featureGate.handleCloudUnavailable('read_text', 'Reading text', { action: 'read_text' })) {
          return;
        }

        if (geminiVisionService.hasApiKey() && videoRef.current) {
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const text = await geminiVisionService.readVisibleText(base64);
              speechManager.speakReply(text);
              return;
            } catch (err: any) {
              speechManager.speakReply(`Could not read text: ${err?.message || 'Please try again.'}`);
              return;
            }
          }
        } else {
          speechManager.speakReply('To read signs, mail, and medicine labels, please add your Google Gemini API key in settings.');
        }
        return;
      }

      // 8. Specific Object Navigation (e.g. "Where is the chair?")
      if (commandType === 'find_object' && extra?.targetObject) {
        speechManager.cancelAll();
        const target = extra.targetObject.toLowerCase().trim();
        setActiveTargetItem(target);
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        // Synonym mapping for common assistive objects
        const synonymMap: Record<string, string[]> = {
          chair: ['chair', 'couch', 'bed', 'bench', 'armchair', 'seat', 'sofa'],
          bottle: ['bottle', 'cup', 'wine glass', 'mug', 'bowl', 'glass'],
          phone: ['cell phone', 'phone', 'remote'],
          table: ['dining table', 'desk', 'table'],
          person: ['person'],
        };

        const targetSynonyms = synonymMap[target] || [target];

        const match = detections.find((d) =>
          !d.isSelfUser && targetSynonyms.some((s) => d.class.toLowerCase().includes(s))
        );

        if (match) {
          const centerX = match.bbox[0] + match.bbox[2] / 2;
          const videoW = videoRef.current?.videoWidth || 640;
          const panValue = Math.max(-1, Math.min(1, (centerX - videoW / 2) / (videoW / 2)));
          const isCentered = match.clockDirection === "12 o'clock" || match.zone === 'center';
          audioEngine.playTargetSeekerPing(match.estimatedMeters / 4, isCentered, panValue);

          let turnGuidance = '';
          if (match.clockDirection === "12 o'clock" || match.zone === 'center') {
            turnGuidance = 'It is straight in front of you. Walk forward carefully.';
          } else if (match.clockDirection.includes('1') || match.clockDirection.includes('2') || match.zone === 'right') {
            turnGuidance = 'Turn to your right to face it directly.';
          } else {
            turnGuidance = 'Turn to your left to face it directly.';
          }

          speechManager.speakReply(
            `The ${target} is at your ${match.clockDirection} (${match.cardinalDirection}), about ${match.estimatedMeters} meters away (${match.estimatedSteps} steps). ${turnGuidance}`
          );
          return;
        }

        // If not immediately found in local detections, ask Gemini Vision
        if (geminiVisionService.hasApiKey() && videoRef.current) {
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const res = await geminiVisionService.findTarget(base64, target);
              speechManager.speakReply(res);
              return;
            } catch {
              // Fallback below
            }
          }
        }

        speechManager.speakReply(
          `I do not see the ${target} directly ahead right now. Slowly turn your camera across the room so I can locate it for you.`
        );
        return;
      }

      // 9. General conversational query
      if (transcript) {
        const clean = transcript.toLowerCase().trim();
        if (clean.includes("what's new") || clean.includes("what is new") || clean.includes("whats new")) {
          speechManager.speakReply(
            "Beyond Sight now features Automatic Offline Mode with PWA caching and on-device fallback. When your connection drops, path clearance, room description, and vehicle alerts continue uninterrupted without internet."
          );
          return;
        }

        if (geminiVisionService.hasApiKey() && videoRef.current) {
          setAssistantState('thinking');
          audioEngine.playThinkingChime();
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const res = await geminiVisionService.findTarget(base64, transcript);
              speechManager.speakReply(res);
              return;
            } catch {
              // Fallback
            }
          }
        }
        speechManager.speakReply(`I heard "${transcript}". Say "Check path", "Where is the door?", "Which direction are they standing?", or "Road mode".`);
      }
    },
    [
      isCameraActive,
      detections,
      doorGuidance,
      crosswalkDetected,
      startCamera,
      stopCamera,
      toggleTorch,
      toggleCurtain,
      toggleNavigationMode,
      toggleCameraFacing,
      cameraFacing,
      userHeading,
      handleCheckPathAhead,
      handleCheckCompass,
      handleOpenEnrollModal,
      isOffline,
    ]
  );

  // 6. Connect Speech Recognition callbacks
  useEffect(() => {
    speechRecognitionService.registerCommandHandler(handleVoiceCommand);

    speechRecognitionService.registerTranscriptCallback((text, isFinal) => {
      setLiveTranscript(text);
      if (isFinal) {
        setTimeout(() => setLiveTranscript(''), 4500);
      }
    });

    speechRecognitionService.registerStatusCallback((listening) => {
      setIsListening(listening);
      if (listening && assistantState !== 'speaking' && assistantState !== 'thinking') {
        setAssistantState('listening');
      }
    });
  }, [handleVoiceCommand, assistantState]);

  // 7. Real-time Detection Loop with Direction & Road Safety Sentinel
  useEffect(() => {
    if (!isCameraActive || !objectDetectorService.getIsReady()) return;

    let isRunning = true;

    const detectFrame = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 480;

          // Local COCO-SSD detection with live user compass heading
          const currentHeading = userHeadingRef.current;
          const detected = await objectDetectorService.detect(
            video,
            width,
            height,
            settings.minConfidence,
            currentHeading
          );

          // Enhance detections with enrolled person profiles
          const profiles = personMemoryService.getAllProfiles();
          if (profiles.length > 0) {
            detected.forEach((item) => {
              if (item.class === 'person') {
                const sig = personMemoryService.extractVisualSignature(video, item.bbox);
                if (sig) {
                  const match = personMemoryService.matchPerson(sig.histogram);
                  if (match) {
                    item.matchedPersonName = match.profile.name;
                  }
                }
              }
            });
          }

          setDetections(detected);

          // Structural Door & Portal Heuristic
          const doorResult = objectDetectorService.detectDoorHeuristic(video, width, height, currentHeading);
          setDoorGuidance(doorResult);

          // Crosswalk / Zebra Crossing Heuristic
          const hasCrosswalk = objectDetectorService.detectCrosswalkHeuristic(video);
          setCrosswalkDetected(hasCrosswalk);

          const now = Date.now();

          // 0. Pocket & Lens Occlusion Detector
          const isPocketed = pocketDetector.analyzeFrame(video);
          guidanceEngine.setPocketed(isPocketed);

          // 0b. Smart Walk Mode Obstacle Awareness (Walking Corridor & Escalating Cues)
          if (navigationMode === 'walk') {
            const corridorObstacles = obstacleMonitor.evaluateCorridor(detected, width, height);
            obstacleMonitor.processEscalatingCues(corridorObstacles, isPocketed);
          }

          // 1. Road Safety Sentinel: Approaching Vehicles, Traffic Lights, Crosswalks (Road & Walk Modes)
          let fastVehicle: DetectedObject | undefined = undefined;
          if (navigationMode === 'road' || navigationMode === 'walk') {
            fastVehicle = detected.find((d) => d.isVehicle && d.isApproachingFast);
            if (fastVehicle && now - lastVehicleAlertTime.current > 3200) {
              lastVehicleAlertTime.current = now;
              audioEngine.playApproachingVehicleSiren(fastVehicle.zone);
              speechManager.speakUrgent(
                `WARNING! Fast ${fastVehicle.class} approaching at your ${fastVehicle.clockDirection} (${fastVehicle.cardinalDirection})! Step back on curb!`
              );
            }

            // Traffic Light State Alert (Pedestrian Signal)
            const trafficLight = detected.find((d) => d.class === 'traffic light');
            if (trafficLight && trafficLight.trafficLightState && now - lastTrafficLightAlertTime.current > 6000) {
              lastTrafficLightAlertTime.current = now;
              if (trafficLight.trafficLightState === 'green') {
                audioEngine.playTrafficLightAPS('green');
                speechManager.speakBackground('Walk signal is GREEN. Safe to cross.');
              } else if (trafficLight.trafficLightState === 'red') {
                audioEngine.playTrafficLightAPS('red');
                speechManager.speakBackground('Traffic light is RED. Wait.');
              }
            }

            // Crosswalk Alert
            if (hasCrosswalk && now - lastCrosswalkAlertTime.current > 8000) {
              lastCrosswalkAlertTime.current = now;
              audioEngine.playCrosswalkChime();
              speechManager.speakBackground('Zebra crosswalk ahead.');
            }
          }

          // 2. Target Navigation Orientation
          if (activeTargetItem) {
            const synonymMap: Record<string, string[]> = {
              chair: ['chair', 'couch', 'bed', 'bench', 'armchair', 'seat', 'sofa'],
              bottle: ['bottle', 'cup', 'wine glass', 'mug', 'bowl', 'glass'],
              phone: ['cell phone', 'phone', 'remote'],
              table: ['dining table', 'desk', 'table'],
              door: ['door', 'doorway', 'exit'],
            };
            const synonyms = synonymMap[activeTargetItem] || [activeTargetItem];
            const targetObj = detected.find(
              (d) =>
                !d.isSelfUser &&
                (synonyms.some((s) => d.class.toLowerCase().includes(s)) ||
                  (d.matchedPersonName && d.matchedPersonName.toLowerCase().includes(activeTargetItem.toLowerCase())))
            );

            if (targetObj) {
              const isCentered = targetObj.zone === 'center' || targetObj.clockDirection === "12 o'clock";
              const centerX = targetObj.bbox[0] + targetObj.bbox[2] / 2;
              const videoW = videoRef.current?.videoWidth || 640;
              const panValue = Math.max(-1, Math.min(1, (centerX - videoW / 2) / (videoW / 2)));

              if (isCentered) {
                // User has turned and is directly facing the target!
                audioEngine.playTargetSeekerPing(targetObj.estimatedMeters / 4, true, 0);
                audioEngine.playSuccessTone();
                speechManager.speakReply(
                  `You are facing the ${activeTargetItem} directly ahead, ${targetObj.estimatedSteps} steps away.`
                );
                setActiveTargetItem(null); // Objective reached!
              } else if (now - lastTargetPingTime.current > 1400) {
                lastTargetPingTime.current = now;
                audioEngine.playTargetSeekerPing(targetObj.estimatedMeters / 4, false, panValue);
              }
            }
          }

          // 3. Filter detections for Home Mode (ignore self on webcam)
          const validDetections = detected.filter((d) => {
            if (navigationMode === 'home') {
              if (settings.ignoreSelfInFrontCamera !== false) {
                if (d.isSelfUser || (cameraFacing === 'user' && d.class === 'person')) {
                  return false;
                }
              }
            }
            return true;
          });

          // 4. Subtle Spatial Radar audio ping only when explicitly active
          if (settings.spatialRadarEnabled && validDetections.length > 0 && !activeTargetItem && !fastVehicle) {
            const sortedByDistance = [...validDetections].sort((a, b) => a.estimatedMeters - b.estimatedMeters);
            const closest = sortedByDistance[0];
            // Auditory ducking: Suppress non-danger pings while speech synthesis is speaking
            // so blind users can hear speech output with 100% clarity.
            if (!speechManager.getIsSpeaking() || closest.proximityTier === 'danger') {
              audioEngine.playSpatialRadarPing(closest.zone, closest.proximityTier);
            }
          }
        } catch {
          // Frame skip
        }
      }

      if (isRunning) {
        const isDocHidden = typeof document !== 'undefined' && document.hidden;
        const frameInterval = isDocHidden
          ? 600
          : isCurtainActive || walkGuidanceState.isPocketed
          ? 240
          : isEcoMode
          ? 140
          : 80;
        detectionLoopRef.current = window.setTimeout(detectFrame, frameInterval);
      }
    };

    detectFrame();

    return () => {
      isRunning = false;
      if (detectionLoopRef.current) {
        clearTimeout(detectionLoopRef.current);
      }
    };
  }, [
    isCameraActive,
    settings.minConfidence,
    settings.spatialRadarEnabled,
    settings.ignoreSelfInFrontCamera,
    activeTargetItem,
    isEcoMode,
    isCurtainActive,
    navigationMode,
    cameraFacing,
    walkGuidanceState.isPocketed,
  ]);

  // Initial Accessibility Unlock
  const handleInitialUnlock = async () => {
    setIsUnlocked(true);
    await audioEngine.unlock();
    audioEngine.playActivationChime();

    speechRecognitionService.start();
    await startCamera();

    speechManager.speakReply(
      'Beyond Sight active in Standard Home Mode. Say Hey Vision anytime.'
    );
  };

  const handlePushToTalk = () => {
    audioEngine.playActivationChime();
    speechRecognitionService.start();
    setAssistantState('listening');
    setStatusMessage('Listening to your voice...');
  };

  const handlePushToTalkEnd = () => {
    setAssistantState('thinking');
    setStatusMessage('Analyzing...');
  };

  const handleEnrollPerson = (name: string) => {
    const video = videoRef.current;
    if (video && isCameraActive) {
      const person = detections.find((d) => d.class === 'person');
      const bbox = person ? person.bbox : [video.videoWidth * 0.25, video.videoHeight * 0.2, video.videoWidth * 0.5, video.videoHeight * 0.6] as [number, number, number, number];
      const sig = personMemoryService.extractVisualSignature(video, bbox);
      if (sig) {
        personMemoryService.saveProfile(name, sig.thumbnail, sig.histogram);
        audioEngine.playSuccessTone();
        speechManager.speakReply(`Saved ${name} to your acquaintance memory.`);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden select-none">
      {/* 1. Translucent Initial Unlock Overlay */}
      <GiantTouchTarget
        onUnlock={handleInitialUnlock}
        isUnlocked={isUnlocked}
        isLoadingModels={isLoadingModels}
      />

      {/* 2. Pure Full-Screen Live Camera Viewfinder (Zero Buttons, Edge-to-Edge) */}
      <main className="absolute inset-0 w-full h-full overflow-hidden bg-black">
        <CameraRadarCanvas
          videoRef={videoRef}
          detections={simulatedDetections.length > 0 ? simulatedDetections : detections}
          isCameraActive={isCameraActive}
          onToggleCamera={toggleCamera}
          doorGuidance={doorGuidance}
          targetItem={activeTargetItem}
          userHeading={userHeading}
          isCurtainActive={isCurtainActive}
          onToggleCurtain={toggleCurtain}
          navigationMode={navigationMode}
          isRoadMode={isRoadMode}
          crosswalkDetected={crosswalkDetected}
          walkGuidanceState={walkGuidanceState}
          isOffline={isOffline}
          onSingleTap={handleCheckPathAhead}
          onDoubleTap={() => handleVoiceCommand('describe_room', 'describe the room')}
          onLongPressStart={handlePushToTalk}
          onLongPressEnd={handlePushToTalkEnd}
        />
      </main>

      {/* 3. Ambient Floating Voice Indicator (Purely visual feedback, zero buttons) */}
      {(isListening || liveTranscript || assistantState === 'speaking' || assistantState === 'listening' || assistantState === 'thinking') && (
        <div className="absolute top-5 inset-x-4 sm:inset-x-12 z-30 flex flex-col items-center pointer-events-none transition-all duration-300 animate-fadeIn">
          <div className="max-w-md w-full bg-black/80 backdrop-blur-xl border border-cyan-400/40 rounded-full px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center space-x-3 text-left">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                assistantState === 'listening'
                  ? 'bg-cyan-400 animate-ping'
                  : assistantState === 'thinking'
                  ? 'bg-purple-400 animate-spin'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <div className="flex-1 overflow-hidden">
              {liveTranscript ? (
                <p className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-cyan-200 font-medium truncate">
                  {assistantState === 'listening'
                    ? 'Listening...'
                    : assistantState === 'thinking'
                    ? 'Scanning...'
                    : statusMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Accessibility Modals & Drawers */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
      />

      <EnrollPersonModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnroll={handleEnrollPerson}
        previewThumbnail={enrollThumbnail}
      />

      <HelpDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}

export default App;
