// Arcate dentali costruite nel codice: nessun file 3D esterno, nessuna licenza.
// Unità: 1 = 1 cm. Ogni dente nasce con la corona verso +Y e il colletto a Y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const gauss = (u, w, cu, cw, s) => Math.exp(-((u - cu) ** 2 + (w - cw) ** 2) / (s * s));
const hex = (h) => new THREE.Color(h);
const mix = (a, b, t) => a.clone().lerp(b, clamp01(t));

// Colori (sRGB): smalto caldo, colletto più giallo (dentina), bordo incisale più freddo e trasparente.
const ENAMEL = hex('#f1e9d8');
const CERVICAL = hex('#e2cc9a');
const INCISAL = hex('#dde5ea');
const STAIN = hex('#a8875a');
const GUM_LIGHT = hex('#dc9190');
const GUM_DEEP = hex('#9c4851');

// Misure medie in cm: W = larghezza mesio-distale, D = spessore vestibolo-linguale,
// H = altezza della corona, R = lunghezza della radice.
export const SPECS = {
  upper: [
    { type: 'incisor', W: 0.85, D: 0.75, H: 1.05, R: 1.3 },
    { type: 'incisor', W: 0.65, D: 0.65, H: 0.9, R: 1.3 },
    { type: 'canine', W: 0.78, D: 0.8, H: 1.05, R: 1.7 },
    { type: 'premolar', W: 0.7, D: 0.9, H: 0.85, R: 1.3 },
    { type: 'premolar', W: 0.68, D: 0.9, H: 0.8, R: 1.4 },
    { type: 'molar', W: 1.02, D: 1.1, H: 0.75, R: 1.2 },
    { type: 'molar', W: 0.95, D: 1.08, H: 0.7, R: 1.1 },
  ],
  lower: [
    { type: 'incisor', W: 0.52, D: 0.6, H: 0.95, R: 1.25 },
    { type: 'incisor', W: 0.58, D: 0.65, H: 1.0, R: 1.35 },
    { type: 'canine', W: 0.7, D: 0.78, H: 1.05, R: 1.5 },
    { type: 'premolar', W: 0.7, D: 0.78, H: 0.85, R: 1.35 },
    { type: 'premolar', W: 0.72, D: 0.82, H: 0.82, R: 1.35 },
    { type: 'molar', W: 1.1, D: 1.05, H: 0.75, R: 1.2 },
    { type: 'molar', W: 1.05, D: 1.02, H: 0.7, R: 1.1 },
  ],
};

// Forma dell'arcata: mezza ellisse. A = semi-larghezza, B = profondità.
export const ARCH = {
  upper: { A: 3.4, B: 3.1 },
  lower: { A: 3.0, B: 2.7 },
};

