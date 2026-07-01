import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function useHandTracker(videoElement: HTMLVideoElement | null) {
  const [openness, setOpenness] = useState(0.5);
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let active = true;
    let requestRef: number;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        if (!active) return;
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        if (!active) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setIsReady(true);

        let lastVideoTime = -1;
        function detect() {
          if (videoElement && videoElement.readyState >= 2 && landmarkerRef.current) {
            const startTimeMs = performance.now();
            if (videoElement.currentTime !== lastVideoTime) {
              lastVideoTime = videoElement.currentTime;
              const results = landmarkerRef.current.detectForVideo(videoElement, startTimeMs);
              if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                
                // Calculate average distance from wrist to all fingertips
                const wrist = landmarks[0];
                let totalDistance = 0;
                const tips = [4, 8, 12, 16, 20];
                tips.forEach(tipIdx => {
                  const tip = landmarks[tipIdx];
                  const dx = tip.x - wrist.x;
                  const dy = tip.y - wrist.y;
                  const dz = tip.z - wrist.z;
                  totalDistance += Math.sqrt(dx*dx + dy*dy + dz*dz);
                });
                const avgDistance = totalDistance / tips.length;
                
                // Normalization bounds based on generic hand sizes in normalized coords
                const minD = 0.20; // Closed fist
                const maxD = 0.45; // Fully open
                let currentOpenness = (avgDistance - minD) / (maxD - minD);
                currentOpenness = Math.max(0, Math.min(1, currentOpenness));
                
                // Exponential smoothing to reduce jitter
                setOpenness(prev => prev * 0.85 + currentOpenness * 0.15);
              } else {
                // Decay to 0.5 when no hand is detected
                setOpenness(prev => prev * 0.95 + 0.5 * 0.05);
              }
            }
          }
          requestRef = requestAnimationFrame(detect);
        }
        detect();
      } catch (err) {
        console.error("Failed to initialize hand landmarker:", err);
      }
    }

    if (videoElement) {
      init();
    }

    return () => {
      active = false;
      cancelAnimationFrame(requestRef);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, [videoElement]);

  return { openness, isReady };
}
