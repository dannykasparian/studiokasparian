// Il modello completo: due arcate, tre "livelli" di aspetto e il piano di scansione.
//  points  = nuvola di punti grezza, prima della scansione
//  surface = superficie solida, come la restituisce uno scanner intraorale
//  xray    = trasparenza stile TAC, con radici e ossa
// Un piano orizzontale sale lungo il modello: sotto il piano si vede il livello nuovo,
// sopra quello vecchio. Così ogni cambio di vista è una "scansione".
import * as THREE from 'three';
import { archGeometry, gumGeometry } from './teeth.js';

export const Y_MIN = -3.6;
export const Y_MAX = 3.6;
const UPPER_Y = 3.34; // quanto sta in alto l'arcata superiore (bocca aperta, per vederle entrambe)

const GLSL_SCAN = /* glsl */ `
  uniform float uScanY; uniform float uKeep; uniform float uGlow;
  varying float vWY;
  bool scanCut() { return (uKeep < -0.5 && vWY > uScanY) || (uKeep > 0.5 && vWY < uScanY); }
  float scanEdge() { return smoothstep(0.22, 0.0, abs(vWY - uScanY)) * uGlow; }
`;

// Aggiunge il taglio e il bordo luminoso a un materiale standard di three.js.
function patchLit(material, shared, keep, cutRoots = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uScanY = shared.scanY;
    shader.uniforms.uGlow = shared.glow;
    shader.uniforms.uKeep = keep;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;' + (cutRoots ? '\nattribute float aTone; varying float vRoot;' : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;' + (cutRoots ? '\nvRoot = aTone;' : ''));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_SCAN + (cutRoots ? '\nvarying float vRoot;' : ''))
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (scanCut()) discard;' + (cutRoots ? '\nif (vRoot < 0.8) discard;' : ''))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.27, 0.75, 0.27) * scanEdge() * 1.25;');
  };
  material.customProgramCacheKey = () => 'scan-lit' + (cutRoots ? '-teeth' : '');
  return material;
}

function xrayMaterial(shared, keep, intensity) {
  return new THREE.ShaderMaterial({
    uniforms: { uScanY: shared.scanY, uGlow: shared.glow, uKeep: keep, uInt: { value: intensity } },
    vertexShader: /* glsl */ `
      attribute float aTone;
      varying vec3 vN; varying vec3 vV; varying float vTone; varying float vWY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vTone = aTone;
        vWY = (modelMatrix * vec4(position, 1.0)).y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ GLSL_SCAN + `
      uniform float uInt;
      varying vec3 vN; varying vec3 vV; varying float vTone;
      void main() {
        if (scanCut()) discard;
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.7);
        float a = (0.06 + 0.94 * f) * vTone * uInt;
        vec3 col = mix(vec3(0.55, 0.72, 0.84), vec3(0.96, 0.99, 1.0), f) * a;
        col += vec3(0.20, 0.62, 0.20) * scanEdge() * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function pointsMaterial(shared, keep) {
  return new THREE.ShaderMaterial({
    uniforms: { uScanY: shared.scanY, uGlow: shared.glow, uKeep: keep, uSize: { value: 2.1 }, uPR: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aTone;
      uniform float uSize; uniform float uPR;
      varying float vWY; varying float vTone;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWY = wp.y; vTone = aTone;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (18.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ GLSL_SCAN + `
      varying float vTone;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        if (scanCut()) discard;
        vec3 col = mix(vec3(0.46, 0.5, 0.48), vec3(0.78, 0.86, 0.8), vTone);
        gl_FragColor = vec4(col, 0.62);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

export function buildModel() {
  const shared = { scanY: { value: -100 }, glow: { value: 0 } };
  const layers = {
    points: { keep: { value: 1 }, objects: [] },
    surface: { keep: { value: -1 }, objects: [] },
    xray: { keep: { value: -1 }, objects: [] },
  };
  const disposables = [];

  const enamel = patchLit(new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.3, clearcoat: 0.65, clearcoatRoughness: 0.2 }), shared, layers.surface.keep, true);
  const gumLit = patchLit(new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45 }), shared, layers.surface.keep);
  const xTeeth = xrayMaterial(shared, layers.xray.keep, 1.0);
  const xGum = xrayMaterial(shared, layers.xray.keep, 0.42);
  const pts = pointsMaterial(shared, layers.points.keep);
  disposables.push(enamel, gumLit, xTeeth, xGum, pts);

  const pivot = new THREE.Group();        // gira su se stesso
  const centered = new THREE.Group();     // sposta il centro del modello nell'origine
  centered.position.set(0, -1.79, 1.7);
  pivot.add(centered);

  for (const which of ['lower', 'upper']) {
    const teeth = archGeometry(which);
    const gum = gumGeometry(which);
    disposables.push(teeth, gum);
    const arch = new THREE.Group();
    if (which === 'upper') { arch.rotation.z = Math.PI; arch.position.y = UPPER_Y; }

    const add = (layer, geo, mat, Kind, order) => {
      const o = new Kind(geo, mat);
      o.renderOrder = order;
      layers[layer].objects.push(o);
      arch.add(o);
    };
    add('surface', gum, gumLit, THREE.Mesh, 0);
    add('surface', teeth, enamel, THREE.Mesh, 0);
    add('xray', gum, xGum, THREE.Mesh, 2);
    add('xray', teeth, xTeeth, THREE.Mesh, 2);
    add('points', gum, pts, THREE.Points, 3);
    add('points', teeth, pts, THREE.Points, 3);
    centered.add(arch);
  }

  applyLayers(layers, null, 'points');
  return {
    root: pivot,
    pivot,
    layers,
    shared,
    pointsMaterial: pts,
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}

// active = livello nuovo (sotto il piano), prev = livello che sta lasciando (sopra il piano)
export function applyLayers(layers, active, prev) {
  for (const [name, layer] of Object.entries(layers)) {
    const isActive = name === active;
    const isPrev = name === prev && !isActive;
    layer.keep.value = isPrev ? 1 : -1;
    layer.objects.forEach((o) => { o.visible = isActive || isPrev; });
  }
}