// cerv = quanto è stretto il colletto rispetto alla corona; exp = "quadratezza" della sezione;
// torque = inclinazione della corona verso la guancia, in gradi (gli incisivi sporgono, i molari rientrano).
const TYPE = {
  incisor: { cerv: 0.7, exp: 3.2, topTaper: 0.04, torque: 7, front: true },
  canine: { cerv: 0.7, exp: 2.2, topTaper: 0.26, torque: 4, front: true },
  premolar: { cerv: 0.72, exp: 2.4, topTaper: 0.14, torque: 0, front: false },
  molar: { cerv: 0.78, exp: 2.9, topTaper: 0.08, torque: -4, front: false },
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Se i triangoli guardano all'interno, li giro: il segno del volume lo dice.
function ensureOutward(geo) {
  const p = geo.attributes.position.array;
  const idx = geo.index.array;
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
         - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
         + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  if (vol < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  return geo;
}

// Un dente: superficie unica radice -> colletto -> parete -> bordo -> piano masticatorio.
export function toothGeometry(spec, seed) {
  const rnd = mulberry(seed);
  const jit = (v, k) => v * (1 + (rnd() - 0.5) * 2 * k);
  const W = jit(spec.W, 0.03), D = jit(spec.D, 0.03), H = jit(spec.H, 0.04), R = jit(spec.R, 0.05);
  const warm = (rnd() - 0.5) * 0.08;               // ogni dente ha una tinta un po' diversa
  const T = TYPE[spec.type];
  const type = spec.type;
  const NV = 56, NR = 12, NC = 22, NCAP = 14;

  const rings = []; // { y, r, tone, zs, ht }
  for (let i = 0; i <= NR; i++) {
    const t = i / NR;
    rings.push({ y: -R * (1 - t), r: T.cerv * Math.pow(t, 0.62), tone: 0.55 + 0.1 * smooth(0.5, 1, t), zs: 0, ht: -1 });
  }
  for (let i = 1; i <= NC; i++) {
    const t = i / NC;
    const r = T.cerv + (1 - T.cerv) * smooth(0, 0.62, t) - T.topTaper * smooth(0.5, 1, t);
    // la faccia vestibolare dei denti anteriori è leggermente bombata
    const zs = T.front ? D * 0.06 * Math.sin(Math.PI * Math.min(1, t * 0.95)) : 0;
    rings.push({ y: H * 0.92 * t, r, tone: 1, zs, ht: t * 0.92 });
  }
  const last = rings[rings.length - 1];
  for (let j = 1; j <= NCAP; j++) {
    const f = j / NCAP;
    const rise = 0.08 * Math.sin(Math.min(1, j / 3) * Math.PI / 2);
    rings.push({ y: H * (0.92 + rise), r: last.r * (1 - f), tone: 1, zs: last.zs * (1 - f * 0.5), ht: 0.92 + rise });
  }

  const e = 2 / T.exp;
  const cusps = {
    incisor: [],
    canine: [{ u: 0, w: 0, h: 0.21, s: 0.58 }],
    premolar: [{ u: 0, w: 0.45, h: 0.22, s: 0.45 }, { u: 0, w: -0.45, h: 0.16, s: 0.42 }],
    molar: [
      { u: 0.45, w: 0.45, h: 0.22, s: 0.42 }, { u: -0.45, w: 0.45, h: 0.2, s: 0.42 },
      { u: 0.45, w: -0.45, h: 0.22, s: 0.42 }, { u: -0.45, w: -0.45, h: 0.18, s: 0.42 },
    ],
  }[type];
  // solchi della superficie masticatoria: scavano un po' e si macchiano di scuro
  const groove = (u, w) => {
    const fade = (v) => 1 - smooth(0.72, 1, Math.abs(v));
    if (type === 'molar') return Math.max(Math.exp(-(w * w) / 0.014) * fade(u), Math.exp(-(u * u) / 0.014) * fade(w));
    if (type === 'premolar') return Math.exp(-(w * w) / 0.014) * fade(u);
    return 0;
  };

  const pos = [], tone = [], col = [];
  for (let i = 0; i < rings.length; i++) {
    const { y, r, tone: tn, zs, ht } = rings[i];
    for (let k = 0; k < NV; k++) {
      const th = (k / NV) * Math.PI * 2;
      const cx = Math.cos(th), sz = Math.sin(th);
      const depthK = type === 'incisor' ? 1 - 0.45 * smooth(0.55 * H, H, y) : 1;
      const x = (W / 2) * r * Math.sign(cx) * Math.pow(Math.abs(cx), e);
      const z = (D / 2) * r * depthK * Math.sign(sz) * Math.pow(Math.abs(sz), e) + zs;
      let yy = y;
      let stain = 0;
      const wgt = y > 0 ? smooth(0.8 * H, H, y) : 0;
      if (wgt > 0) {
        const u = x / (W / 2), w = (z - zs) / ((D / 2) * depthK);
        let dy = 0;
        for (const c of cusps) dy += c.h * gauss(u, w, c.u, c.w, c.s);
        const g = groove(u, w);
        dy -= 0.09 * g + (type === 'molar' ? 0.06 * gauss(u, w, 0, 0, 0.35) : 0);
        if (type === 'incisor') dy += 0.025 * (0.5 + 0.5 * Math.cos(3 * Math.PI * u)); // piccole ondulazioni del bordo
        yy += wgt * dy * H;
        stain = wgt * Math.min(0.75, g * 0.9 + (type === 'molar' ? 0.5 * gauss(u, w, 0, 0, 0.3) : 0));
      }
      pos.push(x, yy, z);
      tone.push(tn);

      // colore: più caldo al colletto, più freddo e trasparente sul bordo, scuro nei solchi
      let c = ENAMEL.clone().offsetHSL(0.0, warm * 0.4, warm * 0.25);
      if (ht < 0) c = mix(CERVICAL, ENAMEL, 0.0);
      else {
        c = mix(c, CERVICAL, (1 - smooth(0, 0.36, ht / 0.92)) * 0.85);
        if (T.front) c = mix(c, INCISAL, smooth(0.78, 1.0, ht) * 0.75);
        if (stain > 0) c = mix(c, STAIN, stain);
      }
      col.push(c.r, c.g, c.b);
    }
  }
  const idx = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < NV; k++) {
      const k1 = (k + 1) % NV;
      const a = i * NV + k, b = i * NV + k1, c = (i + 1) * NV + k1, d = (i + 1) * NV + k;
      idx.push(a, c, b, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  ensureOutward(geo);
  geo.computeVertexNormals();
  return geo;
}

// Posizioni lungo la mezza ellisse, a lunghezza d'arco, con tangente e normale.
function archFrame(A, B) {
  const N = 2400, TH = 2.4;
  const th = [], s = [0];
  for (let i = 0; i <= N; i++) th.push((i / N) * TH);
  for (let i = 1; i <= N; i++) {
    const m = (th[i] + th[i - 1]) / 2;
    s.push(s[i - 1] + Math.hypot(A * Math.cos(m), B * Math.sin(m)) * (th[i] - th[i - 1]));
  }
  const thetaAt = (len) => {
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid] < len) lo = mid; else hi = mid; }
    const f = (len - s[lo]) / (s[hi] - s[lo] || 1);
    return th[lo] + f * (th[hi] - th[lo]);
  };
  const lenAt = (theta) => {
    const f = clamp01(Math.abs(theta) / TH) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return s[i] + (f - i) * (s[i + 1] - s[i]);
  };
  const frame = (theta) => {
    const px = A * Math.sin(theta), pz = B * Math.cos(theta) - B;
    let tx = A * Math.cos(theta), tz = -B * Math.sin(theta);
    const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    return { px, pz, tx, tz, nx: -tz, nz: tx }; // N = T x Y, punta verso la guancia
  };
  return { thetaAt, lenAt, frame };
}

