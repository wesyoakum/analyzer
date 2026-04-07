// ===== plots/wave-contours.mjs â€” Wave contour plots (DOM-agnostic) =====
import { niceTicks, svgEl, svgPathFromPoints } from '../utils.mjs';

const SEA_STATE_REGIONS = [
  { ss: 3, tp: [3, 6], hs: [0.5, 1.25], color: 'rgba(126,200,212,0.25)' },
  { ss: 4, tp: [5, 8], hs: [1.25, 2.5], color: 'rgba(217,165,40,0.25)' },
  { ss: 5, tp: [6, 10], hs: [2.5, 4], color: 'rgba(74,157,168,0.25)' },
  { ss: 6, tp: [8, 14], hs: [4, 6], color: 'rgba(229,84,56,0.22)' },
  { ss: 7, tp: [10, 16], hs: [6, 9], color: 'rgba(184,32,37,0.22)' }
];

// PM fully-developed-sea envelope: T_center = sqrt(PM_T_COEFF · H_s)
// Derived from H = 0.21·g·T² / 7.54²  →  T = √(H · 7.54² / (0.21·g))
const PM_T_COEFF = (7.54 * 7.54) / (0.21 * 9.80665);  // ≈ 27.607
const ENVELOPE_FRAC = 0.20;   // ±20 % band around center period
const T_PRACTICAL_MIN = 4;    // global lower clamp (s)
const T_PRACTICAL_MAX = 16;   // global upper clamp (s)

/** Period envelope for a given significant wave height. */
function envelopeT(H) {
  const Tc = Math.sqrt(PM_T_COEFF * H);
  return {
    lo: Math.max(T_PRACTICAL_MIN, (1 - ENVELOPE_FRAC) * Tc),
    hi: Math.min(T_PRACTICAL_MAX, (1 + ENVELOPE_FRAC) * Tc)
  };
}

// SMB (Sverdrup-Munk-Bretschneider) fully-developed-sea curve: H = 0.24·g·T² / 8.1²
const SMB_T_COEFF = (8.1 * 8.1) / (0.24 * 9.80665);  // ≈ 27.874
function smbT(H) { return Math.sqrt(SMB_T_COEFF * Math.max(H, 0)); }

/**
 * Trace a sea-state region using diagonal boundary lines (connecting
 * adjacent rectangle corners) with SMB ±20 % as the side envelope.
 *
 * Boundary between SS_n and SS_{n+1}:
 *   line from SS_n bottom-right (tp[1], hs[0]) → SS_{n+1} top-left (tp[0], hs[1]).
 * Side boundaries: T = 0.8·√(SMB_COEFF·H)  and  T = 1.2·√(SMB_COEFF·H).
 */
function seaStateRegionDiag(region, samples, Tmin, Tmax, Hmin, Hmax) {
  const idx = SEA_STATE_REGIONS.indexOf(region);
  const prev = idx > 0 ? SEA_STATE_REGIONS[idx - 1] : null;
  const next = idx < SEA_STATE_REGIONS.length - 1 ? SEA_STATE_REGIONS[idx + 1] : null;

  // Bottom diagonal: prev's bottom-right → this region's top-left
  // For the lowest region (SS3) there is no diagonal; use flat H = hs[0].
  let diagBotT1, diagBotH1, diagBotT2, diagBotH2;
  if (prev) {
    diagBotT1 = prev.tp[1];  diagBotH1 = prev.hs[0];
    diagBotT2 = region.tp[0]; diagBotH2 = region.hs[1];
  }
  const bottomDiagT = prev
    ? H => diagBotT1 + (H - diagBotH1) / (diagBotH2 - diagBotH1) * (diagBotT2 - diagBotT1)
    : null;

  // Top diagonal: this region's bottom-right → next's top-left
  // For the highest region (SS7) there is no diagonal; use flat H = hs[1].
  let diagTopT1, diagTopH1, diagTopT2, diagTopH2;
  if (next) {
    diagTopT1 = region.tp[1]; diagTopH1 = region.hs[0];
    diagTopT2 = next.tp[0];   diagTopH2 = next.hs[1];
  }
  const topDiagT = next
    ? H => diagTopT1 + (H - diagTopH1) / (diagTopH2 - diagTopH1) * (diagTopT2 - diagTopT1)
    : null;

  // H sweep range: spans the full diagonal extents, clipped to plot
  const Hlo = Math.max(Hmin, prev ? diagBotH1 : region.hs[0]);
  const Hhi = Math.min(Hmax, next ? diagTopH2 : region.hs[1]);
  if (Hhi <= Hlo) return null;

  const rightPts = [];
  const leftPts = [];

  for (let i = 0; i <= samples; i++) {
    const H = Hlo + (Hhi - Hlo) * (i / samples);
    let Tl = 0.8 * smbT(H);
    let Tr = 1.2 * smbT(H);
    // Bottom diagonal clips left side (region is to the right of it)
    if (bottomDiagT) Tl = Math.max(Tl, bottomDiagT(H));
    // Top diagonal clips right side (region is to the left of it)
    if (topDiagT) Tr = Math.min(Tr, topDiagT(H));
    Tl = Math.max(Tl, Tmin);
    Tr = Math.min(Tr, Tmax);
    if (Tr <= Tl + 1e-9) continue;
    rightPts.push([Tr, H]);
    leftPts.push([Tl, H]);
  }

  if (rightPts.length < 2) return null;
  return [...rightPts, ...leftPts.reverse()];
}

/**
 * Generate (T, H) boundary for the original rectangular sea-state boxes.
 */
function seaStateRegionRect(region, Tmin, Tmax, Hmin, Hmax) {
  const leftT = Math.max(Tmin, region.tp[0]);
  const rightT = Math.min(Tmax, region.tp[1]);
  const lowH = Math.max(Hmin, region.hs[0]);
  const highH = Math.min(Hmax, region.hs[1]);
  if (rightT <= leftT || highH <= lowH) return null;
  return [[leftT, lowH], [rightT, lowH], [rightT, highH], [leftT, highH]];
}

