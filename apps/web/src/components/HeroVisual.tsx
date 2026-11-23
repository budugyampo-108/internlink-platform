'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Hero3D = dynamic(() => import('./Hero3D'), { ssr: false });

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Loads the 3D scene only AFTER first paint/idle so it never delays the headline or CTAs (LCP). */
export function HeroVisual() {
  const [mode, setMode] = useState<'pending' | 'webgl' | 'static'>('pending');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const r = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(r);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const start = () => setMode(!saveData && hasWebGL() ? 'webgl' : 'static');
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(start, { timeout: 1200 });
    else setTimeout(start, 300);
  }, []);

  return (
    <div className="hero-visual" role="img" aria-label="Illustration: a globe connecting students to nearby companies">
      {mode !== 'webgl' && <div className="hero-fallback" />}
      {mode === 'webgl' && <Hero3D reduced={reduced} />}
      <div className="hero-legend" aria-hidden="true">
        <span><i className="dot" style={{ background: '#2dd4bf' }} />Students</span>
        <span><i className="dot" style={{ background: '#fbbf24' }} />Companies</span>
      </div>
    </div>
  );
}