export function archGeometry(which) {
  const specs = SPECS[which];
  const { A, B } = ARCH[which];
  const { thetaAt, frame } = archFrame(A, B);
  const gap = 0.03;
  const parts = [];
  let c = 0, seed = which === 'upper' ? 11 : 71;
  const tmp = new THREE.Matrix4(), rot = new THREE.Matrix4(), rx = new THREE.Matrix4();
  const rnd = mulberry(which === 'upper' ? 501 : 907);
  for (const spec of specs) {
    const len = c + spec.W / 2;
    c += spec.W + gap;
    for (const sign of [1, -1]) {
      const f = frame(sign * thetaAt(len));
      const g = toothGeometry(spec, seed++);
      // inclinazione e piccola rotazione naturale, attorno al colletto
      const torque = (TYPE[spec.type].torque * Math.PI) / 180 * (which === 'upper' ? 1 : 0.6);
      const twist = (rnd() - 0.5) * 0.09;
      rot.makeRotationY(twist); rx.makeRotationX(torque + (rnd() - 0.5) * 0.04);
      g.applyMatrix4(rot.premultiply(rx));
      // base: X = tangente (mesio-distale), Y = su, Z = normale verso la guancia
      tmp.makeBasis(new THREE.Vector3(f.tx, 0, f.tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.nx, 0, f.nz));
      tmp.setPosition(f.px, 0, f.pz);
      g.applyMatrix4(tmp);
      ensureOutward(g);
      g.computeVertexNormals();
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

// Gengiva: un profilo arrotondato fatto scorrere lungo l'arcata, con il bordo che sale
// tra un dente e l'altro (le "papille") e scende al centro di ogni dente.
export function gumGeometry(which) {
  const specs = SPECS[which];
  const { A, B } = ARCH[which];
  const { thetaAt, lenAt, frame } = archFrame(A, B);
  const gap = 0.03;
  const spans = [];
  let acc = 0;
  for (const sp of specs) { spans.push({ mid: acc + sp.W / 2, half: (sp.W + gap) / 2 }); acc += sp.W + gap; }
  const total = acc + 0.25;
  const thEnd = thetaAt(total);

  // altezza del bordo gengivale lungo l'arco (s >= 0)
  const margin = (s) => {
    for (const sp of spans) {
      const u = (s - sp.mid) / sp.half;
      if (Math.abs(u) <= 1) return 0.0 + 0.36 * Math.pow(Math.abs(u), 3.0);
    }
    return 0.1;
  };

  // profilo (n = verso la guancia, y = in alto), rettangolo con angoli tondi
  const nL = -0.64, nR = 0.82, yB = -0.95, yT = 0.1, rad = 0.3;
  const profile = [];
  const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); profile.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); } };
  corner(nR - rad, yT - rad, 0);
  corner(nL + rad, yT - rad, Math.PI / 2);
  corner(nL + rad, yB + rad, Math.PI);
  corner(nR - rad, yB + rad, Math.PI * 1.5);
  const NP = profile.length, NS = 320;

  const pos = [], tone = [], col = [];
  for (let i = 0; i <= NS; i++) {
    const th = -thEnd + (i / NS) * 2 * thEnd;
    const f = frame(th);
    const off = margin(lenAt(th)) - yT;
    for (const [n, y] of profile) {
      const k = smooth(-0.55, yT - 0.06, y);                      // solo la parte alta segue il bordo
      pos.push(f.px + f.nx * n, y + off * k, f.pz + f.nz * n);
      tone.push(0.35);
      // rosa chiaro vicino al bordo, più scuro e rosso in basso
      let c = mix(GUM_DEEP, GUM_LIGHT, smooth(-0.85, 0.0, y));
      c = mix(c, GUM_LIGHT, smooth(-0.1, 0.12, y + off * k) * 0.25);
      col.push(c.r, c.g, c.b);
    }
  }
  const idx = [];
  for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) {
    const j1 = (j + 1) % NP;
    const a = i * NP + j, b = i * NP + j1, c = (i + 1) * NP + j1, d = (i + 1) * NP + j;
    idx.push(a, b, c, a, c, d);
  }
  for (const [i, flip] of [[0, true], [NS, false]]) {
    let cx = 0, cy = 0, cz = 0, r = 0, g = 0, b = 0;
    for (let j = 0; j < NP; j++) { const o = (i * NP + j) * 3; cx += pos[o]; cy += pos[o + 1]; cz += pos[o + 2]; r += col[o]; g += col[o + 1]; b += col[o + 2]; }
    const ci = pos.length / 3; pos.push(cx / NP, cy / NP, cz / NP); tone.push(0.35); col.push(r / NP, g / NP, b / NP);
    for (let j = 0; j < NP; j++) { const a = i * NP + j, bb = i * NP + (j + 1) % NP; flip ? idx.push(ci, a, bb) : idx.push(ci, bb, a); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  ensureOutward(geo);
  geo.computeVertexNormals();
  return geo;
}
