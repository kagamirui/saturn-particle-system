/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Maximize, Minimize, Camera, Loader2 } from 'lucide-react';
import { ParticleSaturn } from './components/ParticleSaturn';
import { useHandTracker } from './useHandTracker';
import { cn } from './lib/utils';

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    setVideoElement(node);
  }, []);
  
  // Setup webcam
  useEffect(() => {
    if (!videoElement) return;
    let stream: MediaStream | null = null;
    setIsCameraReady(false);
    
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    })
      .then(async s => {
        stream = s;
        videoElement.srcObject = s;
        videoElement.muted = true;
        videoElement.playsInline = true;
        await videoElement.play();
        setIsCameraReady(true);
      })
      .catch(err => console.error("Error accessing webcam:", err));
      
    return () => {
      videoElement.srcObject = null;
      setIsCameraReady(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoElement]);

  const { openness, isReady, hasHand, error: trackerError } = useHandTracker(videoElement);
  const trackingStatus = trackerError
    ? trackerError
    : !isReady
      ? 'LOADING AI'
      : hasHand
        ? openness > 0.6 ? 'HAND OPEN' : openness < 0.4 ? 'FIST' : 'TRACKING'
        : 'SHOW HAND';
  const statusColor = trackerError ? '#ff4d4f' : hasHand ? '#00ffaa' : '#ffae42';

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-screen overflow-hidden font-sans text-white select-none"
      style={{ background: 'radial-gradient(circle at 50% 50%, #1a120b 0%, #030305 70%)', backgroundColor: '#030305' }}
    >
      {/* 3D Scene */}
      <div className="absolute inset-0 cursor-move">
        <Canvas camera={{ position: [0, 8, 15], fov: 45 }}>
          <color attach="background" args={['#000000']} />
          <OrbitControls 
            enablePan={false} 
            minDistance={2} 
            maxDistance={30} 
            autoRotate 
            autoRotateSpeed={0.5} 
          />
          <ParticleSaturn openness={openness} />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 sm:p-10 flex justify-between items-start pointer-events-none z-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-[14px] font-[200] tracking-[0.3em] uppercase text-white">SATURN</h1>
          <p className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] py-2 px-4 rounded flex items-center gap-2.5 backdrop-blur-md text-[11px] tracking-[0.08em] sm:tracking-[1px] uppercase text-[rgba(255,255,255,0.85)] max-w-[170px] sm:max-w-none">
            <span
              className="w-1.5 h-1.5 rounded-full block"
              style={{ backgroundColor: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
            ></span>
            GESTURE: {trackingStatus}
          </p>
        </div>
        
        <button 
          onClick={toggleFullscreen}
          className="pointer-events-auto bg-white text-black w-14 h-14 sm:w-auto sm:h-auto sm:py-3 sm:px-6 rounded-[100px] text-[12px] font-semibold flex items-center justify-center gap-2 uppercase tracking-[1px] cursor-pointer hover:bg-gray-200 transition-colors"
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize size={16} strokeWidth={2.5} /> : <Maximize size={16} strokeWidth={2.5} />}
          <span className="hidden sm:inline">Fullscreen View</span>
        </button>
      </div>

      {/* Camera feed and Status */}
      <div className="absolute bottom-44 right-4 sm:bottom-10 sm:right-10 flex items-end gap-4 sm:gap-6 pointer-events-none z-20">
        {/* Openness indicator */}
        <div className="flex flex-col items-center gap-3 mb-1">
          <div className="w-1.5 h-24 sm:h-32 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
            <div 
              className="w-full bg-[#ffae42] transition-all duration-75 ease-out rounded-full origin-bottom"
              style={{ height: `${openness * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.5)] tracking-wider">SCALE</span>
        </div>

        {/* Video feed */}
        <div className="relative rounded-[12px] overflow-hidden border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] backdrop-blur-[15px] shadow-2xl w-28 sm:w-40 aspect-video flex items-center justify-center p-2">
          <video 
            ref={setVideoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-500", 
              isCameraReady ? "opacity-50" : "opacity-0"
            )}
            autoPlay
            playsInline 
            muted 
          />
          {!isReady && (
            <div className="flex flex-col items-center gap-2 text-[rgba(255,255,255,0.5)] z-10">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] font-mono tracking-wider">LOADING AI...</span>
            </div>
          )}
          {isReady && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[rgba(0,0,0,0.5)] px-2 py-1 rounded text-[9px] font-mono border border-[rgba(255,255,255,0.05)] backdrop-blur-md">
              <Camera size={10} />
              <span style={{ color: statusColor }}>{hasHand ? 'TRACKING' : 'SHOW HAND'}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-5 left-4 right-4 sm:bottom-10 sm:left-10 sm:right-auto max-w-none sm:max-w-sm pointer-events-none z-20">
        <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[15px] border border-[rgba(255,255,255,0.1)] p-5 sm:p-6 rounded-[12px] text-[11px] text-[rgba(255,255,255,0.85)] font-mono w-full sm:w-[280px]">
          <p className="flex justify-between mb-3">
            <strong className="opacity-50 uppercase font-normal">Controls</strong>
            <span>Hold hand in camera</span>
          </p>
          <ul className="space-y-3">
            <li className="flex justify-between">
              <strong className="opacity-50 uppercase font-normal">Open Hand</strong>
              <span className="text-[#00ffaa]">Expand particles</span>
            </li>
            <li className="flex justify-between">
              <strong className="opacity-50 uppercase font-normal">Closed Fist</strong>
              <span>Contract particles</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
