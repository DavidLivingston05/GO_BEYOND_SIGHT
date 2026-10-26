import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  VideoOff,
  Leaf,
  Sparkles,
} from 'lucide-react';
import type { DetectedObject, DoorGuidanceInfo, NavigationMode } from '../types';
import { degreesToCardinal } from '../services/objectDetector';

interface CameraRadarCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detections: DetectedObject[];
  isCameraActive: boolean;
  onToggleCamera: () => void;
  doorGuidance?: DoorGuidanceInfo | null;
  targetItem?: string | null;
  userHeading?: number; // 0 - 360 compass degrees
  isCurtainActive?: boolean;
  onToggleCurtain?: () => void;
  navigationMode?: NavigationMode;
  isRoadMode?: boolean;
  crosswalkDetected?: boolean;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
}

export const CameraRadarCanvas: React.FC<CameraRadarCanvasProps> = ({
  videoRef,
  detections,
  isCameraActive,
  onToggleCamera,
  doorGuidance,
  targetItem,
  userHeading = 0,
  isCurtainActive = false,
  onToggleCurtain,
  navigationMode = 'home',
  isRoadMode = false,
  crosswalkDetected = false,
  onSingleTap,
  onDoubleTap,
  onLongPressStart,
  onLongPressEnd,
}) => {
  const isRoad = navigationMode === 'road' || isRoadMode;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Gesture handling state
  const touchTimerRef = useRef<number | null>(null);
  const tapCountRef = useRef<number>(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const [gestureFeedbackText, setGestureFeedbackText] = useState<string | null>(null);

  // Subtle gesture feedback
  const triggerVisualFeedback = useCallback((text: string) => {
    setGestureFeedbackText(text);
    window.setTimeout(() => setGestureFeedbackText(null), 1800);
  }, []);

  // Render authentic camera autofocus boxes, 3D LiDAR radar, and compass HUD
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!canvas || !video || !container || !isCameraActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      if (video.readyState >= 2) {
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const displayW = Math.round(rect.width);
        const displayH = Math.round(rect.height);

        if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
          canvas.width = displayW * dpr;
          canvas.height = displayH * dpr;
        }

        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, displayW, displayH);

        // 1. Calculate Video-to-Canvas scale & offset
        const videoW = video.videoWidth || 640;
        const videoH = video.videoHeight || 480;
        const scale = Math.max(displayW / videoW, displayH / videoH);
        const renderedW = videoW * scale;
        const renderedH = videoH * scale;
        const offsetX = (displayW - renderedW) / 2;
        const offsetY = (displayH - renderedH) / 2;

        // 2. Camera Viewfinder Frame Corners [   ]
        ctx.strokeStyle = isRoadMode ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        const margin = 16;
        const cornerLen = 24;

        // Top-Left
        ctx.beginPath();
        ctx.moveTo(margin, margin + cornerLen);
        ctx.lineTo(margin, margin);
        ctx.lineTo(margin + cornerLen, margin);
        ctx.stroke();

        // Top-Right
        ctx.beginPath();
        ctx.moveTo(displayW - margin - cornerLen, margin);
        ctx.lineTo(displayW - margin, margin);
        ctx.lineTo(displayW - margin, margin + cornerLen);
        ctx.stroke();

        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(margin, displayH - margin - cornerLen);
        ctx.lineTo(margin, displayH - margin);
        ctx.lineTo(margin + cornerLen, displayH - margin);
        ctx.stroke();

        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(displayW - margin - cornerLen, displayH - margin);
        ctx.lineTo(displayW - margin, displayH - margin);
        ctx.lineTo(displayW - margin, displayH - margin - cornerLen);
        ctx.stroke();

        // 3. Top Compass Ribbon HUD (e.g. "NW  315°  N  000°  NE  045°")
        const ribbonY = 24;
        const userCardinal = degreesToCardinal(userHeading);
        ctx.font = 'bold 11px system-ui, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(displayW / 2 - 95, ribbonY - 14, 190, 26, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.fillText(`🧭 COMPASS: ${userHeading}° ${userCardinal}`, displayW / 2, ribbonY + 3);

        // 4. Draw Camera Autofocus Boxes on Detected People, Vehicles & Objects
        detections.forEach((item) => {
          const [vx, vy, vw, vh] = item.bbox;

          // Pixel-perfect transformed coordinates
          const x = offsetX + vx * scale;
          const y = offsetY + vy * scale;
          const w = vw * scale;
          const h = vh * scale;

          const isPerson = item.class === 'person';
          const isVehicle = item.isVehicle;
          const isTargetMatch =
            targetItem &&
            (item.class.toLowerCase().includes(targetItem.toLowerCase()) ||
              (item.matchedPersonName && item.matchedPersonName.toLowerCase().includes(targetItem.toLowerCase())));

          // Color Scheme:
          // Approaching Vehicle -> Flashing Neon Red #ef4444
          // Target locked -> Bright Emerald #10b981
          // Danger < 1.2m -> High-Vis Red
          // Close 1.2-2.5m -> Crisp Gold #facc15
          // Person -> Crisp White / Ice Cyan
          let strokeColor = '#38bdf8';
          let badgeBg = 'rgba(15, 23, 42, 0.9)';
          let badgeTextColor = '#ffffff';

          if (item.isApproachingFast) {
            strokeColor = '#ef4444';
            badgeBg = 'rgba(185, 28, 28, 0.95)';
            badgeTextColor = '#ffffff';
          } else if (isTargetMatch) {
            strokeColor = '#10b981';
            badgeBg = 'rgba(6, 78, 59, 0.95)';
            badgeTextColor = '#a7f3d0';
          } else if (item.proximityTier === 'danger') {
            strokeColor = '#ef4444';
            badgeBg = 'rgba(185, 28, 28, 0.95)';
            badgeTextColor = '#ffffff';
          } else if (isVehicle) {
            strokeColor = '#f97316'; // Orange for vehicles
            badgeBg = 'rgba(124, 45, 18, 0.95)';
            badgeTextColor = '#fed7aa';
          } else if (item.proximityTier === 'close') {
            strokeColor = '#facc15';
            badgeBg = 'rgba(113, 63, 18, 0.95)';
            badgeTextColor = '#fef08a';
          } else if (isPerson) {
            strokeColor = '#ffffff';
            badgeBg = 'rgba(0, 0, 0, 0.88)';
            badgeTextColor = '#f8fafc';
          }

          // A. Four Crisp Autofocus Corner Brackets ┌ ┐ └ ┘
          const bracketLen = Math.max(14, Math.min(28, Math.min(w, h) * 0.22));
          ctx.lineWidth = item.isApproachingFast || isTargetMatch ? 3.5 : 2;
          ctx.strokeStyle = strokeColor;

          // Top-Left ┌
          ctx.beginPath();
          ctx.moveTo(x, y + bracketLen);
          ctx.lineTo(x, y);
          ctx.lineTo(x + bracketLen, y);
          ctx.stroke();

          // Top-Right ┐
          ctx.beginPath();
          ctx.moveTo(x + w - bracketLen, y);
          ctx.lineTo(x + w, y);
          ctx.lineTo(x + w, y + bracketLen);
          ctx.stroke();

          // Bottom-Left └
          ctx.beginPath();
          ctx.moveTo(x, y + h - bracketLen);
          ctx.lineTo(x, y + h);
          ctx.lineTo(x + bracketLen, y + h);
          ctx.stroke();

          // Bottom-Right ┘
          ctx.beginPath();
          ctx.moveTo(x + w - bracketLen, y + h);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(x + w, y + h - bracketLen);
          ctx.stroke();

          // B. Center Camera Autofocus Crosshair (+)
          const cx = x + w / 2;
          const cy = y + h / 2;
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = strokeColor;
          ctx.beginPath();
          ctx.moveTo(cx - 5, cy);
          ctx.lineTo(cx + 5, cy);
          ctx.moveTo(cx, cy - 5);
          ctx.lineTo(cx, cy + 5);
          ctx.stroke();

          // C. Direction Stance & Badge Label
          let stanceTag = '';
          if (isPerson && item.personFacing) {
            stanceTag = ` • [${item.personFacing.toUpperCase()}]`;
          } else if (item.isApproachingFast) {
            stanceTag = ' • ⚠️ FAST APPROACH';
          }

          const cardinal = item.cardinalDirection ? ` (${item.cardinalDirection})` : '';
          const name = item.matchedPersonName
            ? item.matchedPersonName.toUpperCase()
            : item.class.toUpperCase();
          const icon = isPerson ? '👤 ' : isVehicle ? '🚗 ' : isTargetMatch ? '🎯 ' : '• ';

          const labelText = `${icon}${name}  ${item.estimatedMeters}m (${item.estimatedSteps} stp)  ${item.clockDirection}${cardinal}${stanceTag}`;

          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          const textMetrics = ctx.measureText(labelText);
          const tagW = textMetrics.width + 16;
          const tagH = 22;
          const tagX = Math.max(margin, Math.min(displayW - tagW - margin, x));
          const tagY = y > tagH + 8 ? y - tagH - 6 : y + h + 6;

          // Rounded tag pill
          ctx.fillStyle = badgeBg;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 6);
          ctx.fill();
          ctx.stroke();

          // Tag text
          ctx.fillStyle = badgeTextColor;
          ctx.textAlign = 'left';
          ctx.fillText(labelText, tagX + 8, tagY + 15);

          // Traffic light state badge
          if (item.trafficLightState && item.trafficLightState !== 'unknown') {
            const isGreen = item.trafficLightState === 'green';
            const lightMsg = isGreen ? '🟢 WALK SIGNAL: SAFE TO CROSS' : "🔴 STOP: DON'T WALK";
            ctx.fillStyle = isGreen ? 'rgba(6, 78, 59, 0.95)' : 'rgba(185, 28, 28, 0.95)';
            ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
            ctx.beginPath();
            ctx.roundRect(x, y + h + 12, 195, 22, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(lightMsg, x + 8, y + h + 27);
          }
        });

        // 5. Door Direction Guidance HUD with Turn Angle & Compass Bearing
        // Only show floating banner when user is actively searching for the door
        if (targetItem === 'door' && doorGuidance && doorGuidance.confidence > 0.35) {
          const doorTurn = doorGuidance.turnOffsetDeg === 0
            ? 'STRAIGHT AHEAD'
            : doorGuidance.turnOffsetDeg < 0
            ? `TURN ${Math.abs(doorGuidance.turnOffsetDeg)}° LEFT`
            : `TURN ${doorGuidance.turnOffsetDeg}° RIGHT`;

          const doorMsg = `🚪 DOOR LOCATED: ${doorGuidance.degrees}° ${doorGuidance.cardinalDirection} (${doorGuidance.direction}) • ${doorTurn} • ~${doorGuidance.meters}m (${doorGuidance.estimatedSteps} steps)`;
          const boxW = Math.min(displayW - 32, 420);
          const boxH = 28;
          ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(displayW / 2 - boxW / 2, displayH - 66, boxW, boxH, 8);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#6ee7b7';
          ctx.fillText(doorMsg, displayW / 2, displayH - 48);
        }

        // 6. Crosswalk / Zebra Crossing HUD (Outdoor / Road Mode only)
        if (isRoad && crosswalkDetected) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(displayW / 2 - 140, displayH - 98, 280, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000000';
          ctx.fillText('🦓 ZEBRA CROSSWALK DETECTED AHEAD', displayW / 2, displayH - 82);
        }

        // 7. Top-Down 3D Circular Radar Mini-Map (College Presentation Star!)
        // Renders an authentic LiDAR circular sweep in top-right
        const radarR = 46;
        const radarCX = displayW - radarR - 16;
        const radarCY = radarR + 56;

        // Background circle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeStyle = isRoadMode ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 211, 238, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(radarCX, radarCY, radarR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Range rings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(radarCX, radarCY, radarR * 0.5, 0, Math.PI * 2);
        ctx.arc(radarCX, radarCY, radarR * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        // Forward FOV cone (60 degrees)
        ctx.fillStyle = isRoadMode ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 211, 238, 0.12)';
        ctx.beginPath();
        ctx.moveTo(radarCX, radarCY);
        ctx.arc(radarCX, radarCY, radarR, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6);
        ctx.closePath();
        ctx.fill();

        // User center dot
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(radarCX, radarCY, 3, 0, Math.PI * 2);
        ctx.fill();

        // North Marker 'N'
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('N', radarCX, radarCY - radarR + 10);

        // Plot Detected Objects on 3D Top-Down Radar
        detections.forEach((d) => {
          // Angle in radar coordinates (-90 deg is straight ahead)
          const angleOffsetRad = ((d.relativeBearingDegrees || 0) * Math.PI) / 180;
          const angle = -Math.PI / 2 + angleOffsetRad;
          // Distance mapped to radius (up to 5 meters)
          const distClamped = Math.min(5, Math.max(0.5, d.estimatedMeters));
          const r = (distClamped / 5) * (radarR - 6);

          const blipX = radarCX + Math.cos(angle) * r;
          const blipY = radarCY + Math.sin(angle) * r;

          ctx.fillStyle = d.isApproachingFast
            ? '#ef4444'
            : d.isVehicle
            ? '#f97316'
            : d.class === 'person'
            ? '#ffffff'
            : '#22d3ee';

          ctx.beginPath();
          ctx.arc(blipX, blipY, d.isApproachingFast ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Vehicle velocity vector arrow towards user
          if (d.isApproachingFast) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(blipX, blipY);
            ctx.lineTo(radarCX + (blipX - radarCX) * 0.5, radarCY + (blipY - radarCY) * 0.5);
            ctx.stroke();
          }
        });

        // Plot Door on Radar if detected
        if (doorGuidance) {
          const doorAngleRad = -Math.PI / 2 + (doorGuidance.turnOffsetDeg * Math.PI) / 180;
          const doorR = (Math.min(5, doorGuidance.meters) / 5) * (radarR - 6);
          const dX = radarCX + Math.cos(doorAngleRad) * doorR;
          const dY = radarCY + Math.sin(doorAngleRad) * doorR;

          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(dX, dY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = isRoad ? '#f87171' : '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText(isRoad ? 'ROAD RADAR' : 'HOME LIDAR', radarCX, radarCY + radarR + 11);
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    detections,
    isCameraActive,
    videoRef,
    doorGuidance,
    targetItem,
    userHeading,
    isRoad,
    crosswalkDetected,
  ]);

  // Pointer and Touch Handling for Blind Users & Desktop Webcams
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isCurtainActive) {
      if (onToggleCurtain) onToggleCurtain();
      return;
    }
    isLongPressActiveRef.current = false;
    touchTimerRef.current = window.setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (onLongPressStart) {
        onLongPressStart();
        triggerVisualFeedback('Listening (Release to ask)...');
      }
    }, 500);
  };

  const handlePointerUp = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      if (onLongPressEnd) {
        onLongPressEnd();
        triggerVisualFeedback('Processing question...');
      }
      return;
    }

    // Accumulate taps within 320ms window: 1 tap (path check), 2 taps (describe room), 3 taps (curtain)
    tapCountRef.current += 1;
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = window.setTimeout(() => {
      const taps = tapCountRef.current;
      tapCountRef.current = 0;
      tapTimeoutRef.current = null;

      if (taps === 1) {
        if (onSingleTap) {
          onSingleTap();
          triggerVisualFeedback('Path Check');
        }
      } else if (taps === 2) {
        if (onDoubleTap) {
          onDoubleTap();
          triggerVisualFeedback('Scanning & Describing Room...');
        }
      } else if (taps >= 3) {
        if (onToggleCurtain) {
          onToggleCurtain();
          triggerVisualFeedback('Screen Curtain Toggled');
        }
      }
    }, 320);
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Clean full screen camera viewfinder with AI voice navigation. Single tap to check path or listen. Double tap to describe room. Hold anywhere to ask a question."
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden select-none cursor-pointer"
    >
      {/* 1. Live Camera Stream */}
      {isCameraActive ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
            aria-label="Live camera environment view"
          />

          {/* 2. Real-Time Camera HUD, Compass & Autofocus Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>
      ) : (
        /* Camera Standby View */
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-yellow-400/40 flex items-center justify-center text-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
            <VideoOff className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-white">Camera Viewfinder Paused</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Tap below or say <strong className="text-yellow-400">&quot;Hey Vision, start camera&quot;</strong> to begin live camera navigation with directional compass and road safety.
          </p>
          <button
            type="button"
            onClick={onToggleCamera}
            className="px-8 py-3.5 bg-yellow-400 text-black font-black rounded-2xl hover:bg-yellow-300 transition-all uppercase tracking-wider shadow-lg active:scale-95"
          >
            Start Camera View
          </button>
        </div>
      )}

      {/* 3. Eco Screen Curtain (OLED True Black Energy-Saver Mode) */}
      {isCurtainActive && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center p-6 text-center text-slate-500 pointer-events-auto"
        >
          <div className="w-14 h-14 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mb-4 text-emerald-500">
            <Leaf className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-slate-300">Screen Curtain Active</h4>
          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            Display is off to conserve power. Background AI navigation is actively running.
          </p>
          <p className="text-xs text-yellow-400 mt-4 font-mono font-bold">
            Tap anywhere to reveal screen
          </p>
        </div>
      )}

      {/* 4. Visual Gesture Feedback Toast */}
      {gestureFeedbackText && (
        <div className="absolute top-1/2 transform -translate-y-1/2 z-30 bg-black/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-yellow-400/50 text-yellow-300 text-sm font-extrabold shadow-2xl flex items-center space-x-2 pointer-events-none animate-fade-in">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>{gestureFeedbackText}</span>
        </div>
      )}
    </div>
  );
};
