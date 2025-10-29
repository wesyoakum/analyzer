// ===== plots/depth-profiles.mjs  Speed vs Depth & Tension vs Depth (DOM-agnostic) =====
import { niceTicks, svgEl } from '../utils.mjs';

const LIGHT_CANDIDATE_COLOR = '#b9c3d8';
const EXCEED_COLOR = '#c65353';

function getAccentColor() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.getComputedStyle) {
    const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent');
    if (val) return val.trim();
  }
  return '#2c56a3';
}

/**
 * Draw both depth profile plots (speed & tension).
 *
 * @param {SVGSVGElement} svgSpeed
 * @param {SVGSVGElement} svgTension
 * @param {Object} opts
 * @param {'electric'|'hydraulic'} opts.scenario
 * @param {Array<Object>} opts.elWraps
 * @param {Array<Object>} opts.hyWraps
 * @param {number} opts.payload_kg
 * @param {number} opts.cable_w_kgpm
 * @param {number} [opts.dead_end_m=0]
 */
export function drawDepthProfiles(svgSpeed, svgTension, {
  scenario = 'electric',
  elWraps = [],
  hyWraps = [],
  payload_kg = 0,
  cable_w_kgpm = 0,
  dead_end_m = 0
} = {}) {
  const wraps = (scenario === 'electric') ? (elWraps || []) : (hyWraps || []);
  const speedField = (scenario === 'electric') ? 'line_speed_mpm' : 'hyd_speed_available_mpm';
  const tensionField = (scenario === 'electric') ? 'avail_tension_kgf' : 'hyd_avail_tension_kgf';

  // Build wrap intervals [depth_start, depth_end] with values
  const deadEnd = Number.isFinite(dead_end_m) ? Math.max(0, dead_end_m) : 0;
  const segments = wrapsToDepthSegments(wraps, speedField, tensionField, deadEnd, scenario);

  // Sort deep to shallow by start depth
  segments.sort((a, b) => (b.depth_start || 0) - (a.depth_start || 0));

  // Extents
  const maxDepth = segments.length
    ? Math.max(...segments.map(S => Math.max(S.depth_start || 0, S.depth_end || 0)))
    : 0;
  const maxSpeedFromCandidates = segments.length
    ? Math.max(0, ...segments.map(S => Array.isArray(S.candidate_speeds_ms)
      ? Math.max(0, ...S.candidate_speeds_ms, S.speed_ms || 0)
      : (S.speed_ms || 0)))
    : 0;
  const maxSpeed = Math.max(1, maxSpeedFromCandidates);
  const maxAvailT = Math.max(0, ...segments.map(S => S.avail_tension_kgf || 0));
  const maxReqT = payload_kg + cable_w_kgpm * maxDepth;
  const maxTension = Math.max(maxReqT, maxAvailT) * 1.05 || 1;

  const accentColor = getAccentColor();

  // Render both
  drawSpeedProfile(svgSpeed, segments, maxDepth, maxSpeed, accentColor);
  drawTensionProfile(svgTension, segments, maxDepth, maxTension, payload_kg, cable_w_kgpm, accentColor);
}

// ---------- Speed vs Depth ----------
function drawSpeedProfile(svg, segments, maxDepth, maxSpeed, accentColor) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ML = 64, MR = 18, MT = 18, MB = 46;
  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const sx = d => ML + (d / Math.max(1e-9, maxDepth)) * innerW;       // X depth
  const sy = v => MT + (1 - v / Math.max(1e-9, maxSpeed)) * innerH;   // Y speed

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  // grid/ticks
  niceTicks(0, maxDepth, 8).ticks.forEach(dx => {
    const X = sx(dx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    t.textContent = String(Math.round(dx));
    svg.appendChild(t);
  });
  niceTicks(0, maxSpeed, 6).ticks.forEach(v => {
    const Y = sy(v);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: '#eee' }));
    const t = svgEl('text', { x: ML - 6, y: Y + 4, 'text-anchor': 'end', 'font-size': '12', fill: '#444' });
    t.textContent = String(Math.round(v * 100) / 100);
    svg.appendChild(t);
  });

  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
     .textContent = 'Depth (m)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = 'Speed (m/s)';

  // candidate speeds (light gray, dashed)
  segments.forEach(S => {
    if (!Array.isArray(S.candidate_speeds_ms)) return;
    const depthEnd = Math.min(S.depth_start, S.depth_end);
    const depthStart = Math.max(S.depth_start, S.depth_end);
    S.candidate_speeds_ms.forEach(val => {
      if (!Number.isFinite(val)) return;
      const y = sy(val);
      const x0 = sx(depthEnd);
      const x1 = sx(depthStart);
      svg.appendChild(svgEl('line', {
        x1: x0,
        y1: y,
        x2: x1,
        y2: y,
        stroke: LIGHT_CANDIDATE_COLOR,
        'stroke-width': 2,
        'stroke-dasharray': '5 4'
      }));
    });
  });

  // available speed (accent)
  segments.forEach(S => {
    if (!Number.isFinite(S.speed_ms)) return;
    const y = sy(S.speed_ms);
    const depthEnd = Math.min(S.depth_start, S.depth_end);
    const depthStart = Math.max(S.depth_start, S.depth_end);
    const x0 = sx(depthEnd);
    const x1 = sx(depthStart);
    svg.appendChild(svgEl('line', {
      x1: x0,
      y1: y,
      x2: x1,
      y2: y,
      stroke: accentColor,
      'stroke-width': 2.4
    }));
  });

  // zero line
  svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
}

