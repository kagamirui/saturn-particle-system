import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

function assetUrl(path: string) {
  const baseUrl = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL;
  return new URL(`${baseUrl}${path}`, window.location.origin).toString();
}

const WASM_URL = assetUrl("mediapipe/wasm");
const HAND_MODEL_URL = assetUrl("mediapipe/models/hand_landmarker.task");

function distance(a: Landmark, b: Landmark) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function angleAtJoint(a: Landmark, joint: Landmark, c: Landmark) {
  const ab = { x: a.x - joint.x, y: a.y - joint.y, z: (a.z ?? 0) - (joint.z ?? 0) };
  const cb = { x: c.x - joint.x, y: c.y - joint.y, z: (c.z ?? 0) - (joint.z ?? 0) };
  const abLength = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z);
  const cbLength = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z);
  if (abLength === 0 || cbLength === 0) return 0;

  const cosine = clamp01((ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / (abLength * cbLength) * 0.5 + 0.5);
  return Math.acos(cosine * 2 - 1) * 180 / Math.PI;
}

function calculateOpenness(landmarks: Landmark[]) {
  const wrist = landmarks[0];
  const fingers = [
    { mcp: 5, pip: 6, tip: 8 },
    { mcp: 9, pip: 10, tip: 12 },
    { mcp: 13, pip: 14, tip: 16 },
    { mcp: 17, pip: 18, tip: 20 },
  ];

  const palmSize = fingers.reduce((sum, finger) => sum + distance(wrist, landmarks[finger.mcp]), 0) / fingers.length;
  const angleScore = fingers.reduce((sum, finger) => {
    const angle = angleAtJoint(landmarks[finger.mcp], landmarks[finger.pip], landmarks[finger.tip]);
    return sum + clamp01((angle - 75) / 95);
  }, 0) / fingers.length;

  const tipDistanceScore = palmSize > 0
    ? clamp01(((fingers.reduce((sum, finger) => sum + distance(wrist, landmarks[finger.tip]), 0) / fingers.length) / palmSize - 1.2) / 0.8)
    : angleScore;

  return clamp01(angleScore * 0.75 + tipDistanceScore * 0.25);
}

async function createLandmarker(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>) {
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  } catch (gpuError) {
    console.warn("GPU hand tracking failed, falling back to CPU:", gpuError);
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  }
}

export function useHandTracker(videoElement: HTMLVideoElement | null) {
  const [openness, setOpenness] = useState(0.5);
  const [isReady, setIsReady] = useState(false);
  const [hasHand, setHasHand] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let active = true;
    let requestRef = 0;

    async function init() {
      try {
        setIsReady(false);
        setHasHand(false);
        setError(null);

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (!active) return;
        const landmarker = await createLandmarker(vision);
        if (!active) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setIsReady(true);

        let lastDetectTime = 0;
        function detect() {
          if (
            videoElement &&
            videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            videoElement.videoWidth > 0 &&
            landmarkerRef.current
          ) {
            const startTimeMs = performance.now();
            if (startTimeMs - lastDetectTime > 33) {
              lastDetectTime = startTimeMs;
              const results = landmarkerRef.current.detectForVideo(videoElement, startTimeMs);
              if (results.landmarks && results.landmarks.length > 0) {
                const currentOpenness = calculateOpenness(results.landmarks[0]);
                setHasHand(true);
                setOpenness(prev => prev * 0.85 + currentOpenness * 0.15);
              } else {
                setHasHand(false);
                setOpenness(prev => prev * 0.95 + 0.5 * 0.05);
              }
            }
          }
          requestRef = requestAnimationFrame(detect);
        }
        detect();
      } catch (err) {
        console.error("Failed to initialize hand landmarker:", err);
        setError("HAND TRACKER ERROR");
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
        landmarkerRef.current = null;
      }
    };
  }, [videoElement]);

  return { openness, isReady, hasHand, error };
}
