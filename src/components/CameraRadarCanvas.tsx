import React, { useRef, useEffect } from 'react';
import { Compass, ShieldAlert, VideoOff } from 'lucide-react';
import type { DetectedObject } from '../types';

interface CameraRadarCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detections: DetectedObject[];
  isCameraActive: boolean;
  onToggleCamera: () => void;
  doorGuidance?: { direction: string; confidence: number; meters: number } | null;
}

export const CameraRadarCanvas: React.FC<CameraRadarCanvasProps> = ({
  videoRef,
  detections,
  isCameraActive,
  onToggleCamera,
  doorGuidance,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check if any obstacle is in Immediate Danger tier (< 1.2m)
  const dangerObstacle = detections.find((d) => d.proximityTier === 'danger');

  // Draw real-time HUD overlays, bounding boxes, clock labels and zone dividers
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !isCameraActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      if (video.readyState >= 2) {
        // Match canvas dimensions to display size
        const width = video.videoWidth || canvas.clientWidth || 640;
        const height = video.videoHeight || canvas.clientHeight || 480;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        ctx.clearRect(0, 0, width, height);

        // 1. Draw 3 Horizontal Spatial Zone Dividers
        const leftBoundary = width * 0.35;
        const rightBoundary = width * 0.65;

        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);

        // Left boundary (10 o'clock | 12 o'clock)
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        ctx.beginPath();
        ctx.moveTo(leftBoundary, 0);
        ctx.lineTo(leftBoundary, height);
        ctx.stroke();

        // Right boundary (12 o'clock | 2 o'clock)
        ctx.beginPath();
        ctx.moveTo(rightBoundary, 0);
        ctx.lineTo(rightBoundary, height);
        ctx.stroke();

        ctx.setLineDash([]); // Reset dash

        // Zone header tags
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';

        // 10 o'clock zone
        ctx.fillStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.fillText("10 O'CLOCK (LEFT)", leftBoundary / 2, 28);

        // 12 o'clock zone
        ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.fillText("12 O'CLOCK (AHEAD)", (leftBoundary + rightBoundary) / 2, 28);

        // 2 o'clock zone
        ctx.fillStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.fillText("2 O'CLOCK (RIGHT)", (rightBoundary + width) / 2, 28);

        // 2. Draw Detected Objects Bounding Boxes
        detections.forEach((item) => {
          const [x, y, w, h] = item.bbox;

          // Color scheme by proximity tier
          let strokeColor = '#22d3ee'; // cyan for far
          let badgeBg = '#0e7490';
          let textColor = '#ffffff';

          if (item.proximityTier === 'danger') {
            strokeColor = '#ef4444'; // red for danger < 1.2m
            badgeBg = '#dc2626';
          } else if (item.proximityTier === 'close') {
            strokeColor = '#facc15'; // neon yellow for close
            badgeBg = '#ca8a04';
            textColor = '#000000';
          }

          // Bounding Box
          ctx.lineWidth = item.proximityTier === 'danger' ? 4 : 2.5;
          ctx.strokeStyle = strokeColor;
          ctx.strokeRect(x, y, w, h);

          // Corner accents for high-contrast accessibility
          const cornerSize = Math.min(20, Math.min(w, h) / 3);
          ctx.lineWidth = 4;
          // Top-left
          ctx.beginPath();
          ctx.moveTo(x, y + cornerSize);
          ctx.lineTo(x, y);
          ctx.lineTo(x + cornerSize, y);
          ctx.stroke();

          // Bottom-right
          ctx.beginPath();
          ctx.moveTo(x + w, y + h - cornerSize);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(x + w - cornerSize, y + h);
          ctx.stroke();

          // Badge label text
          const displayName = item.matchedPersonName
            ? `👤 ${item.matchedPersonName.toUpperCase()}`
            : item.class.toUpperCase();
          const labelText = `${displayName} | ${item.clockDirection} | ${item.estimatedMeters}m (${item.estimatedSteps} steps)`;

          ctx.font = 'bold 13px sans-serif';
          const textWidth = ctx.measureText(labelText).width;
          const badgeHeight = 24;

          // Badge background
          ctx.fillStyle = badgeBg;
          ctx.fillRect(x, Math.max(0, y - badgeHeight), textWidth + 14, badgeHeight);

          // Badge text
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.fillText(labelText, x + 7, Math.max(16, y - 7));
        });

        // 3. Draw Door / Exit heuristic indicator if active
        if (doorGuidance && doorGuidance.confidence > 0.4) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          const doorMsg = `🚪 DOORWAY DETECTED: ${doorGuidance.direction} (~${doorGuidance.meters}m)`;
          ctx.fillRect(width / 2 - 160, height - 42, 320, 28);
          ctx.fillStyle = '#000000';
          ctx.fillText(doorMsg, width / 2, height - 23);
        }
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [detections, isCameraActive, videoRef, doorGuidance]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#050505] overflow-hidden">
      {/* Video Stream */}
      {isCameraActive ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
            aria-label="Rear camera live obstacle detection view"
          />
          {/* Real-time HUD Canvas Overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none object-cover"
          />
        </div>
      ) : (
        /* Camera Off State */
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-slate-500">
            <VideoOff className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-white">Camera is in Standby</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            Say <strong className="text-yellow-400">&quot;Hey Vision, start camera&quot;</strong> or tap below to enable live obstacle guidance.
          </p>
          <button
            type="button"
            onClick={onToggleCamera}
            className="px-6 py-3 bg-yellow-400 text-black font-extrabold rounded-2xl hover:bg-yellow-300 transition-colors uppercase tracking-wider shadow-lg"
          >
            Turn On Camera
          </button>
        </div>
      )}

      {/* Immediate Danger Warning Banner */}
      {dangerObstacle && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute top-4 inset-x-4 sm:inset-x-8 z-30 bg-red-600/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.8)] border-2 border-red-300 flex items-center justify-between animate-bounce"
        >
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-yellow-300" />
            <div>
              <p className="text-sm sm:text-base font-black uppercase tracking-wider text-yellow-300">
                IMMEDIATE DANGER AHEAD!
              </p>
              <p className="text-xs sm:text-sm font-semibold">
                {dangerObstacle.matchedPersonName || dangerObstacle.class} at {dangerObstacle.clockDirection} &lt; 1.2m! Stop walking.
              </p>
            </div>
          </div>
          <span className="text-xs font-black uppercase bg-black/60 px-3 py-1.5 rounded-lg border border-red-400">
            &lt; 1.2M
          </span>
        </div>
      )}

      {/* Top HUD Status Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 pointer-events-none">
        <div className="flex items-center space-x-1.5 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 text-xs font-mono text-cyan-300 shadow">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>RADAR ACTIVE</span>
        </div>
        <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 text-xs font-mono text-yellow-300 shadow">
          <span>{detections.length} OBJECTS</span>
        </div>
      </div>

      {/* Mini Compass Radar Widget in Top Right */}
      <div className="absolute top-4 right-4 z-20 bg-black/80 backdrop-blur-md p-2.5 rounded-2xl border border-slate-700 flex flex-col items-center space-y-1 shadow pointer-events-none">
        <div className="relative w-12 h-12 rounded-full border-2 border-cyan-400/40 flex items-center justify-center">
          {/* Radar sweeping line */}
          <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-radar-sweep" />
          <Compass className="w-6 h-6 text-yellow-400" />
          {/* Small blips */}
          {detections.slice(0, 4).map((d, i) => {
            let leftPercent = '50%';
            if (d.zone === 'left') leftPercent = '20%';
            if (d.zone === 'right') leftPercent = '80%';
            let topPercent = '40%';
            if (d.proximityTier === 'danger') topPercent = '65%';
            if (d.proximityTier === 'far') topPercent = '20%';

            return (
              <span
                key={i}
                style={{ left: leftPercent, top: topPercent }}
                className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                  d.proximityTier === 'danger'
                    ? 'bg-red-500 animate-ping'
                    : d.proximityTier === 'close'
                    ? 'bg-yellow-400'
                    : 'bg-cyan-400'
                }`}
              />
            );
          })}
        </div>
        <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">
          3D RADAR
        </span>
      </div>
    </div>
  );
};
