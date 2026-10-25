import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { speechManager } from './services/speechSynthesis';
import { speechRecognitionService } from './services/speechRecognition';
import { objectDetectorService } from './services/objectDetector';
import { personMemoryService } from './services/personMemory';
import { geminiVisionService } from './services/geminiVision';
import type { AssistantState, DetectedObject, VisionSettings } from './types';

import { GiantTouchTarget } from './components/GiantTouchTarget';
import { CameraRadarCanvas } from './components/CameraRadarCanvas';
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
  const [doorGuidance, setDoorGuidance] = useState<{ direction: string; confidence: number; meters: number } | null>(null);

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

  // 1. Initialize local TensorFlow.js COCO-SSD model
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

  // 2. Synchronize speech synthesis state with UI and microphone anti-interruption
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

  // 3. Setup Camera Stream
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
      // Fallback to any user-facing camera if environment not found
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await fallbackStream.getTracks()[0];
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

  // 4. Voice Commands Handler
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
        speechManager.speakReply('Beyond Sight is active. What would you like to find?');
        return;
      }

      // 2. Start Camera
      if (commandType === 'start_camera') {
        audioEngine.playActivationChime();
        await startCamera();
        speechManager.speakReply('Camera active. Scanning for obstacles and people.');
        return;
      }

      // 3. Stop Camera
      if (commandType === 'stop_camera') {
        stopCamera();
        audioEngine.playDeactivationChime();
        speechManager.speakReply('Camera stopped. Standby mode active. Say Hey Vision to wake me.');
        return;
      }

      // 4. Remember Person ("Remember this person as [Name]")
      if (commandType === 'remember_person' && extra?.personName) {
        const name = extra.personName;
        const video = videoRef.current;
        if (!video || !isCameraActive) {
          speechManager.speakReply('Please turn on the camera so I can see who you want to remember.');
          return;
        }

        // Find detected person in current frame
        const personDetection = detections.find((d) => d.class === 'person');
        if (personDetection) {
          const sig = personMemoryService.extractVisualSignature(video, personDetection.bbox);
          if (sig) {
            personMemoryService.saveProfile(name, sig.thumbnail, sig.histogram);
            audioEngine.playSuccessTone();
            speechManager.speakReply(`I have remembered this person as ${name}. I will announce them when they approach.`);
            return;
          }
        }

        // If no explicit COCO-SSD person bbox, crop center frame
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

      // 5. Who is there? ("Who is in front of me?")
      if (commandType === 'who_is_there') {
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        const recognizedPerson = detections.find((d) => d.class === 'person' && d.matchedPersonName);
        if (recognizedPerson) {
          speechManager.speakReply(
            `${recognizedPerson.matchedPersonName} is standing right at your ${recognizedPerson.clockDirection}, about ${recognizedPerson.estimatedMeters} meters away.`
          );
          return;
        }

        const anyPerson = detections.find((d) => d.class === 'person');
        if (anyPerson) {
          // If Gemini API is available, get detailed visual description
          if (geminiVisionService.hasApiKey() && videoRef.current) {
            const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
            if (base64) {
              try {
                const desc = await geminiVisionService.describePerson(base64);
                speechManager.speakReply(desc);
                return;
              } catch {
                // Fallback to local
              }
            }
          }
          speechManager.speakReply(
            `A person is standing at your ${anyPerson.clockDirection}, about ${anyPerson.estimatedMeters} meters away. They are not in your saved memory.`
          );
          return;
        }

        speechManager.speakReply('There is currently no person detected directly in front of you.');
        return;
      }

      // 6. Door / Exit Search ("Where is the door?")
      if (commandType === 'find_door') {
        setAssistantState('thinking');
        audioEngine.playThinkingChime();

        // If Gemini API Key present, use cloud multimodal for ultra-precise door detection
        if (geminiVisionService.hasApiKey() && videoRef.current) {
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const res = await geminiVisionService.findTarget(base64, 'door or exit');
              speechManager.speakReply(res);
              return;
            } catch {
              // Fallback to edge heuristic
            }
          }
        }

        // Local Edge heuristic fallback
        if (doorGuidance && doorGuidance.confidence > 0.35) {
          speechManager.speakReply(
            `Doorway detected at your ${doorGuidance.direction}, about ${doorGuidance.meters} meters ahead. Step forward cautiously.`
          );
          return;
        }

        speechManager.speakReply(
          'Scanning for doors. Turn slowly left or right so I can scan the entire room.'
        );
        return;
      }

      // 7. Describe the room ("Describe the room" / "What do you see?")
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
              // Fallback to local
            }
          }
        }

        // Local spatial summary fallback using detected objects
        if (detections.length === 0) {
          speechManager.speakReply(
            'The area immediately ahead appears clear of major obstacles within 3 meters. You can step forward slowly.'
          );
        } else {
          const summaryParts = detections.slice(0, 3).map((d) => {
            const name = d.matchedPersonName ? `your acquaintance ${d.matchedPersonName}` : `a ${d.class}`;
            return `${name} at ${d.clockDirection}, ${d.estimatedMeters} meters away`;
          });
          speechManager.speakReply(
            `I detect ${detections.length} objects around you: ${summaryParts.join('; ')}.`
          );
        }
        return;
      }

      // 8. Read Text ("Read text" / "Read this")
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
          speechManager.speakReply('To read text and signs, please enter a Google Gemini API key in settings.');
        }
        return;
      }

      // 9. Specific object search ("Where is the chair / bottle / table?")
      if (commandType === 'find_object' && extra?.targetObject) {
        const target = extra.targetObject.toLowerCase().trim();
        const found = detections.find((d) => d.class.toLowerCase().includes(target));

        if (found) {
          speechManager.speakReply(
            `There is a ${found.class} at your ${found.clockDirection}, approximately ${found.estimatedMeters} meters ahead (${found.estimatedSteps} steps).`
          );
          return;
        }

        // Try Gemini Vision if key exists
        if (geminiVisionService.hasApiKey() && videoRef.current) {
          setAssistantState('thinking');
          audioEngine.playThinkingChime();
          const base64 = geminiVisionService.captureFrameBase64(videoRef.current);
          if (base64) {
            try {
              const res = await geminiVisionService.findTarget(base64, target);
              speechManager.speakReply(res);
              return;
            } catch {
              // Fallback
            }
          }
        }

        speechManager.speakReply(
          `I don't see a ${target} in your current field of view. Try turning slowly.`
        );
        return;
      }

      // 10. General conversational fallback
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
        speechManager.speakReply(`I heard "${transcript}". Say "Where is the door?", "Where is the chair?", or "Describe the room".`);
      }
    },
    [isCameraActive, detections, doorGuidance, startCamera, stopCamera]
  );

  // 5. Connect Speech Recognition callbacks
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

  // 6. Real-time Object Detection Loop (approx 120ms interval for smooth tracking)
  useEffect(() => {
    if (!isCameraActive || !objectDetectorService.getIsReady()) return;

    let isRunning = true;

    const detectFrame = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 480;

          // Local COCO-SSD detection
          const detected = await objectDetectorService.detect(video, width, height, settings.minConfidence);

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

          // Run edge door heuristic
          const doorResult = objectDetectorService.detectDoorHeuristic(video, width, height);
          setDoorGuidance(doorResult);

          // 3D Spatial Radar Audio: Sonar clicks for closest obstacle
          if (settings.spatialRadarEnabled && detected.length > 0) {
            const sortedByDistance = [...detected].sort((a, b) => a.estimatedMeters - b.estimatedMeters);
            const closest = sortedByDistance[0];
            audioEngine.playSpatialRadarPing(closest.zone, closest.proximityTier);
          }

          // Safety Alert Check: Obstacles in Immediate Danger (< 1.2m)
          const dangerItem = detected.find((d) => d.proximityTier === 'danger');
          const now = Date.now();
          if (dangerItem && now - lastDangerAlertTime.current > 3500) {
            lastDangerAlertTime.current = now;
            audioEngine.playDangerAlert();
            const alertName = dangerItem.matchedPersonName || dangerItem.class;
            speechManager.speakUrgent(
              `Caution! ${alertName} right at your ${dangerItem.clockDirection}, less than 1.2 meters away! Please stop.`
            );
          } else if (settings.autoGuidance && detected.length > 0) {
            // Periodic background navigation advice for closest obstacle (subject to 4s cooldown)
            const primary = detected[0];
            if (primary.proximityTier === 'close') {
              const name = primary.matchedPersonName || primary.class;
              speechManager.speakBackground(
                `${name} at ${primary.clockDirection}, ${primary.estimatedMeters} meters ahead.`
              );
            }
          }
        } catch {
          // Frame skip
        }
      }

      if (isRunning) {
        detectionLoopRef.current = window.setTimeout(detectFrame, 120);
      }
    };

    detectFrame();

    return () => {
      isRunning = false;
      if (detectionLoopRef.current) {
        clearTimeout(detectionLoopRef.current);
      }
    };
  }, [isCameraActive, settings.minConfidence, settings.spatialRadarEnabled, settings.autoGuidance]);

  // 7. Initial Single-Tap Screen Activation (Accessibility Unlock)
  const handleInitialUnlock = async () => {
    setIsUnlocked(true);
    await audioEngine.unlock();
    audioEngine.playActivationChime();

    // Start wake-word speech recognition
    speechRecognitionService.start();

    // Start camera stream
    await startCamera();

    // Welcome speech
    speechManager.speakReply(
      'Beyond Sight is active. Scanning your environment. Say Hey Vision anytime.'
    );
  };

  // Push-to-talk button handler
  const handlePushToTalk = () => {
    audioEngine.playActivationChime();
    speechRecognitionService.start();
    setAssistantState('listening');
    setStatusMessage('Listening to your voice...');
  };

  // Manual Face Enrollment Trigger
  const handleOpenEnrollModal = () => {
    const video = videoRef.current;
    if (video && isCameraActive) {
      // Find person or grab center
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
        speechManager.speakReply(`Saved ${name} to your person memory.`);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col justify-between bg-[#050505] text-white overflow-hidden select-none">
      {/* 1. Giant Full-Screen Touch Target Overlay for blind initial unlock */}
      <GiantTouchTarget
        onUnlock={handleInitialUnlock}
        isUnlocked={isUnlocked}
        isLoadingModels={isLoadingModels}
      />

      {/* 2. Main Live Camera & 3-Zone Spatial Radar Canvas */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <CameraRadarCanvas
          videoRef={videoRef}
          detections={detections}
          isCameraActive={isCameraActive}
          onToggleCamera={toggleCamera}
          doorGuidance={doorGuidance}
        />
      </main>

      {/* 3. Bottom Section: Gemini-Style Pulsing Voice Orb & Subtitles */}
      <div className="relative z-30 w-full flex flex-col items-center pointer-events-none pb-2">
        <VoiceOrb
          state={assistantState}
          transcript={liveTranscript}
          isListening={isListening}
          onOrbClick={handlePushToTalk}
          statusMessage={statusMessage}
        />

        {/* 4. Large Tactile Accessibility Bar */}
        <div className="w-full px-2 sm:px-4 pointer-events-auto">
          <AccessibilityControls
            isCameraActive={isCameraActive}
            onToggleCamera={toggleCamera}
            isRadarMuted={!settings.spatialRadarEnabled}
            onToggleRadar={() => {
              const updated = !settings.spatialRadarEnabled;
              setSettings((prev) => ({ ...prev, spatialRadarEnabled: updated }));
              speechManager.speakReply(updated ? '3D Spatial audio radar unmuted.' : '3D Spatial audio radar muted.');
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

      {/* 5. Modals & Drawers */}
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