// ---------- Tension vs Depth ----------
function drawTensionProfile(svg, segments, maxDepth, maxTension, payload_kg, cable_w_kgpm, accentColor) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ML = 64, MR = 18, MT = 18, MB = 46;
  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const sx = d => ML + (d / Math.max(1e-9, maxDepth)) * innerW;        // X depth
  const sy = T => MT + (1 - T / Math.max(1e-9, maxTension)) * innerH;  // Y tension

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  // grid/ticks
  niceTicks(0, maxDepth, 8).ticks.forEach(dx => {
    const X = sx(dx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    t.textContent = String(Math.round(dx));
    svg.appendChild(t);
  });
  niceTicks(0, maxTension, 6).ticks.forEach(T => {
    const Y = sy(T);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: '#eee' }));
    const t = svgEl('text', { x: ML - 6, y: Y + 4, 'text-anchor': 'end', 'font-size': '12', fill: '#444' });
    t.textContent = String(Math.round(T));
    svg.appendChild(t);
  });

  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
     .textContent = 'Depth (m)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = 'Tension (kgf)';

  const normalizedSegments = segments.map(S => ({
    depth_start: Math.max(0, Math.max(S.depth_start, S.depth_end)),
    depth_end: Math.max(0, Math.min(S.depth_start, S.depth_end)),
    avail_tension_kgf: Number.isFinite(S.avail_tension_kgf) ? S.avail_tension_kgf : null
  }));

  // available tension as accent dashed steps across each wrap interval
  segments.forEach(S => {
    if (!Number.isFinite(S.avail_tension_kgf)) return;
    const depthEnd = Math.min(S.depth_start, S.depth_end);
    const depthStart = Math.max(S.depth_start, S.depth_end);
    const y = sy(S.avail_tension_kgf);
    const x0 = sx(depthEnd);
    const x1 = sx(depthStart);
    svg.appendChild(svgEl('line', {
      x1: x0,
      y1: y,
      x2: x1,
      y2: y,
      stroke: accentColor,
      'stroke-width': 2,
      'stroke-dasharray': '6 4'
    }));
  });

  const requiredSegments = buildRequiredSegments(normalizedSegments, payload_kg, cable_w_kgpm, maxDepth, accentColor);
  requiredSegments.forEach(seg => {
    const d0 = Math.max(0, Math.min(seg.d0, maxDepth));
    const d1 = Math.max(0, Math.min(seg.d1, maxDepth));
    if (Math.abs(d1 - d0) < 1e-6) return;
    const pts = [
      [sx(d0), sy(payload_kg + cable_w_kgpm * d0)],
      [sx(d1), sy(payload_kg + cable_w_kgpm * d1)]
    ];
    svg.appendChild(svgEl('path', {
      d: pathFrom(pts),
      fill: 'none',
      stroke: seg.color,
      'stroke-width': 2.4
    }));
  });

  svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));

  function pathFrom(pts) {
    if (!pts.length) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    return d;
  }
}

