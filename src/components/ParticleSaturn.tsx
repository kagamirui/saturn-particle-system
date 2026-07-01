import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
uniform float uTime;
uniform float uScale;
uniform float uNoiseIntensity;
uniform float uBrightness;

attribute float aIsRing;
attribute vec3 aRandom;

varying vec3 vColor;
varying float vAlpha;

// Simplex 3D Noise from https://github.com/stegu/webgl-noise/
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

vec3 snoise3(vec3 x) {
    return vec3(
        snoise(x),
        snoise(x + vec3(12.3, 45.6, 78.9)),
        snoise(x + vec3(78.9, 12.3, 45.6))
    );
}

void main() {
    vec3 pos = position;

    if (aIsRing > 0.5) {
        // Ring particle
        float r = length(pos.xz);
        // Kepler's law: speed proportional to r^(-1.5)
        float speed = 1.0 / pow(max(r, 0.1), 1.5) * 5.0; 
        float angle = uTime * speed;
        
        float s = sin(angle);
        float c = cos(angle);
        pos.x = position.x * c - position.z * s;
        pos.z = position.x * s + position.z * c;
    } else {
        // Core particle - slow rotation
        float angle = uTime * 0.15;
        float s = sin(angle);
        float c = cos(angle);
        pos.x = position.x * c - position.z * s;
        pos.z = position.x * s + position.z * c;
    }
    
    pos *= uScale;
    
    // High frequency chaotic noise when particles get huge and close to screen
    if (uNoiseIntensity > 0.0) {
        // Noise frequency based on random value and time
        float freq = 2.0;
        vec3 noiseOffset = snoise3(pos * freq + uTime * 3.0) * aRandom * uNoiseIntensity * 2.0;
        pos += noiseOffset;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation with a bit of randomness
    float sizeBase = (aIsRing > 0.5) ? 25.0 : 35.0;
    gl_PointSize = (sizeBase * (1.0 + aRandom.x)) / -mvPosition.z;
    // Increase point size slightly when chaos happens to look more dramatic
    gl_PointSize *= (1.0 + uNoiseIntensity * 0.5);
    
    if (aIsRing > 0.5) {
        // Ring colors (Gold, dusty, earthy)
        vec3 c1 = vec3(0.95, 0.75, 0.5);
        vec3 c2 = vec3(0.6, 0.45, 0.3);
        vec3 c3 = vec3(0.85, 0.8, 0.75);
        
        float mixFactor = aRandom.y;
        vColor = mix(mix(c1, c2, mixFactor), c3, aRandom.z);
        // Add subtle radial variation based on initial radius
        float r = length(position.xz);
        vColor *= 0.8 + 0.2 * sin(r * 10.0);
    } else {
        // Core colors (Gas giant stripes, darker overall than rings)
        vec3 c1 = vec3(0.7, 0.55, 0.4);
        vec3 c2 = vec3(0.85, 0.75, 0.6);
        
        // Use initial Y position for latitudinal stripes
        float lat = position.y / 2.0; 
        float stripe = snoise(vec3(0.0, lat * 5.0, 0.0));
        vColor = mix(c1, c2, (stripe + 1.0) * 0.5 + aRandom.x * 0.2);
    }
    
    vAlpha = mix(0.4, 0.9, aRandom.z);
    
    // Dynamic brightness based on scale
    vColor *= uBrightness;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;

void main() {
    vec2 xy = gl_PointCoord.xy - vec2(0.5);
    float ll = length(xy);
    if (ll > 0.5) discard;
    
    // Soft circular glow
    float alpha = (0.5 - ll) * 2.0 * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
}
`;

interface ParticleSaturnProps {
  openness: number;
}

export function ParticleSaturn({ openness }: ParticleSaturnProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Generate particle data
  const { positions, isRing, randoms, count } = useMemo(() => {
    const particleCount = 250000;
    const pos = new Float32Array(particleCount * 3);
    const ringFlag = new Float32Array(particleCount);
    const rand = new Float32Array(particleCount * 3);
    
    const coreCount = Math.floor(particleCount * 0.25);
    const ringCount = particleCount - coreCount;
    
    let i3 = 0;
    for(let i = 0; i < coreCount; i++) {
       const r = Math.pow(Math.random(), 1/3) * 2.0; // uniform in sphere
       const theta = Math.acos(2 * Math.random() - 1);
       const phi = Math.random() * Math.PI * 2;
       
       pos[i3] = r * Math.sin(theta) * Math.cos(phi);
       pos[i3+1] = r * Math.sin(theta) * Math.sin(phi) * 0.9; // Slightly oblate
       pos[i3+2] = r * Math.cos(theta);
       
       ringFlag[i] = 0.0;
       
       rand[i3] = Math.random();
       rand[i3+1] = Math.random();
       rand[i3+2] = Math.random();
       
       i3 += 3;
    }
    
    for(let i = 0; i < ringCount; i++) {
       // Main rings: roughly 3.0 to 7.0
       let r = 3.0 + Math.random() * 4.0;
       
       // Create Cassini division gap (approx 4.8 to 5.0)
       if (r > 4.75 && r < 5.05) {
           r = Math.random() > 0.5 ? 4.75 - Math.random() * 0.2 : 5.05 + Math.random() * 0.2;
       }
       // Add an outer thin ring (e.g., F ring)
       if (Math.random() > 0.95) {
           r = 7.5 + Math.random() * 0.2;
       }
       
       const angle = Math.random() * Math.PI * 2;
       
       pos[i3] = r * Math.cos(angle);
       // Flat disk with slight thickness that tapers at edges
       const thickness = 0.05 * (1.0 - (r - 3.0)/4.5);
       pos[i3+1] = (Math.random() - 0.5) * thickness; 
       pos[i3+2] = r * Math.sin(angle);
       
       ringFlag[i + coreCount] = 1.0;
       
       rand[i3] = Math.random();
       rand[i3+1] = Math.random();
       rand[i3+2] = Math.random();
       
       i3 += 3;
    }
    
    return { positions: pos, isRing: ringFlag, randoms: rand, count: particleCount };
  }, []);

  // Update uniforms on every frame based on openness and time
  const targetScale = useRef(1.0);
  
  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      
      // Map openness (0 to 1) to scale
      let desiredScale = 1.0;
      if (openness < 0.5) {
        // Map 0.0 -> 0.5 to 0.2 -> 1.0
        const t = openness / 0.5; 
        desiredScale = 0.2 + t * 0.8;
      } else {
        // Map 0.5 -> 1.0 to 1.0 -> 6.0 with an exponential curve for dramatic explosion
        const t = (openness - 0.5) / 0.5;
        desiredScale = 1.0 + Math.pow(t, 2.0) * 5.0;
      }
      
      // Smooth interpolation for scale
      targetScale.current += (desiredScale - targetScale.current) * 8.0 * delta;
      const currentScale = targetScale.current;
      materialRef.current.uniforms.uScale.value = currentScale;
      
      // Noise logic
      // Trigger when scale is large (e.g. > 3.0)
      let noiseLevel = 0.0;
      if (currentScale > 3.0) {
        noiseLevel = (currentScale - 3.0) / 3.0; // 0.0 to 1.0 (since max scale is 6)
        // Exponentially increase noise severity
        noiseLevel = Math.pow(noiseLevel, 2.0) * 2.0; 
      }
      materialRef.current.uniforms.uNoiseIntensity.value = noiseLevel;
      
      // Brightness logic
      // Small -> dark, Large -> normal (1.0)
      // "土星，小的时候，亮度应该是发生变化的(小暗，大亮，就像灯光一样的物理规律)"
      // Let's map scale 0.3 -> brightness 0.1, scale 1.0 -> brightness 1.0, scale > 1.0 -> brightness 1.0
      let brightness = Math.max(0.1, Math.min(1.0, Math.pow(currentScale, 1.5)));
      materialRef.current.uniforms.uBrightness.value = brightness;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aIsRing"
          count={count}
          array={isRing}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={randoms}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uScale: { value: 1.0 },
          uNoiseIntensity: { value: 0.0 },
          uBrightness: { value: 1.0 },
        }}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