/**
 * Generate (T, H) boundary for PM-based envelope curves (horizontal H cuts).
 */
function seaStateRegionEnvelope(region, samples, Tmin, Tmax, Hmin, Hmax) {
  const lowH = Math.max(Hmin, region.hs[0]);
  const highH = Math.min(Hmax, region.hs[1]);
  if (highH <= lowH) return null;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const H = lowH + (highH - lowH) * (i / samples);
    pts.push([Math.min(Tmax, Math.max(Tmin, envelopeT(H).hi)), H]);
  }
  for (let i = samples; i >= 0; i--) {
    const H = lowH + (highH - lowH) * (i / samples);
    pts.push([Math.max(Tmin, Math.min(Tmax, envelopeT(H).lo)), H]);
  }
  return pts;
}

/**
 * Dispatch: return (T, H) boundary points for the requested sea-state mode.
 * mode: 'rect' | 'envelope' | 'diag'
 */
function seaStateRegionPts(region, mode, samples, Tmin, Tmax, Hmin, Hmax) {
  if (mode === 'rect') return seaStateRegionRect(region, Tmin, Tmax, Hmin, Hmax);
  if (mode === 'envelope') return seaStateRegionEnvelope(region, samples, Tmin, Tmax, Hmin, Hmax);
  return seaStateRegionDiag(region, samples, Tmin, Tmax, Hmin, Hmax);
}

/**
 * Draw the wave contour plot (speed vs period with height contours).
 */
export function drawWaveContours(svg, opts = {}) {
  renderWavePlot(svg, opts, 'speed');
}

/**
 * Draw the complementary plot (wave height vs period with layer speed contours).
 */
export function drawWaveHeightContours(svg, opts = {}) {
  renderWavePlot(svg, opts, 'height');
}

/**
 * Draw the wave acceleration contour plot (acceleration vs period with height contours).
 * Required acceleration from sinusoidal heave: a = 2π²H / T²
 * Layer lines show available acceleration from dynamic loads analysis.
 */