function buildRequiredSegments(segments, payload_kg, cable_w_kgpm, maxDepth, accentColor) {
  const boundaries = new Set([0, maxDepth]);
  segments.forEach(S => {
    boundaries.add(Math.max(0, S.depth_end));
    boundaries.add(Math.max(0, S.depth_start));
  });
  const sorted = [...boundaries].sort((a, b) => a - b);

  const pieces = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const d0 = sorted[i];
    const d1 = sorted[i + 1];
    const mid = (d0 + d1) / 2;
    const seg = segments.find(S => mid >= Math.min(S.depth_end, S.depth_start) - 1e-9 && mid <= Math.max(S.depth_end, S.depth_start) + 1e-9);
    const avail = seg ? seg.avail_tension_kgf : null;
    const T0 = payload_kg + cable_w_kgpm * d0;
    const T1 = payload_kg + cable_w_kgpm * d1;

    if (!Number.isFinite(avail)) {
      pieces.push({ d0, d1, color: accentColor });
      continue;
    }

    const above0 = T0 > avail + 1e-6;
    const above1 = T1 > avail + 1e-6;

    if (above0 === above1) {
      pieces.push({ d0, d1, color: above0 ? EXCEED_COLOR : accentColor });
      continue;
    }

    if (Math.abs(cable_w_kgpm) < 1e-9) {
      pieces.push({ d0, d1, color: above0 ? EXCEED_COLOR : accentColor });
      continue;
    }

    const dCross = (avail - payload_kg) / cable_w_kgpm;
    const clamped = Math.min(Math.max(dCross, d0), d1);
    pieces.push({ d0, d1: clamped, color: above0 ? EXCEED_COLOR : accentColor });
    pieces.push({ d0: clamped, d1, color: above0 ? accentColor : EXCEED_COLOR });
  }

  // Merge adjacent pieces of same color
  const merged = [];
  for (const piece of pieces) {
    if (!merged.length) {
      merged.push({ ...piece });
      continue;
    }
    const last = merged[merged.length - 1];
    if (piece.color === last.color && Math.abs(piece.d0 - last.d1) < 1e-6) {
      last.d1 = piece.d1;
    } else {
      merged.push({ ...piece });
    }
  }
  return merged;
}

function wrapsToDepthSegments(wraps, speedField, tensionField, deadEnd = 0, scenario = 'electric') {
  /** @type {Array<Object>} */
  const segments = [];
  let fallbackStart = null;

  for (const wrap of wraps) {
    if (!wrap) continue;
    const totalLen = Number.isFinite(wrap.total_cable_len_m) ? wrap.total_cable_len_m : null;
    const preOn = Number.isFinite(wrap.pre_spooled_len_m) ? wrap.pre_spooled_len_m : null;
    let depthEnd = Number.isFinite(wrap.deployed_len_m) ? wrap.deployed_len_m : null;

    if (!Number.isFinite(depthEnd)) {
      fallbackStart = null;
      continue;
    }

    let depthStart = null;
    if (Number.isFinite(totalLen) && Number.isFinite(preOn)) {
      depthStart = totalLen - preOn;
    } else if (Number.isFinite(fallbackStart)) {
      depthStart = fallbackStart;
    }

    if (!Number.isFinite(depthStart)) {
      depthStart = depthEnd;
    }

    if (depthStart < depthEnd) {
      const tmp = depthStart;
      depthStart = depthEnd;
      depthEnd = tmp;
    }

    const toDepth = (v) => {
      if (!Number.isFinite(v)) return 0;
      const adj = v - deadEnd;
      return +Math.max(0, adj).toFixed(3);
    };
    depthStart = toDepth(depthStart);
    depthEnd = toDepth(depthEnd);

    const speedValMpm = Number.isFinite(wrap[speedField]) ? wrap[speedField] : null;
    const candidateFields = (scenario === 'hydraulic')
      ? ['hyd_speed_power_mpm', 'hyd_speed_flow_mpm']
      : [];
    /** @type {number[]} */
    const candidateSpeedsMs = [];
    for (const field of candidateFields) {
      const val = Number.isFinite(wrap[field]) ? wrap[field] : null;
      if (!Number.isFinite(val)) continue;
      const ms = val / 60;
      if (Number.isFinite(ms)) candidateSpeedsMs.push(ms);
    }

    const speedMs = Number.isFinite(speedValMpm) ? speedValMpm / 60 : null;
    const filteredCandidates = Array.from(new Set(
      candidateSpeedsMs.filter(v => (speedMs === null) || Math.abs(v - speedMs) > 1e-6)
    ));
    const tensionVal = Number.isFinite(wrap[tensionField]) ? wrap[tensionField] : null;

    segments.push({
      depth_start: depthStart,
      depth_end: depthEnd,
      speed_ms: speedMs,
      candidate_speeds_ms: filteredCandidates,
      avail_tension_kgf: Number.isFinite(tensionVal) ? tensionVal : null,
      label: Number.isFinite(wrap.wrap_no)
        ? `W${wrap.wrap_no}`
        : (Number.isFinite(wrap.layer_no) ? `L${wrap.layer_no}` : '')
    });

    fallbackStart = depthEnd + deadEnd;
  }

  return segments;
}
