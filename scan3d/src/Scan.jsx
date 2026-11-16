import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel, applyLayers, Y_MIN, Y_MAX } from './model.js';

const AUTO_SPEED = 0.17;       // rad/s di rotazione lenta
const FOV = 26;
const SWEEP_SECONDS = 2.7;

const NOTES = {
  surface: 'La scansione digitale riduce la necessità di impronte tradizionali e crea un modello 3D delle arcate.',
  xray: 'La TAC cone beam dà una visione tridimensionale di denti, radici e ossa, utile nella pianificazione.',
};

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function Scene({ mode, go, replay, reduced, ctl, onFirstFrame }) {
  const { gl, scene, camera } = useThree();
  const model = useMemo(() => buildModel(), []);
  const S = useRef({ active: null, running: false, t0: 0, started: false, lastReplay: 0 });
  const first = useRef(false);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // luce d'ambiente morbida, generata nel codice (nessun file da scaricare)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.42;
    pm.dispose();
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);
  useEffect(() => () => model.dispose(), [model]);

  const finish = () => {
    const s = S.current;
    s.running = false;
    applyLayers(model.layers, s.active, null);
    model.shared.scanY.value = 100;
    model.shared.glow.value = 0;
  };
  const begin = (next, prev) => {
    const s = S.current;
    s.active = next;
    s.t0 = performance.now();
    if (reducedRef.current) { finish(); return; }
    s.running = true;
    applyLayers(model.layers, next, prev);
    model.shared.scanY.value = Y_MIN;
    model.shared.glow.value = 1;
  };

  // la prima scansione parte quando la sezione è davvero in vista
  useEffect(() => {
    if (!go) return;
    const s = S.current;
    if (!s.started) { s.started = true; begin(mode, 'points'); }
    else if (mode !== s.active) begin(mode, s.active);
  }, [go, mode]);
  useEffect(() => {
    const s = S.current;
    if (go && s.started && replay !== s.lastReplay) { s.lastReplay = replay; begin(mode, 'points'); }
  }, [replay]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const c = ctl.current;
    const s = S.current;

    if (!c.drag) {
      c.idle += dt;
      const target = !reduced && c.spin && c.idle > 1 ? AUTO_SPEED : 0;
      c.vel += (target - c.vel) * Math.min(1, dt * 1.6);
      c.rot += c.vel * dt;
    }
    model.pivot.rotation.y = c.rot;

    // la camera si adatta alla larghezza del riquadro, così il modello non esce mai
    const aspect = state.size.width / Math.max(1, state.size.height);
    const R = Math.max(18.5, 10.6 / (2 * Math.tan((FOV * Math.PI) / 360) * aspect));
    c.tilt += (c.tiltTarget - c.tilt) * Math.min(1, dt * 4);
    const el = c.elev + c.tilt;
    camera.position.set(0, R * Math.sin(el), R * Math.cos(el));
    camera.lookAt(0, 0, 0);

    if (s.running) {
      // tempo vero, non somma di fotogrammi: la scansione dura sempre lo stesso, anche su un telefono lento
      const p = Math.min(1, (performance.now() - s.t0) / (SWEEP_SECONDS * 1000));
      model.shared.scanY.value = Y_MIN + (Y_MAX - Y_MIN) * easeInOut(p);
      if (p >= 1) finish();
    }
    model.pointsMaterial.uniforms.uPR.value = state.gl.getPixelRatio();

    if (!first.current) { first.current = true; onFirstFrame(); }
  });

  return (
    <>
      <primitive object={model.root} />
      <hemisphereLight args={['#e8eaff', '#2a1c18', 0.34]} />
      <directionalLight position={[4, 7, 6]} intensity={2.1} color="#fff1e0" />
      <directionalLight position={[-6, 2, 4]} intensity={0.75} color="#cfd8ff" />
      <directionalLight position={[0, 4, -8]} intensity={1.5} />
    </>
  );
}

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('Scansione 3D non disponibile:', err); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function Scan({ reduced: reducedAtStart }) {
  const [mode, setMode] = useState('surface');
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [replay, setReplay] = useState(0);
  const [hint, setHint] = useState(true);
  const [reduced, setReduced] = useState(reducedAtStart);
  const ctl = useRef({ rot: -0.55, vel: 0, drag: false, lastX: 0, lastT: 0, idle: 0, elev: 0.2, tilt: 0, tiltTarget: 0, spin: true });
  const [spin, setSpin] = useState(true);
  ctl.current.spin = spin;
  const view = useRef(null);
  const bar = useMemo(() => document.querySelector('[data-scan3d-bar]'), []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(view.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(t);
  }, [hint]);

  const onReady = () => {
    setReady(true);
    const stage = document.querySelector('[data-scan3d]');
    if (stage) stage.classList.add('is-ready');
    const tech = document.querySelector('.tech');
    if (tech) tech.classList.add('is-3d');
  };

  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const c = ctl.current;
    c.drag = true; c.lastX = e.clientX; c.lastT = performance.now(); c.vel = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setHint(false);
  };
  const move = (e) => {
    const c = ctl.current;
    if (c.drag) {
      const now = performance.now();
      const dx = e.clientX - c.lastX;
      const dt = Math.max(0.001, (now - c.lastT) / 1000);
      c.rot += dx * 0.009;
      c.vel = 0.7 * c.vel + 0.3 * ((dx * 0.009) / dt);
      c.lastX = e.clientX; c.lastT = now;
    } else if (e.pointerType === 'mouse' && !reduced) {
      const r = e.currentTarget.getBoundingClientRect();
      c.tiltTarget = ((e.clientY - r.top) / r.height - 0.5) * 0.22;
    }
  };
  const up = () => {
    const c = ctl.current;
    c.drag = false; c.idle = 0;
    c.vel = Math.max(-5, Math.min(5, c.vel));
  };
  const leave = () => { ctl.current.tiltTarget = 0; };
  const key = (e) => {
    const c = ctl.current;
    if (e.key === 'ArrowLeft') { c.rot -= 0.25; c.idle = 0; e.preventDefault(); setHint(false); }
    if (e.key === 'ArrowRight') { c.rot += 0.25; c.idle = 0; e.preventDefault(); setHint(false); }
  };

  const paused = ready && !inView;
  return (
    <Guard>
      <div
        ref={view}
        className="scan3d__view"
        role="img"
        aria-label="Modello 3D illustrativo delle arcate dentali. Trascina per ruotarlo, oppure usa le frecce della tastiera."
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={leave}
        onKeyDown={key}
      >
        <Canvas
          dpr={[1, 1.75]}
          frameloop={paused ? 'never' : 'always'}
          camera={{ fov: FOV, near: 1, far: 80, position: [0, 3.5, 17] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor('#0b0b0b', 1)}
        >
          <Scene mode={mode} go={ready && inView} replay={replay} reduced={reduced} ctl={ctl} onFirstFrame={onReady} />
        </Canvas>
        <span className={'scan3d__hint' + (hint && ready ? ' is-on' : '')} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
          </svg>
          Trascina per ruotare
        </span>
      </div>
      {bar && ready && createPortal(
        <>
          <div className="scan3d__bar">
            <div className="scan3d__seg" role="group" aria-label="Tipo di vista">
              <button type="button" aria-pressed={mode === 'surface'} onClick={() => setMode('surface')}>Scanner intraorale</button>
              <button type="button" aria-pressed={mode === 'xray'} onClick={() => setMode('xray')}>TAC cone beam</button>
            </div>
            {!reduced && (
              <div className="scan3d__links">
                <button type="button" className="scan3d__again" onClick={() => setReplay((n) => n + 1)}>Ripeti scansione</button>
                <button type="button" className="scan3d__again" aria-pressed={!spin} onClick={() => setSpin((v) => !v)}>{spin ? 'Ferma rotazione' : 'Riprendi rotazione'}</button>
              </div>
            )}
          </div>
          <p className="scan3d__note" aria-live="polite">{NOTES[mode]}<span>Modello illustrativo, non è una scansione di un paziente.</span></p>
        </>,
        bar
      )}
    </Guard>
  );
}