export function drawWaveAccelContours(svg, opts = {}) {
  if (svg._waveHandlers) {
    const { move, leave, pointerup, contextmenu, dblclick } = svg._waveHandlers;
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
    svg.removeEventListener('pointerenter', move);
    if (pointerup) svg.removeEventListener('pointerup', pointerup);
    if (contextmenu) svg.removeEventListener('contextmenu', contextmenu);
    if (dblclick) svg.removeEventListener('dblclick', dblclick);
    delete svg._waveHandlers;
  }
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const parseNumber = val => { const n = Number(val); return Number.isFinite(n) ? n : NaN; };

  let {
    scenario = 'electric',
    Tmin = 4,
    Tmax = 20,
    Hmin = 0,
    Hmax = 6,
    accelMin = 0,
    accelMax = null,
    showSeaStateOverlay = false,
    seaStateMode = 'diag',
    elLayers = [],
    hyLayers = []
  } = opts;

  // Normalise legacy boolean → mode string
  const ssMode = showSeaStateOverlay ? (seaStateMode || 'arc') : '';

  Tmin = parseNumber(Tmin);
  if (!Number.isFinite(Tmin) || Tmin <= 0) Tmin = 4;
  Tmin = Math.max(0.1, Tmin);
  Tmax = parseNumber(Tmax);
  if (!Number.isFinite(Tmax)) Tmax = Tmin + 16;
  Tmax = Math.max(Tmin + 0.1, Tmax);
  Hmin = parseNumber(Hmin);
  if (!Number.isFinite(Hmin)) Hmin = 0;
  Hmin = Math.max(0, Hmin);
  Hmax = parseNumber(Hmax);
  if (!Number.isFinite(Hmax)) Hmax = Math.max(6, Hmin + 0.5);
  Hmax = Math.max(Hmin + 0.1, Hmax);

  accelMin = parseNumber(accelMin);
  if (!Number.isFinite(accelMin)) accelMin = 0;
  accelMin = Math.max(0, accelMin);

  // Layer available accelerations
  let layerAccels = [];
  const layers = scenario === 'electric' ? (elLayers || []) : (hyLayers || []);
  layerAccels = layers
    .filter(r => Number.isFinite(+r.min_avail_accel_mps2) && +r.min_avail_accel_mps2 > 0)
    .map(r => ({ layer_no: r.layer_no, a_mps2: +r.min_avail_accel_mps2 }));
  layerAccels.sort((a, b) => a.a_mps2 - b.a_mps2);

  // Y range: max required accel from contours = 2π²Hmax / Tmin²
  const amaxFromContours = 2 * Math.PI * Math.PI * Hmax / Math.max(Tmin * Tmin, 1e-9);
  let maxLayerAccel = 0;
  for (const { a_mps2 } of layerAccels) {
    if (a_mps2 > maxLayerAccel) maxLayerAccel = a_mps2;
  }
  const parsedAmax = parseNumber(accelMax);
  const hasExplicitAmax = Number.isFinite(parsedAmax) && parsedAmax > accelMin;
  let Amax = hasExplicitAmax ? Math.max(accelMin + 0.1, parsedAmax) : Math.max(amaxFromContours, maxLayerAccel, accelMin + 0.1) * 1.05;
  if (!Number.isFinite(Amax) || Amax <= accelMin) Amax = accelMin + 1;
  const Amin = accelMin;

  const accentColor = (() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.getComputedStyle) {
      const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent');
      if (val) return val.trim();
    }
    return '#1a6b6a';
  })();

  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const ML = 64, MR = 20, MT = 20, MB = 46;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const sx = t => {
    const clamped = Math.min(Math.max(t, Tmin), Tmax);
    return ML + (clamped - Tmin) / Math.max(Tmax - Tmin, 1e-9) * innerW;
  };
  const sy = val => {
    const clamped = Math.min(Math.max(val, Amin), Amax);
    return MT + (1 - (clamped - Amin) / Math.max(Amax - Amin, 1e-9)) * innerH;
  };

  // Frame
  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  // Grid & ticks
  const xt = niceTicks(Tmin, Tmax, 8).ticks;
  const yt = niceTicks(Amin, Amax, 6).ticks;
  xt.forEach(tx => {
    const X = sx(tx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - MB + 18, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    t.textContent = (Math.round(tx * 100) / 100).toString();
    svg.appendChild(t);
  });
  yt.forEach(v => {
    const Y = sy(v);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: '#eee' }));
    const t = svgEl('text', { x: ML - 6, y: Y + 4, 'text-anchor': 'end', 'font-size': '12', fill: '#444' });
    t.textContent = (Math.round(v * 100) / 100).toString();
    svg.appendChild(t);
  });

  // Axis labels
  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
     .textContent = 'Period T (s)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = 'Acceleration (m/s²)';

  // Sea state overlay
  if (ssMode) {
    const overlay = svgEl('g', { 'pointer-events': 'none' });
    SEA_STATE_REGIONS.forEach(region => {
      const thPts = seaStateRegionPts(region, ssMode, 80, Tmin, Tmax, Hmin, Hmax);
      if (!thPts) return;
      const pts = thPts.map(([T, H]) => [sx(T), sy(2 * Math.PI * Math.PI * H / Math.max(T * T, 1e-9))]);

      overlay.appendChild(svgEl('path', {
        d: `${svgPathFromPoints(pts)} Z`,
        fill: region.color,
        stroke: 'rgba(70, 82, 107, 0.55)',
        'stroke-width': 1.2
      }));

      const midH = (region.hs[0] + region.hs[1]) / 2;
      const midT = ssMode === 'rect' ? (region.tp[0] + region.tp[1]) / 2
        : ssMode === 'diag' ? smbT(midH)
        : (envelopeT(midH).lo + envelopeT(midH).hi) / 2;
      const midA = 2 * Math.PI * Math.PI * midH / Math.max(midT * midT, 1e-9);
      if (midA >= Amin && midA <= Amax && midT >= Tmin && midT <= Tmax) {
        const label = svgEl('text', {
          x: sx(midT), y: sy(midA),
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': '12', 'font-weight': '600', fill: '#27324b'
        });
        label.textContent = `SS ${region.ss}`;
        overlay.appendChild(label);
      }
    });
    svg.appendChild(overlay);
  }

  // Acceleration contour lines: a = 2π²H / T² for H in 0.5m steps
  let contourId = 0;
  const contourLabelLayer = svgEl('g', {
    'font-family': 'monospace', 'font-size': '11', fill: '#5c6478', 'pointer-events': 'none'
  });

  const Hstep = 0.5;
  for (let Hm = Hstep; Hm <= Hmax + 1e-9; Hm += Hstep) {
    const pts = [];
    const samples = 200;
    for (let i = 0; i <= samples; i++) {
      const T = Tmin + (Tmax - Tmin) * i / samples;
      const a = 2 * Math.PI * Math.PI * Hm / Math.max(T * T, 1e-9);
      pts.push([sx(T), sy(a)]);
    }
    const isIntegerContour = Math.abs(Hm - Math.round(Hm)) < 1e-9;
    const pathAttrs = {
      d: svgPathFromPoints(pts),
      fill: 'none',
      stroke: '#999',
      'stroke-width': 1.5,
      'stroke-dasharray': isIntegerContour ? '0' : '6 6'
    };
    if (isIntegerContour) {
      pathAttrs.id = `accel-contour-${contourId++}`;
    }
    svg.appendChild(svgEl('path', pathAttrs));

    if (isIntegerContour && pts.length > 1) {
      const labelText = `---------- ${Math.round(Hm)} m ----------`;
      const text = svgEl('text', { 'text-anchor': 'middle' });
      const textPath = svgEl('textPath', { href: `#${pathAttrs.id}`, 'startOffset': '50%' });
      textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathAttrs.id}`);
      textPath.textContent = labelText;
      text.appendChild(textPath);
      contourLabelLayer.appendChild(text);
    }
  }

  // Horizontal lines for each layer's available acceleration
  layerAccels.forEach(L => {
    if (L.a_mps2 < Amin - 1e-9 || L.a_mps2 > Amax + 1e-9) return;
    const Y = sy(L.a_mps2);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: accentColor, 'stroke-width': 1.5 }));
    const lbl = svgEl('text', {
      x: W - MR - 2, y: Y - 3,
      'text-anchor': 'end', 'font-size': '11', fill: accentColor
    });
    lbl.textContent = `L${L.layer_no} (${L.a_mps2.toFixed(2)} m/s²)`;
    svg.appendChild(lbl);
  });

  if (contourLabelLayer.childNodes.length) {
    svg.appendChild(contourLabelLayer);
  }

  // Hover crosshairs
  const hoverLayer = svgEl('g', { 'pointer-events': 'none' });
  const hoverLine = svgEl('line', { x1: ML, x2: ML, y1: MT, y2: H - MB, stroke: accentColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0 });
  const hoverHLine = svgEl('line', { x1: ML, x2: W - MR, y1: MT, y2: MT, stroke: accentColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0 });
  const hoverLabel = svgEl('text', { x: ML, y: H - MB + 20, 'text-anchor': 'middle', 'font-size': '12', fill: accentColor, opacity: 0 });
  const hoverYLabel = svgEl('text', { x: ML - 8, y: MT, 'text-anchor': 'end', 'font-size': '12', fill: accentColor, opacity: 0 });
  hoverLayer.appendChild(hoverLine);
  hoverLayer.appendChild(hoverHLine);
  hoverLayer.appendChild(hoverLabel);
  hoverLayer.appendChild(hoverYLabel);
  svg.appendChild(hoverLayer);

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const toViewBoxPoint = evt => {
    if (typeof DOMPoint === 'function' && svg.getScreenCTM) {
      const ctm = svg.getScreenCTM();
      if (ctm && typeof ctm.inverse === 'function') {
        const point = new DOMPoint(evt.clientX, evt.clientY);
        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
      }
    }
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const vbWidth = vb && vb.width ? vb.width : rect.width;
    const vbHeight = vb && vb.height ? vb.height : rect.height;
    const offsetX = vb && vb.x ? vb.x : 0;
    const offsetY = vb && vb.y ? vb.y : 0;
    const scaleX = rect.width ? vbWidth / rect.width : 1;
    const scaleY = rect.height ? vbHeight / rect.height : 1;
    return { x: offsetX + (evt.clientX - rect.left) * scaleX, y: offsetY + (evt.clientY - rect.top) * scaleY };
  };

  const updateHover = evt => {
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) {
      hoverLine.setAttribute('opacity', '0'); hoverLabel.setAttribute('opacity', '0');
      hoverHLine.setAttribute('opacity', '0'); hoverYLabel.setAttribute('opacity', '0');
      return;
    }
    const clampedX = clamp(localX, ML, W - MR);
    const clampedY = clamp(localY, MT, H - MB);
    const xVal = Tmin + ((clampedX - ML) / Math.max(innerW, 1e-9)) * (Tmax - Tmin);
    const yVal = Amax - ((clampedY - MT) / Math.max(innerH, 1e-9)) * (Amax - Amin);
    hoverLine.setAttribute('x1', clampedX); hoverLine.setAttribute('x2', clampedX); hoverLine.setAttribute('opacity', '1');
    hoverHLine.setAttribute('y1', clampedY); hoverHLine.setAttribute('y2', clampedY); hoverHLine.setAttribute('opacity', '1');
    hoverLabel.setAttribute('x', clampedX);
    hoverLabel.textContent = `${(Math.round(xVal * 10) / 10).toFixed(1)} sec`;
    hoverLabel.setAttribute('opacity', '1');
    hoverYLabel.setAttribute('y', clampedY + 4);
    hoverYLabel.textContent = `${(Math.round(yVal * 100) / 100).toFixed(2)} m/s²`;
    hoverYLabel.setAttribute('opacity', '1');
  };

  const hideHover = () => {
    hoverLine.setAttribute('opacity', '0'); hoverLabel.setAttribute('opacity', '0');
    hoverHLine.setAttribute('opacity', '0'); hoverYLabel.setAttribute('opacity', '0');
  };

  svg.addEventListener('pointermove', updateHover);
  svg.addEventListener('pointerenter', updateHover);
  svg.addEventListener('pointerleave', hideHover);
  svg._waveHandlers = { move: updateHover, leave: hideHover };

  // zero line
  if (Amin <= 0 && Amax >= 0) {
    svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
  }
}

function renderWavePlot(svg, {
  scenario = 'electric',
  Tmin = 4,
  Tmax = 20,
  Hmin = 0,
  Hmax = 6,
  speedMin = 0,
  speedMax = null,
  showSeaStateOverlay = false,
  seaStateMode = 'diag',
  showBreakingLimit = false,
  showPmCurve = false,
  showJonswapCurve = false,
  showSmbCurve = false,
  showMaxDisp = true,
  showMinDisp = false,

  elLayers = [],
  hyLayers = []
} = {}, mode = 'speed') {
  if (svg._waveHandlers) {
    const { move, leave, pointerup, contextmenu, dblclick } = svg._waveHandlers;
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
    svg.removeEventListener('pointerenter', move);
    if (pointerup) svg.removeEventListener('pointerup', pointerup);
    if (contextmenu) svg.removeEventListener('contextmenu', contextmenu);
    if (dblclick) svg.removeEventListener('dblclick', dblclick);
    delete svg._waveHandlers;
  }

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ssMode = showSeaStateOverlay ? (seaStateMode || 'arc') : '';

  const parseNumber = val => {
    const num = Number(val);
    return Number.isFinite(num) ? num : NaN;
  };

  Tmin = parseNumber(Tmin);
  if (!Number.isFinite(Tmin) || Tmin <= 0) Tmin = 4;
  Tmin = Math.max(0.1, Tmin);

  Tmax = parseNumber(Tmax);
  if (!Number.isFinite(Tmax)) Tmax = Tmin + 16;
  Tmax = Math.max(Tmin + 0.1, Tmax);

  speedMin = parseNumber(speedMin);
  if (!Number.isFinite(speedMin)) speedMin = 0;
  speedMin = Math.max(0, speedMin);

  const parsedSpeedMax = parseNumber(speedMax);
  const hasExplicitVmax = Number.isFinite(parsedSpeedMax) && parsedSpeedMax > speedMin;

  Hmin = parseNumber(Hmin);
  if (!Number.isFinite(Hmin)) Hmin = 0;
  Hmin = Math.max(0, Hmin);

  Hmax = parseNumber(Hmax);
  if (!Number.isFinite(Hmax)) Hmax = Math.max(6, Hmin + 0.5);
  Hmax = Math.max(Hmin + 0.1, Hmax);

  // layer speeds in m/s (start-of-layer)
  let layerSpeeds = [];
  let layerSpeedsMinDisp = [];
  if (scenario === 'electric') {
    layerSpeeds = (elLayers || [])
      .filter(r => Number.isFinite(+r.line_speed_at_start_mpm))
      .map(r => ({ layer_no: r.layer_no, v_ms: (+r.line_speed_at_start_mpm) / 60 }));
  } else {
    if (showMaxDisp) {
      layerSpeeds = (hyLayers || [])
        .filter(r => Number.isFinite(+r.hyd_speed_available_mpm))
        .map(r => ({ layer_no: r.layer_no, v_ms: (+r.hyd_speed_available_mpm) / 60 }));
    }
    if (showMinDisp) {
      layerSpeedsMinDisp = (hyLayers || [])
        .filter(r => Number.isFinite(+r.hyd_speed_available_mpm_min))
        .map(r => ({ layer_no: r.layer_no, v_ms: (+r.hyd_speed_available_mpm_min) / 60 }));
    }
  }
  layerSpeeds = layerSpeeds.filter(L => Number.isFinite(L.v_ms) && L.v_ms >= 0);
  layerSpeeds.sort((a, b) => a.v_ms - b.v_ms);
  layerSpeedsMinDisp = layerSpeedsMinDisp.filter(L => Number.isFinite(L.v_ms) && L.v_ms >= 0);
  layerSpeedsMinDisp.sort((a, b) => a.v_ms - b.v_ms);

  // Y range (speed plot only) derived from contours and layers
  const vmaxFromContours = Math.PI * Hmax / Math.max(Tmin, 1e-9);
  let maxLayerSpeed = 0;
  for (const { v_ms } of layerSpeeds) {
    if (v_ms > maxLayerSpeed) maxLayerSpeed = v_ms;
  }
  for (const { v_ms } of layerSpeedsMinDisp) {
    if (v_ms > maxLayerSpeed) maxLayerSpeed = v_ms;
  }
  let autoVmax = Math.max(vmaxFromContours, maxLayerSpeed, speedMin + 0.1) * 1.05;
  if (!Number.isFinite(autoVmax) || autoVmax <= speedMin) {
    autoVmax = speedMin + 1;
  }
  let Vmax = hasExplicitVmax ? Math.max(speedMin + 0.1, parsedSpeedMax) : autoVmax;
  if (!Number.isFinite(Vmax) || Vmax <= speedMin) Vmax = speedMin + 1;
  const Vmin = speedMin;

  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const ML = 64, MR = 20, MT = 20, MB = 46;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const sx = t => {
    const clamped = Math.min(Math.max(t, Tmin), Tmax);
    return ML + (clamped - Tmin) / Math.max(Tmax - Tmin, 1e-9) * innerW;
  };
  const yMin = mode === 'speed' ? Vmin : Hmin;
  const yMax = mode === 'speed' ? Vmax : Hmax;
  const sy = val => {
    const clamped = Math.min(Math.max(val, yMin), yMax);
    return MT + (1 - (clamped - yMin) / Math.max(yMax - yMin, 1e-9)) * innerH;
  };

  // frame
  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  // grid & ticks
  const xt = niceTicks(Tmin, Tmax, 8).ticks;
  const yt = niceTicks(yMin, yMax, 6).ticks;
  xt.forEach(tx => {
    const X = sx(tx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - MB + 18, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    t.textContent = (Math.round(tx * 100) / 100).toString();
    svg.appendChild(t);
  });
  yt.forEach(v => {
    const Y = sy(v);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: '#eee' }));
    const t = svgEl('text', { x: ML - 6, y: Y + 4, 'text-anchor': 'end', 'font-size': '12', fill: '#444' });
    t.textContent = (Math.round(v * 100) / 100).toString();
    svg.appendChild(t);
  });

  // axis labels
  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
     .textContent = 'Period T (s)';
  const yLabel = mode === 'speed' ? 'Speed (m/s)' : 'Wave Height (m)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = yLabel;

  const Hstep = 0.5;

  const accentColor = (() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.getComputedStyle) {
      const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent');
      if (val) return val.trim();
    }
    return '#1a6b6a';
  })();


  if (mode === 'speed') {
    const drawSeaStateOverlaySpeed = () => {
      if (!ssMode) return;
      const overlay = svgEl('g', { 'pointer-events': 'none' });

      SEA_STATE_REGIONS.forEach(region => {
        const thPts = seaStateRegionPts(region, ssMode, 80, Tmin, Tmax, Hmin, Hmax);
        if (!thPts) return;
        const pts = thPts.map(([T, H]) => [sx(T), sy(Math.PI * H / Math.max(T, 1e-9))]);

        overlay.appendChild(svgEl('path', {
          d: `${svgPathFromPoints(pts)} Z`,
          fill: region.color,
          stroke: 'rgba(70, 82, 107, 0.55)',
          'stroke-width': 1.2
        }));

        const midH = (region.hs[0] + region.hs[1]) / 2;
        const midT = ssMode === 'rect'
          ? (region.tp[0] + region.tp[1]) / 2
          : (envelopeT(midH).lo + envelopeT(midH).hi) / 2;
        const midV = Math.PI * midH / Math.max(midT, 1e-9);
        if (midV >= Vmin && midV <= Vmax && midT >= Tmin && midT <= Tmax) {
          const label = svgEl('text', {
            x: sx(midT),
            y: sy(midV),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '12',
            'font-weight': '600',
            fill: '#27324b'
          });
          label.textContent = `SS ${region.ss}`;
          overlay.appendChild(label);
        }
      });

      svg.appendChild(overlay);
    };

    drawSeaStateOverlaySpeed();

    let contourId = 0;
    const contourLabelLayer = svgEl('g', {
      'font-family': 'monospace',
      'font-size': '11',
      fill: '#5c6478',
      'pointer-events': 'none'
    });

    // contour lines for H from 0.5 to Hmax in 0.5 m step
    for (let Hm = Hstep; Hm <= Hmax + 1e-9; Hm += Hstep) {
      const pts = [];
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const T = Tmin + (Tmax - Tmin) * i / samples;
        const v = Math.PI * Hm / Math.max(T, 1e-9);
        pts.push([sx(T), sy(v)]);
      }
      const isIntegerContour = Math.abs(Hm - Math.round(Hm)) < 1e-9;
      const pathAttrs = {
        d: svgPathFromPoints(pts),
        fill: 'none',
        stroke: '#999',
        'stroke-width': 1.5,
        'stroke-dasharray': isIntegerContour ? '0' : '6 6'
      };
      if (isIntegerContour) {
        pathAttrs.id = `wave-contour-${contourId++}`;
      }
      const contourPath = svgEl('path', pathAttrs);
      svg.appendChild(contourPath);

      if (isIntegerContour && pts.length > 1) {
        const labelText = `---------- ${Math.round(Hm)} m ----------`;
        const text = svgEl('text', { 'text-anchor': 'middle' });
        const textPath = svgEl('textPath', {
          href: `#${pathAttrs.id}`,
          'startOffset': '50%'
        });
        textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathAttrs.id}`);
        textPath.textContent = labelText;
        text.appendChild(textPath);
        contourLabelLayer.appendChild(text);
      }
    }

    // horizontal lines for each layer speed (max displacement)
    layerSpeeds.forEach(L => {
      if (L.v_ms < Vmin - 1e-9 || L.v_ms > Vmax + 1e-9) return;
      const Y = sy(L.v_ms);
      svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: accentColor, 'stroke-width': 1.5 }));
      const lbl = svgEl('text', {
        x: W - MR - 2,
        y: Y - 3,
        'text-anchor': 'end',
        'font-size': '11',
        fill: accentColor
      });
      lbl.textContent = `L${L.layer_no} (${L.v_ms.toFixed(2)} m/s)`;
      svg.appendChild(lbl);
    });

    // horizontal lines for min-displacement layer speeds
    const minDispColor = '#c8782e';
    layerSpeedsMinDisp.forEach(L => {
      if (L.v_ms < Vmin - 1e-9 || L.v_ms > Vmax + 1e-9) return;
      const Y = sy(L.v_ms);
      svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: minDispColor, 'stroke-width': 1.5 }));
      const lbl = svgEl('text', {
        x: ML + 4,
        y: Y - 3,
        'text-anchor': 'start',
        'font-size': '11',
        fill: minDispColor
      });
      lbl.textContent = `L${L.layer_no} min (${L.v_ms.toFixed(2)} m/s)`;
      svg.appendChild(lbl);
    });

    if (contourLabelLayer.childNodes.length) {
      svg.appendChild(contourLabelLayer);
    }

  } else {
    const drawSeaStateOverlay = () => {
      if (!ssMode) return;
      const overlay = svgEl('g', { 'pointer-events': 'none' });
      SEA_STATE_REGIONS.forEach(region => {
        const thPts = seaStateRegionPts(region, ssMode, 80, Tmin, Tmax, Hmin, Hmax);
        if (!thPts) return;
        const pts = thPts.map(([T, H]) => [sx(T), sy(H)]);

        overlay.appendChild(svgEl('path', {
          d: `${svgPathFromPoints(pts)} Z`,
          fill: region.color,
          stroke: 'rgba(70, 82, 107, 0.55)',
          'stroke-width': 1.2
        }));

        const midH = (region.hs[0] + region.hs[1]) / 2;
        const midT = ssMode === 'rect'
          ? (region.tp[0] + region.tp[1]) / 2
          : (envelopeT(midH).lo + envelopeT(midH).hi) / 2;
        if (midT >= Tmin && midT <= Tmax) {
          const label = svgEl('text', {
            x: sx(midT),
            y: sy(midH),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': '12',
            'font-weight': '600',
            fill: '#27324b'
          });
          label.textContent = `SS ${region.ss}`;
          overlay.appendChild(label);
        }
      });
      svg.appendChild(overlay);
    };

    // iso-speed contour lines (H = v·T / π) for integer and half-integer speeds
    const speedStep = 0.5;
    const maxIsoSpeed = Math.PI * Hmax / Math.max(Tmin, 1e-9);
    for (let v = speedStep; v <= maxIsoSpeed + 1e-9; v += speedStep) {
      const TmaxForLine = Math.min(Tmax, (Hmax * Math.PI) / Math.max(v, 1e-12));
      if (TmaxForLine <= Tmin + 1e-6) continue;

      const minH = (v * Tmin) / Math.PI;
      const maxH = (v * TmaxForLine) / Math.PI;
      if (maxH < Hmin - 1e-6 || minH > Hmax + 1e-6) continue;

      const pts = [];
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const T = Tmin + (TmaxForLine - Tmin) * i / samples;
        const Hline = (v * T) / Math.PI;
        pts.push([sx(T), sy(Hline)]);
      }

      const isIntegerSpeed = Math.abs(v - Math.round(v)) < 1e-9;
      svg.appendChild(svgEl('path', {
        d: svgPathFromPoints(pts),
        fill: 'none',
        stroke: '#bbb',
        'stroke-width': isIntegerSpeed ? 1.4 : 1,
        'stroke-dasharray': isIntegerSpeed ? '0' : '6 6'
      }));

      const lastPt = pts[pts.length - 1];
      if (lastPt && lastPt[1] >= MT && lastPt[1] <= H - MB) {
        const lbl = svgEl('text', {
          x: lastPt[0] + 4,
          y: lastPt[1] - 4,
          'text-anchor': 'start',
          'font-size': '10',
          fill: '#888'
        });
        lbl.textContent = `${v.toFixed(1)} m/s`;
        svg.appendChild(lbl);
      }
    }


    const drawReferenceCurve = (fn, { stroke, strokeWidth = 2, dash = null, label = '', labelT = null, labelOffsetY = -8 }) => {
      const pts = [];
      const samples = 400;
      for (let i = 0; i <= samples; i++) {
        const T = Tmin + (Tmax - Tmin) * (i / samples);
        const hVal = fn(T);
        if (!Number.isFinite(hVal) || hVal < Hmin || hVal > Hmax) continue;
        pts.push([sx(T), sy(hVal)]);
      }
      if (pts.length < 2) return;
      const attrs = {
        d: svgPathFromPoints(pts),
        fill: 'none',
        stroke,
        'stroke-width': strokeWidth
      };
      if (dash) attrs['stroke-dasharray'] = dash;
      svg.appendChild(svgEl('path', attrs));

      if (label && Number.isFinite(labelT)) {
        const hLabel = fn(labelT);
        if (Number.isFinite(hLabel) && hLabel >= Hmin && hLabel <= Hmax) {
          const txt = svgEl('text', {
            x: sx(labelT) + 6,
            y: sy(hLabel) + labelOffsetY,
            'text-anchor': 'start',
            'font-size': '11',
            fill: stroke
          });
          txt.textContent = label;
          svg.appendChild(txt);
        }
      }
    };

    // contour lines for each layer speed (H = vÂ·T / Ï€)
    layerSpeeds.forEach(L => {
      if (!Number.isFinite(L.v_ms) || L.v_ms <= 0) return;
      const TmaxForLine = Math.min(Tmax, (Hmax * Math.PI) / Math.max(L.v_ms, 1e-12));
      if (TmaxForLine <= Tmin + 1e-6) return;

      const minH = (L.v_ms * Tmin) / Math.PI;
      const maxH = (L.v_ms * TmaxForLine) / Math.PI;
      if (maxH < Hmin - 1e-6 || minH > Hmax + 1e-6) return;

      const pts = [];
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const T = Tmin + (TmaxForLine - Tmin) * i / samples;
        const Hline = (L.v_ms * T) / Math.PI;
        pts.push([sx(T), sy(Hline)]);
      }
      svg.appendChild(svgEl('path', {
        d: svgPathFromPoints(pts),
        fill: 'none',
        stroke: accentColor,
        'stroke-width': 1.6
      }));

      const lastPt = pts[pts.length - 1];
      if (lastPt && lastPt[1] >= MT && lastPt[1] <= H - MB) {
        const lbl = svgEl('text', {
          x: lastPt[0] - 4,
          y: lastPt[1] - 6,
          'text-anchor': 'end',
          'font-size': '11',
          fill: accentColor
        });
        lbl.textContent = `L${L.layer_no} (${L.v_ms.toFixed(2)} m/s)`;
        svg.appendChild(lbl);
      }
    });


    // min-displacement iso-lines
    const minDispColorH = '#c8782e';
    layerSpeedsMinDisp.forEach(L => {
      if (!Number.isFinite(L.v_ms) || L.v_ms <= 0) return;
      const TmaxForLine = Math.min(Tmax, (Hmax * Math.PI) / Math.max(L.v_ms, 1e-12));
      if (TmaxForLine <= Tmin + 1e-6) return;
      const minH = (L.v_ms * Tmin) / Math.PI;
      const maxH = (L.v_ms * TmaxForLine) / Math.PI;
      if (maxH < Hmin - 1e-6 || minH > Hmax + 1e-6) return;
      const pts = [];
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const T = Tmin + (TmaxForLine - Tmin) * i / samples;
        pts.push([sx(T), sy((L.v_ms * T) / Math.PI)]);
      }
      svg.appendChild(svgEl('path', {
        d: svgPathFromPoints(pts),
        fill: 'none',
        stroke: minDispColorH,
        'stroke-width': 1.6
      }));
      const lastPt = pts[pts.length - 1];
      if (lastPt && lastPt[1] >= MT && lastPt[1] <= H - MB) {
        const lbl = svgEl('text', { x: lastPt[0] - 4, y: lastPt[1] + 14, 'text-anchor': 'end', 'font-size': '11', fill: minDispColorH });
        lbl.textContent = `L${L.layer_no} min (${L.v_ms.toFixed(2)} m/s)`;
        svg.appendChild(lbl);
      }
    });

    drawSeaStateOverlay();

    if (showBreakingLimit) {
      drawReferenceCurve(
        T => (9.80665 * T * T) / (14 * Math.PI),
        { stroke: '#b82025', strokeWidth: 3, dash: '10 6', label: 'Breaking limit', labelT: Math.min(Tmax - 0.8, 11), labelOffsetY: -10 }
      );
    }

    if (showPmCurve) {
      drawReferenceCurve(
        T => (0.21 * 9.80665 * T * T) / (7.54 * 7.54),
        { stroke: '#4a9da8', strokeWidth: 2.8, label: 'PM fully developed sea', labelT: Math.min(Tmax - 0.8, 12), labelOffsetY: 14 }
      );
    }

    if (showJonswapCurve) {
      drawReferenceCurve(
        T => (0.174 * 9.80665 * T * T) / (7.54 * 7.54),
        { stroke: '#7ec8d4', strokeWidth: 2.4, dash: '8 6', label: 'JONSWAP sea (γ≈3.3)', labelT: Math.min(Tmax - 1.2, 10), labelOffsetY: -12 }
      );
    }

    if (showSmbCurve) {
      drawReferenceCurve(
        T => (0.24 * 9.80665 * T * T) / (8.1 * 8.1),
        { stroke: '#e55438', strokeWidth: 2.4, dash: '4 6', label: 'SMB sea (fetch-limited)', labelT: Math.min(Tmax - 1.0, 9.5), labelOffsetY: 12 }
      );
    }

  }

  const hoverLayer = svgEl('g', { 'pointer-events': 'none' });
  const hoverLine = svgEl('line', { x1: ML, x2: ML, y1: MT, y2: H - MB, stroke: accentColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0 });
  const hoverHLine = svgEl('line', { x1: ML, x2: W - MR, y1: MT, y2: MT, stroke: accentColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0 });
  const hoverLabel = svgEl('text', { x: ML, y: H - MB + 20, 'text-anchor': 'middle', 'font-size': '12', fill: accentColor, opacity: 0 });
  const hoverYLabel = svgEl('text', { x: ML - 8, y: MT, 'text-anchor': 'end', 'font-size': '12', fill: accentColor, opacity: 0 });
  hoverLayer.appendChild(hoverLine);
  hoverLayer.appendChild(hoverHLine);
  hoverLayer.appendChild(hoverLabel);
  hoverLayer.appendChild(hoverYLabel);
  svg.appendChild(hoverLayer);

  const getPins = () => {
    if (!Array.isArray(svg._wavePins)) svg._wavePins = [];
    return svg._wavePins;
  };
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const toViewBoxPoint = evt => {
    if (typeof DOMPoint === 'function' && svg.getScreenCTM) {
      const ctm = svg.getScreenCTM();
      if (ctm && typeof ctm.inverse === 'function') {
        const point = new DOMPoint(evt.clientX, evt.clientY);
        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
      }
    }
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const vbWidth = vb && vb.width ? vb.width : rect.width;
    const vbHeight = vb && vb.height ? vb.height : rect.height;
    const offsetX = vb && vb.x ? vb.x : 0;
    const offsetY = vb && vb.y ? vb.y : 0;
    const scaleX = rect.width ? vbWidth / rect.width : 1;
    const scaleY = rect.height ? vbHeight / rect.height : 1;
    return { x: offsetX + (evt.clientX - rect.left) * scaleX, y: offsetY + (evt.clientY - rect.top) * scaleY };
  };

  const updateHover = evt => {
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) {
      hoverLine.setAttribute('opacity', '0');
      hoverLabel.setAttribute('opacity', '0');
      hoverHLine.setAttribute('opacity', '0');
      hoverYLabel.setAttribute('opacity', '0');
      return;
    }
    const clampedX = clamp(localX, ML, W - MR);
    const clampedY = clamp(localY, MT, H - MB);
    const xVal = Tmin + ((clampedX - ML) / Math.max(innerW, 1e-9)) * (Tmax - Tmin);
    const yVal = yMax - ((clampedY - MT) / Math.max(innerH, 1e-9)) * (yMax - yMin);
    hoverLine.setAttribute('x1', clampedX);
    hoverLine.setAttribute('x2', clampedX);
    hoverLine.setAttribute('opacity', '1');
    hoverHLine.setAttribute('y1', clampedY);
    hoverHLine.setAttribute('y2', clampedY);
    hoverHLine.setAttribute('opacity', '1');
    hoverLabel.setAttribute('x', clampedX);
    hoverLabel.textContent = `${(Math.round(xVal * 10) / 10).toFixed(1)} sec`;
    hoverLabel.setAttribute('opacity', '1');
    hoverYLabel.setAttribute('y', clampedY + 4);
    hoverYLabel.textContent = `${(Math.round(yVal * 10) / 10).toFixed(1)} ${mode === 'speed' ? 'm/s' : 'm'}`;
    hoverYLabel.setAttribute('opacity', '1');
  };

  const hideHover = () => {
    hoverLine.setAttribute('opacity', '0');
    hoverLabel.setAttribute('opacity', '0');
    hoverHLine.setAttribute('opacity', '0');
    hoverYLabel.setAttribute('opacity', '0');
  };

  const pins = getPins()
    .filter(pin => Number.isFinite(pin.x) && Number.isFinite(pin.y))
    .map((pin, idx) => ({
      ...pin,
      x: clamp(pin.x, Tmin, Tmax),
      y: clamp(pin.y, yMin, yMax),
      label: pin.label || `P${idx + 1}`
    }));
  pins.forEach((pin, idx) => { pin.label = `P${idx + 1}`; });
  svg._wavePins = pins;

  pins.forEach(pin => {
    const x = sx(pin.x);
    const y = sy(pin.y);
    svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, fill: accentColor, stroke: '#fff', 'stroke-width': 1.5 }));
    const lbl = svgEl('text', { x: x + 8, y: y - 8, 'font-size': '11', fill: accentColor, style: 'paint-order: stroke; stroke: #fff; stroke-width: 2px;' });
    lbl.textContent = `${pin.label} (${(Math.round(pin.x * 10) / 10).toFixed(1)} s, ${(Math.round(pin.y * 10) / 10).toFixed(1)} ${mode === 'speed' ? 'm/s' : 'm'})`;
    svg.appendChild(lbl);
  });

  const nearestPinIndex = (xVal, yVal) => {
    const tolX = Math.max(0.1, (Tmax - Tmin) * 0.015);
    const tolY = Math.max(0.05, (yMax - yMin) * 0.02);
    let bestIdx = -1;
    let bestScore = Infinity;
    getPins().forEach((pin, idx) => {
      const dx = Math.abs(pin.x - xVal);
      const dy = Math.abs(pin.y - yVal);
      if (dx <= tolX && dy <= tolY) {
        const score = dx / tolX + dy / tolY;
        if (score < bestScore) { bestScore = score; bestIdx = idx; }
      }
    });
    return bestIdx;
  };

  const pointerUpHandler = evt => {
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
    const xVal = Tmin + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * (Tmax - Tmin);
    const yVal = yMax - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * (yMax - yMin);
    const roundedX = Math.round(xVal * 10) / 10;
    const roundedY = Math.round(yVal * 10) / 10;
    if (nearestPinIndex(roundedX, roundedY) === -1) {
      svg._wavePins = [...getPins(), { x: roundedX, y: roundedY, label: '' }]
        .map((pin, idx) => ({ ...pin, label: `P${idx + 1}` }));
    }
    renderWavePlot(svg, { scenario, Tmin, Tmax, Hmin, Hmax, speedMin, speedMax, showSeaStateOverlay, showBreakingLimit, showPmCurve, elLayers, hyLayers }, mode);
  };

  const contextMenuHandler = evt => {
    evt.preventDefault();
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
    const xVal = Tmin + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * (Tmax - Tmin);
    const yVal = yMax - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * (yMax - yMin);
    const idx = nearestPinIndex(xVal, yVal);
    if (idx === -1) return;
    svg._wavePins = getPins().filter((_, pinIdx) => pinIdx !== idx).map((pin, order) => ({ ...pin, label: `P${order + 1}` }));
    renderWavePlot(svg, { scenario, Tmin, Tmax, Hmin, Hmax, speedMin, speedMax, showSeaStateOverlay, showBreakingLimit, showPmCurve, elLayers, hyLayers }, mode);
  };

  const clearPinsHandler = () => {
    svg._wavePins = [];
    renderWavePlot(svg, { scenario, Tmin, Tmax, Hmin, Hmax, speedMin, speedMax, showSeaStateOverlay, showBreakingLimit, showPmCurve, elLayers, hyLayers }, mode);
  };

  svg.addEventListener('pointermove', updateHover);
  svg.addEventListener('pointerenter', updateHover);
  svg.addEventListener('pointerleave', hideHover);
  svg.addEventListener('pointerup', pointerUpHandler);
  svg.addEventListener('contextmenu', contextMenuHandler);
  svg.addEventListener('dblclick', clearPinsHandler);

  svg._waveHandlers = {
    move: updateHover,
    leave: hideHover,
    pointerup: pointerUpHandler,
    contextmenu: contextMenuHandler,
    dblclick: clearPinsHandler
  };

  // zero line
  if (yMin <= 0 && yMax >= 0) {
    svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
  }
}
