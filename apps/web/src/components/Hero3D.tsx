'use client';
/**
 * Lightweight 3D hero: a dotted globe ("where you are") with glowing arcs between
 * student nodes (teal) and company nodes (amber) ("who needs you").
 *  – ~1k points + 8 arcs → a single draw call per primitive, no textures, no model files.
 *  – three + R3F are code-split (loaded via next/dynamic from HeroVisual, after idle).
 *  – paused when off-screen / tab hidden; static fallback for reduced-motion or no WebGL.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const R = 2;
const toVec = (latDeg: number, lngDeg: number, r = R) => {
  const lat = (latDeg * Math.PI) / 180;
  const lng = (lngDeg * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(lat) * Math.sin(lng), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lng));
};

// Illustrative nodes (lat, lng): students ↔ companies across regions.
const STUDENTS: [number, number][] = [[5.6, -0.2], [6.7, -1.6], [9.4, -0.8], [6.1, 1.2]];
const COMPANIES: [number, number][] = [[5.55, -0.18], [7.9, -1.0], [6.7, -1.6], [9.0, -0.9]];

function Scene({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const packets = useRef<(THREE.Mesh | null)[]>([]);

  const { dots, curves, lines } = useMemo(() => {
    const n = 1100;
    const arr = new Float32Array(n * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      arr.set([Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R], i * 3);
    }
    const curves = STUDENTS.map((s, i) => {
      const a = toVec(s[0], s[1]);
      const b = toVec(COMPANIES[i][0] + 6, COMPANIES[i][1] + 9 * (i % 2 ? 1 : -1));
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.55);
      return new THREE.QuadraticBezierCurve3(a, mid, b);
    });
    const mat = new THREE.LineBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.75 });
    const lines = curves.map((c) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(48)), mat));
    return { dots: arr, curves, lines };
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (!reduced) g.rotation.y += dt * 0.14;
    // gentle pointer parallax
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.25 + state.pointer.y * -0.2, 0.05);
    g.position.x = THREE.MathUtils.lerp(g.position.x, state.pointer.x * 0.25, 0.05);
    const t = state.clock.elapsedTime;
    curves.forEach((c, i) => {
      const m = packets.current[i];
      if (m) m.position.copy(c.getPoint(((t * 0.18 + i * 0.25) % 1) as number));
    });
  });

  return (
    <group ref={group} rotation={[0.25, 0, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dots, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color="#8ea2ff" sizeAttenuation transparent opacity={0.85} />
      </points>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      {STUDENTS.map(([la, ln], i) => (
        <mesh key={`s${i}`} position={toVec(la, ln, R * 1.01)}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshBasicMaterial color="#2dd4bf" />
        </mesh>
      ))}
      {curves.map((c, i) => (
        <mesh key={`c${i}`} position={c.v2}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
      {curves.map((_, i) => (
        <mesh key={`p${i}`} ref={(el) => { packets.current[i] = el; }}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

export default function Hero3D({ reduced }: { reduced: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6.2], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}
        frameloop={visible && tabVisible && !reduced ? 'always' : 'demand'}
      >
        <Scene reduced={reduced} />
      </Canvas>
    </div>
  );
}
