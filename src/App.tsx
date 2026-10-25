import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { speechManager } from './services/speechSynthesis';
import { speechRecognitionService } from './services/speechRecognition';
import { objectDetectorService, degreesToCardinal } from './services/objectDetector';
import { personMemoryService } from './services/personMemory';
import { geminiVisionService } from './services/geminiVision';
import type { AssistantState, DetectedObject, VisionSettings, DoorGuidanceInfo } from './types';

import { GiantTouchTarget } from './components/GiantTouchTarget';
import { CameraRadarCanvas } from './components/CameraRadarCanvas';
import { DailyItemFinderBar } from './components/DailyItemFinderBar';
import { VoiceOrb } from './components/VoiceOrb';
import { AccessibilityControls } from './components/AccessibilityControls';
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
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [doorGuidance, setDoorGuidance] = useState<DoorGuidanceInfo | null>(null);

  // Compass Heading & Direction Orientation
  const [userHeading, setUserHeading] = useState(0); // 0 - 360 degrees

  // Road & Street Safety Sentinel Mode
  const [isRoadMode, setIsRoadMode] = useState(false);
  const [crosswalkDetected, setCrosswalkDetected] = useState(false);

  // Daily Mobility Features
  const [activeTargetItem, setActiveTargetItem] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isCurtainActive, setIsCurtainActive] = useState(false);
  const [isEcoMode, setIsEcoMode] = useState(true);

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
  const lastDangerAlertTime = useRef(0);
  const lastVehicleAlertTime = useRef(0);
  const lastTrafficLightAlertTime = useRef(0);
  const lastClearPathChimeTime = useRef(0);
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
      setUserHeading(Math.round(heading));
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
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
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      setIsCameraActive(true);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setStatusMessage('Scanning environment');
    } catch {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
        setStatusMessage('Scanning environment (Front Camera)');
      } catch (err) {
        console.error('Camera access error:', err);
        speechManager.speakUrgent('Camera access was not granted. Please allow camera permissions.');
      }
    }
  }, []);

  // Auto-request camera on load so user sees camera immediately
  useEffect(() => {
    startCamera();
  }, [startCamera]);

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

  // Road & Street Safety Mode Toggle
  const toggleRoadMode = useCallback(() => {
    setIsRoadMode((prev) => {
      const next = !prev;
      audioEngine.playGestureFeedback('swipe');
      if (next) {
        speechManager.speakUrgent(
          'Road Safety Mode activated. Heightened vehicle approach alert, zebra crosswalk scanning, and pedestrian traffic signal detection are active.'
        );
      } else {
        speechManager.speakReply('Road Safety Mode turned off. Returning to normal indoor obstacle radar.');
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
    audioEngine.playGestureFeedback('tap');

    const centerObstacles = detections.filter(
      (d) => d.clockDirection === "12 o'clock" || d.zone === 'center'
    );

    if (centerObstacles.length === 0) {
      audioEngine.playClearPathChime();
      speechManager.speakUrgent('Path ahead is completely clear for at least 4 steps. You can walk forward safely.');
      return;
    }

    const closest = [...centerObstacles].sort((a, b) => a.estimatedMeters - b.estimatedMeters)[0];
    const name = closest.matchedPersonName || closest.class;
    const cardinal = closest.cardinalDirection ? ` (${closest.cardinalDirection})` : '';

    if (closest.proximityTier === 'danger') {
      audioEngine.playDangerAlert();
      speechManager.speakUrgent(`Caution! ${name} is right in front of you at 12 o'clock${cardinal}, only ${closest.estimatedSteps} step away! Stop.`);
    } else {
      speechManager.speakReply(
        `Obstacle ahead: ${name} at 12 o'clock${cardinal}, ${closest.estimatedMeters} meters away (${closest.estimatedSteps} steps). Step slightly left or right.`
      );
    }
  }, [detections]);

  // 5. Voice Commands Handler
  const handleVoiceCommand = useCallback(
    async (
      commandType: string,
      transcript: string,
      extra?: { targetObject?: string; personName?: string }
    ) => {
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

      // 2d. Check Path
      if (commandType === 'check_path') {
        handleCheckPathAhead();
        return;
      }

      // 2e. Road Mode toggle
      if (commandType === 'toggle_road_mode') {
        toggleRoadMode();
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
      if (commandType === 'remember_person' && extra?.personName) {
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

      // 6. Describe the room
      if (commandType === 'describe_room') {
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        if (geminiVisionService.hasApiKey() && videoRef.current) {
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const desc = await geminiVisionService.describeRoom(base64);
              speechManager.speakReply(desc);
              return;
            } catch {
              // Fallback
            }
          }
        }

        if (detections.length === 0) {
          speechManager.speakReply(
            'The area immediately ahead appears clear of major obstacles within 3 meters. You can step forward slowly.'
          );
        } else {
          const summaryParts = detections.slice(0, 3).map((d) => {
            const name = d.matchedPersonName ? `${d.matchedPersonName}` : `a ${d.class}`;
            const cardinal = d.cardinalDirection ? ` (${d.cardinalDirection})` : '';
            return `${name} at ${d.clockDirection}${cardinal}, ${d.estimatedMeters} meters away`;
          });
          speechManager.speakReply(
            `I detect ${detections.length} items around you: ${summaryParts.join('; ')}.`
          );
        }
        return;
      }

      // 7. Read Text
      if (commandType === 'read_text') {
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

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

      // 8. Specific object search
      if (commandType === 'find_object' && extra?.targetObject) {
        const target = extra.targetObject.toLowerCase().trim();
        setActiveTargetItem(target);

        const found = detections.find((d) => d.class.toLowerCase().includes(target));
        if (found) {
          audioEngine.playTargetSeekerPing(found.estimatedMeters / 4, true);
          speechManager.speakReply(
            `Found ${found.class} at your ${found.clockDirection} (${found.cardinalDirection}), approximately ${found.estimatedMeters} meters ahead (${found.estimatedSteps} steps).`
          );
          return;
        }

        speechManager.speakReply(
          `Seeking ${target}. Point your camera slowly across the room. Audio sonar will beep when you aim at it.`
        );
        return;
      }

      // 9. General conversational query
      if (transcript) {
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
      toggleRoadMode,
      handleCheckPathAhead,
      handleCheckCompass,
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
          const detected = await objectDetectorService.detect(
            video,
            width,
            height,
            settings.minConfidence,
            userHeading
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
          const doorResult = objectDetectorService.detectDoorHeuristic(video, width, height, userHeading);
          setDoorGuidance(doorResult);

          // Crosswalk / Zebra Crossing Heuristic
          const hasCrosswalk = objectDetectorService.detectCrosswalkHeuristic(video);
          setCrosswalkDetected(hasCrosswalk);

          const now = Date.now();

          // 1. Road Safety Sentinel: Approaching Vehicle Warning!
          const fastVehicle = detected.find((d) => d.isVehicle && d.isApproachingFast);
          if (fastVehicle && now - lastVehicleAlertTime.current > 2800) {
            lastVehicleAlertTime.current = now;
            audioEngine.playApproachingVehicleSiren(fastVehicle.zone);
            speechManager.speakUrgent(
              `WARNING! Fast ${fastVehicle.class} approaching at your ${fastVehicle.clockDirection} (${fastVehicle.cardinalDirection})! Step back on curb!`
            );
          }

          // 2. Traffic Light State Alert (Pedestrian Signal)
          const trafficLight = detected.find((d) => d.class === 'traffic light');
          if (trafficLight && trafficLight.trafficLightState && now - lastTrafficLightAlertTime.current > 5000) {
            lastTrafficLightAlertTime.current = now;
            if (trafficLight.trafficLightState === 'green') {
              audioEngine.playTrafficLightAPS('green');
              speechManager.speakBackground('Walk signal is GREEN. Safe to cross.');
            } else if (trafficLight.trafficLightState === 'red') {
              audioEngine.playTrafficLightAPS('red');
              speechManager.speakBackground('Traffic light is RED. Wait.');
            }
          }

          // 3. Crosswalk Alert
          if (hasCrosswalk && now - lastCrosswalkAlertTime.current > 7000) {
            lastCrosswalkAlertTime.current = now;
            audioEngine.playCrosswalkChime();
            speechManager.speakBackground('Zebra crosswalk ahead.');
          }

          // 4. Door Acoustic Homing Beacon (if user is searching for door)
          if (activeTargetItem === 'door' && doorResult && now - lastTargetPingTime.current > 350) {
            lastTargetPingTime.current = now;
            audioEngine.playDoorHomingBeacon(
              Math.abs(doorResult.turnOffsetDeg) < 10,
              doorResult.turnOffsetDeg
            );
          } else if (activeTargetItem && activeTargetItem !== 'door') {
            // General Item Finder Audio Seeker
            const targetObj = detected.find(
              (d) =>
                d.class.toLowerCase().includes(activeTargetItem.toLowerCase()) ||
                (d.matchedPersonName && d.matchedPersonName.toLowerCase().includes(activeTargetItem.toLowerCase()))
            );

            if (targetObj && now - lastTargetPingTime.current > 400) {
              lastTargetPingTime.current = now;
              const isCentered = targetObj.zone === 'center' || targetObj.clockDirection === "12 o'clock";
              audioEngine.playTargetSeekerPing(targetObj.estimatedMeters / 4, isCentered);
            }
          }

          // 5. 3D Spatial Audio Radar Sonar
          if (settings.spatialRadarEnabled && detected.length > 0 && !activeTargetItem && !fastVehicle) {
            const sortedByDistance = [...detected].sort((a, b) => a.estimatedMeters - b.estimatedMeters);
            const closest = sortedByDistance[0];
            audioEngine.playSpatialRadarPing(closest.zone, closest.proximityTier);
          }

          // 6. Clear Path Reassurance Chime
          const centerObstacles = detected.filter(
            (d) => d.clockDirection === "12 o'clock" || d.zone === 'center'
          );
          if (
            settings.spatialRadarEnabled &&
            centerObstacles.length === 0 &&
            !fastVehicle &&
            now - lastClearPathChimeTime.current > 6000
          ) {
            lastClearPathChimeTime.current = now;
            audioEngine.playClearPathChime();
          }

          // 7. Immediate Danger Obstacle Warning (< 1.2m)
          const dangerItem = detected.find((d) => d.proximityTier === 'danger');
          if (dangerItem && !fastVehicle && now - lastDangerAlertTime.current > 3200) {
            lastDangerAlertTime.current = now;
            audioEngine.playDangerAlert();
            const alertName = dangerItem.matchedPersonName || dangerItem.class;
            speechManager.speakUrgent(
              `Caution! ${alertName} at your ${dangerItem.clockDirection} (${dangerItem.cardinalDirection}), less than 1.2 meters away! Stop.`
            );
          }
        } catch {
          // Frame skip
        }
      }

      if (isRunning) {
        const frameInterval = isCurtainActive ? 220 : isEcoMode ? 160 : 100;
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
    activeTargetItem,
    isEcoMode,
    isCurtainActive,
    userHeading,
  ]);

  // Initial Accessibility Unlock
  const handleInitialUnlock = async () => {
    setIsUnlocked(true);
    await audioEngine.unlock();
    audioEngine.playActivationChime();

    speechRecognitionService.start();
    await startCamera();

    speechManager.speakReply(
      'Beyond Sight active with compass direction guidance and Road Safety Sentinel. Say Hey Vision anytime.'
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

  const handleOpenEnrollModal = () => {
    const video = videoRef.current;
    if (video && isCameraActive) {
      const person = detections.find((d) => d.class === 'person');
      const bbox = person ? person.bbox : [video.videoWidth * 0.25, video.videoHeight * 0.2, video.videoWidth * 0.5, video.videoHeight * 0.6] as [number, number, number, number];
      const sig = personMemoryService.extractVisualSignature(video, bbox);
      if (sig) {
        setEnrollThumbnail(sig.thumbnail);
      }
    }
    setIsEnrollModalOpen(true);
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
    <div className="relative w-screen h-screen flex flex-col justify-between bg-black text-white overflow-hidden select-none">
      {/* 1. Translucent Giant Touch Overlay */}
      <GiantTouchTarget
        onUnlock={handleInitialUnlock}
        isUnlocked={isUnlocked}
        isLoadingModels={isLoadingModels}
      />

      {/* 2. Live Camera Viewfinder with 3D Radar, Compass & Road Safety */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <CameraRadarCanvas
          videoRef={videoRef}
          detections={detections}
          isCameraActive={isCameraActive}
          onToggleCamera={toggleCamera}
          doorGuidance={doorGuidance}
          targetItem={activeTargetItem}
          userHeading={userHeading}
          isTorchOn={isTorchOn}
          onToggleTorch={toggleTorch}
          isCurtainActive={isCurtainActive}
          onToggleCurtain={toggleCurtain}
          isEcoMode={isEcoMode}
          onToggleEcoMode={() => setIsEcoMode((prev) => !prev)}
          isRadarMuted={!settings.spatialRadarEnabled}
          onToggleRadar={() => {
            const updated = !settings.spatialRadarEnabled;
            setSettings((prev) => ({ ...prev, spatialRadarEnabled: updated }));
            speechManager.speakReply(updated ? '3D audio radar unmuted.' : '3D audio radar muted.');
          }}
          isRoadMode={isRoadMode}
          onToggleRoadMode={toggleRoadMode}
          crosswalkDetected={crosswalkDetected}
          onSingleTap={handleCheckPathAhead}
          onDoubleTap={() => handleVoiceCommand('describe_room', 'describe the room')}
          onLongPressStart={handlePushToTalk}
          onLongPressEnd={handlePushToTalkEnd}
        />
      </main>

      {/* 3. Bottom Controls, Daily Navigation & Voice Assistant */}
      <div className="relative z-30 w-full flex flex-col items-center pointer-events-none pb-1">
        <VoiceOrb
          state={assistantState}
          transcript={liveTranscript}
          isListening={isListening}
          onOrbClick={handlePushToTalk}
          statusMessage={statusMessage}
        />

        {/* Daily Item, Road Mode & Compass Quick Bar */}
        <div className="w-full px-2 sm:px-4 pointer-events-auto pb-1.5">
          <DailyItemFinderBar
            activeTarget={activeTargetItem}
            onSelectTarget={(target) => {
              setActiveTargetItem(target);
              if (target) {
                audioEngine.playActivationChime();
                speechManager.speakReply(`Searching for ${target}. Turn camera slowly until acoustic beacon locks on.`);
              } else {
                speechManager.speakReply('Target search cancelled. Returning to general obstacle radar.');
              }
            }}
            onCheckPath={handleCheckPathAhead}
            onReadText={() => handleVoiceCommand('read_text', 'read text')}
            isRoadMode={isRoadMode}
            onToggleRoadMode={toggleRoadMode}
            onCheckCompass={handleCheckCompass}
            isRadarMuted={!settings.spatialRadarEnabled}
            onToggleRadar={() => {
              const updated = !settings.spatialRadarEnabled;
              setSettings((prev) => ({ ...prev, spatialRadarEnabled: updated }));
              speechManager.speakReply(updated ? '3D audio radar unmuted.' : '3D audio radar muted.');
            }}
          />
        </div>

        {/* Tactile Accessibility Navigation Bar */}
        <div className="w-full px-2 sm:px-4 pointer-events-auto">
          <AccessibilityControls
            isCameraActive={isCameraActive}
            onToggleCamera={toggleCamera}
            isRadarMuted={!settings.spatialRadarEnabled}
            onToggleRadar={() => {
              const updated = !settings.spatialRadarEnabled;
              setSettings((prev) => ({ ...prev, spatialRadarEnabled: updated }));
              speechManager.speakReply(updated ? '3D audio radar unmuted.' : '3D audio radar muted.');
            }}
            onOpenPersonEnrollment={handleOpenEnrollModal}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            onPushToTalk={handlePushToTalk}
            isListening={isListening}
            onDescribeScene={() => handleVoiceCommand('describe_room', 'describe the room')}
          />
        </div>
      </div>

      {/* 4. Modals & Drawers */}
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
