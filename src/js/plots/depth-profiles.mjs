// ===== plots/depth-profiles.mjs  Speed vs Depth & Tension vs Depth (DOM-agnostic) =====
import { niceTicks, svgEl, TENSION_SAFETY_FACTOR, tension_kgf } from '../utils.mjs';

const CANDIDATE_POWER_COLOR = '#9249c6'; // purple
const CANDIDATE_FLOW_COLOR = '#eed500'; // yellow
const EXCEED_COLOR = '#c65353'; // red
const RATED_SPEED_COLOR = '#888888'; // gray

const RATED_AVAILABLE_TOLERANCE = 1e-9;

function isRatedBelowAvailable(ratedSpeedMs, availableSpeedMs) {
  if (!Number.isFinite(ratedSpeedMs) || !Number.isFinite(availableSpeedMs)) return false;
  const diff = availableSpeedMs - ratedSpeedMs;
  if (!Number.isFinite(diff)) return false;
  const relTol = Number.EPSILON * Math.max(1, Math.abs(availableSpeedMs), Math.abs(ratedSpeedMs));
  const tolerance = Math.max(RATED_AVAILABLE_TOLERANCE, relTol);
  return diff > tolerance;
}

function isAvailableBelowRated(ratedSpeedMs, availableSpeedMs) {
  if (!Number.isFinite(ratedSpeedMs) || !Number.isFinite(availableSpeedMs)) return false;
  const diff = ratedSpeedMs - availableSpeedMs;
  if (!Number.isFinite(diff)) return false;
  const relTol = Number.EPSILON * Math.max(1, Math.abs(availableSpeedMs), Math.abs(ratedSpeedMs));
  const tolerance = Math.max(RATED_AVAILABLE_TOLERANCE, relTol);
  return diff > tolerance;
}

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
  dead_end_m = 0,
  rated_speed_ms = null,
  depth_xmin = 0,
  depth_xmax = null,
  speed_ymin = 0,
  speed_ymax = null,
  tension_ymin = 0,
  tension_ymax = null
} = {}) {
  const wraps = (scenario === 'electric') ? (elWraps || []) : (hyWraps || []);
  const speedField = (scenario === 'electric')
    ? 'line_speed_mpm'
    : ['vavail', 'vAvail', 'v_available', 'v_available_mpm', 'v_avail', 'hyd_speed_available_mpm'];
  const tensionField = (scenario === 'electric')
    ? ['avail_tension_kgf', 't_avail_kgf', 'tAvail']
    : ['Tavail,start', 'Tavail_start', 'tavail_start', 'tavail_start_kgf', 'hyd_avail_tension_kgf'];

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
    ? Math.max(0, ...segments.map(S => {
        if (!Array.isArray(S.candidate_speeds_ms) || !S.candidate_speeds_ms.length) {
          return S.speed_ms || 0;
        }
        return Math.max(0, ...S.candidate_speeds_ms.map(C => C.value_ms), S.speed_ms || 0);
      }))
    : 0;
  const ratedSpeedMs = Number.isFinite(rated_speed_ms) ? Math.max(0, rated_speed_ms) : null;
  const maxAvailT = Math.max(0, ...segments.map(S => S.avail_tension_kgf || 0));
  const maxSegTheoT = Math.max(0, ...segments.map(S => S.tension_theoretical_kgf || 0));
  const maxSegReqT = Math.max(0, ...segments.map(S => S.tension_required_kgf || 0));
  const toNumber = val => {
    const num = Number(val);
    return Number.isFinite(num) ? num : NaN;
  };

  let depthMin = toNumber(depth_xmin);
  if (!Number.isFinite(depthMin) || depthMin < 0) depthMin = 0;

  let depthMax = toNumber(depth_xmax);
  const autoDepthMax = Math.max(depthMin + 0.1, maxDepth);
  if (Number.isFinite(depthMax)) {
    depthMax = Math.max(depthMin + 0.1, depthMax);
  } else {
    depthMax = autoDepthMax;
  }
  if (depthMax <= depthMin) depthMax = depthMin + 1;

  let speedMin = toNumber(speed_ymin);
  if (!Number.isFinite(speedMin) || speedMin < 0) speedMin = 0;

  let speedMax = toNumber(speed_ymax);
  const autoSpeedMax = Math.max(speedMin + 0.1, 1, maxSpeedFromCandidates, ratedSpeedMs || 0);
  if (Number.isFinite(speedMax)) {
    speedMax = Math.max(speedMin + 0.1, speedMax);
  } else {
    speedMax = autoSpeedMax;
  }
  if (speedMax <= speedMin) speedMax = speedMin + 1;

  const tensionDepth = Math.max(maxDepth, depthMax);
  const maxTheoT = payload_kg + cable_w_kgpm * tensionDepth;
  const maxReqT = maxTheoT * TENSION_SAFETY_FACTOR;

  let tensionMin = toNumber(tension_ymin);
  if (!Number.isFinite(tensionMin) || tensionMin < 0) tensionMin = 0;

  let tensionMax = toNumber(tension_ymax);
  const autoTensionMax = Math.max(
    tensionMin + 1,
    maxReqT,
    maxAvailT,
    maxSegTheoT,
    maxSegReqT
  ) * 1.05;
  if (Number.isFinite(tensionMax)) {
    tensionMax = Math.max(tensionMin + 1, tensionMax);
  } else {
    tensionMax = autoTensionMax;
  }
  if (tensionMax <= tensionMin) tensionMax = tensionMin + 1;

  const accentColor = getAccentColor();

  // Render both
  drawSpeedProfile(svgSpeed, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs);
  drawTensionProfile(svgTension, segments, depthMin, depthMax, tensionMin, tensionMax, payload_kg, cable_w_kgpm, accentColor);
}

// ---------- Speed vs Depth ----------
function drawSpeedProfile(svg, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs = null) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ML = 64, MR = 18, MT = 18, MB = 46;
  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const clampDepth = d => Math.min(Math.max(d, depthMin), depthMax);
  const clampSpeed = v => Math.min(Math.max(v, speedMin), speedMax);
  const depthSpan = Math.max(1e-9, depthMax - depthMin);
  const speedSpan = Math.max(1e-9, speedMax - speedMin);

  const sx = d => ML + (clampDepth(d) - depthMin) / depthSpan * innerW;
  const sy = v => MT + (1 - (clampSpeed(v) - speedMin) / speedSpan) * innerH;

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  niceTicks(depthMin, depthMax, 8).ticks.forEach(dx => {
    if (dx < depthMin - 1e-9 || dx > depthMax + 1e-9) return;
    const X = sx(dx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    t.textContent = formatDepthLabel(dx);
    svg.appendChild(t);
  });
  niceTicks(speedMin, speedMax, 6).ticks.forEach(v => {
    if (v < speedMin - 1e-9 || v > speedMax + 1e-9) return;
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

  segments.forEach(S => {
    if (!Number.isFinite(S.speed_ms)) return;
    if (S.speed_ms < speedMin - 1e-9 || S.speed_ms > speedMax + 1e-9) return;
    const depthEnd = Math.min(S.depth_start, S.depth_end);
    const depthStart = Math.max(S.depth_start, S.depth_end);
    if (Math.max(depthStart, depthEnd) < depthMin - 1e-9) return;
    if (Math.min(depthStart, depthEnd) > depthMax + 1e-9) return;
    const x0 = sx(depthEnd);
    const x1 = sx(depthStart);
    if (Math.abs(x1 - x0) < 1e-6) return;
    const y = sy(S.speed_ms);
    const strokeColor = (Number.isFinite(ratedSpeedMs) && isAvailableBelowRated(ratedSpeedMs, S.speed_ms))
      ? EXCEED_COLOR
      : accentColor;
    svg.appendChild(svgEl('line', {
      x1: x0,
      y1: y,
      x2: x1,
      y2: y,
      stroke: strokeColor,
      'stroke-width': 4.8
    }));
  });

  segments.forEach(S => {
    if (!Array.isArray(S.candidate_speeds_ms)) return;
    const depthEnd = Math.min(S.depth_start, S.depth_end);
    const depthStart = Math.max(S.depth_start, S.depth_end);
    if (Math.max(depthStart, depthEnd) < depthMin - 1e-9) return;
    if (Math.min(depthStart, depthEnd) > depthMax + 1e-9) return;

    S.candidate_speeds_ms.forEach(candidate => {
      if (!candidate || !Number.isFinite(candidate.value_ms)) return;
      if (candidate.value_ms < speedMin - 1e-9 || candidate.value_ms > speedMax + 1e-9) return;
      const y = sy(candidate.value_ms);
      const x0 = sx(depthEnd);
      const x1 = sx(depthStart);
      if (Math.abs(x1 - x0) < 1e-6) return;
      const stroke = (candidate.kind === 'flow') ? CANDIDATE_FLOW_COLOR : CANDIDATE_POWER_COLOR;

      svg.appendChild(svgEl('line', {
        x1: x0,
        y1: y,
        x2: x1,
        y2: y,
        stroke,
        'stroke-width': 2,
        'stroke-dasharray': '5 4'
      }));
    });
  });

  if (Number.isFinite(ratedSpeedMs) && ratedSpeedMs > 0 && ratedSpeedMs >= speedMin - 1e-9 && ratedSpeedMs <= speedMax + 1e-9) {
    const ratedExceeded = segments.some(S => Number.isFinite(S.speed_ms) && !isRatedBelowAvailable(ratedSpeedMs, S.speed_ms));
    const ratedStroke = RATED_SPEED_COLOR;
    const yRated = sy(ratedSpeedMs);
    svg.appendChild(svgEl('line', {
      x1: ML,
      y1: yRated,
      x2: W - MR,
      y2: yRated,
      stroke: ratedStroke,
      'stroke-width': 3
    }));

    if (ratedExceeded) {
      const limit = findRatedDepthLimit(segments, ratedSpeedMs);
      if (limit && Number.isFinite(limit.depth)) {
        const clampedDepth = clampDepth(limit.depth);
        const x = sx(clampedDepth);
        const axisY = H - MB;
        svg.appendChild(svgEl('line', {
          x1: x,
          y1: yRated,
          x2: x,
          y2: axisY,
          stroke: EXCEED_COLOR,
          'stroke-width': 2,
          'stroke-dasharray': '4 6'
        }));

        const labelText = formatDepthLabel(limit.depth);
        if (labelText) {
          const label = svgEl('text', {
            x,
            y: axisY + 20,
            'text-anchor': 'middle',
            'font-size': '12',
            fill: EXCEED_COLOR
          });
          label.textContent = `${labelText} m`;
          svg.appendChild(label);
        }
      }
    }
  }

  if (speedMin <= 0 && speedMax >= 0) {
    svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
  }
}

function findRatedDepthLimit(segments, ratedSpeedMs) {
  if (!Array.isArray(segments) || !Number.isFinite(ratedSpeedMs) || ratedSpeedMs <= 0) return null;
  const ranges = segments
    .filter(S => Number.isFinite(S.speed_ms))
    .map(S => ({
      d0: Math.min(S.depth_start, S.depth_end),
      d1: Math.max(S.depth_start, S.depth_end),
      speed: S.speed_ms
    }))
    .sort((a, b) => a.d0 - b.d0);

  if (!ranges.length) return null;

  let deepestReach = null;
  let hasReachable = false;

  for (const range of ranges) {
    if (isRatedBelowAvailable(ratedSpeedMs, range.speed)) {
      hasReachable = true;
      deepestReach = (deepestReach === null) ? range.d1 : Math.max(deepestReach, range.d1);
      continue;
    }

    if (!hasReachable) {
      return { depth: range.d0 };
    }

    return { depth: deepestReach ?? range.d0 };
  }

  return null;
}

function formatDepthLabel(depth) {
  if (!Number.isFinite(depth)) return '';
  if (Math.abs(depth) >= 100) return String(Math.round(depth));
  if (Math.abs(depth) >= 10) return removeTrailingZeros(depth.toFixed(1));
  return removeTrailingZeros(depth.toFixed(2));
}

function removeTrailingZeros(text) {
  return text.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

// ---------- Tension vs Depth ----------
function drawTensionProfile(svg, segments, depthMin, depthMax, tensionMin, tensionMax, payload_kg, cable_w_kgpm, accentColor) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ML = 64, MR = 18, MT = 18, MB = 46;
  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const clampDepth = d => Math.min(Math.max(d, depthMin), depthMax);
  const clampTension = T => Math.min(Math.max(T, tensionMin), tensionMax);
  const depthSpan = Math.max(1e-9, depthMax - depthMin);
  const tensionSpan = Math.max(1e-9, tensionMax - tensionMin);

  const sx = d => ML + (clampDepth(d) - depthMin) / depthSpan * innerW;
  const sy = T => MT + (1 - (clampTension(T) - tensionMin) / tensionSpan) * innerH;

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  niceTicks(depthMin, depthMax, 8).ticks.forEach(dx => {
    if (dx < depthMin - 1e-9 || dx > depthMax + 1e-9) return;
    const X = sx(dx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    t.textContent = formatDepthLabel(dx);
    svg.appendChild(t);
  });
  niceTicks(tensionMin, tensionMax, 6).ticks.forEach(T => {
    if (T < tensionMin - 1e-9 || T > tensionMax + 1e-9) return;
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

  const pointData = segments.map(S => {
    const depthVals = [];
    if (Number.isFinite(S.depth_start)) depthVals.push(S.depth_start);
    if (Number.isFinite(S.depth_end)) depthVals.push(S.depth_end);
    if (!depthVals.length) return null;

    const avgDepth = depthVals.reduce((sum, val) => sum + val, 0) / depthVals.length;
    const depth = clampDepth(avgDepth);
    if (depth < depthMin - 1e-9 || depth > depthMax + 1e-9) return null;

    const avail = Number.isFinite(S.avail_tension_kgf) ? S.avail_tension_kgf : null;
    const hasRequired = Number.isFinite(S.tension_required_kgf);
    const hasTheoretical = Number.isFinite(S.tension_theoretical_kgf);

    let tension = hasRequired ? S.tension_required_kgf : null;
    let sourceLabel = hasRequired ? 'Required tension' : null;

    if (!Number.isFinite(tension) && hasTheoretical) {
      tension = S.tension_theoretical_kgf;
      sourceLabel = 'Theoretical tension';
    }

    if (!Number.isFinite(tension) && Number.isFinite(payload_kg) && Number.isFinite(cable_w_kgpm)) {
      const estimate = tension_kgf(depth, payload_kg, cable_w_kgpm);
      if (Number.isFinite(estimate)) {
        tension = +(estimate * TENSION_SAFETY_FACTOR).toFixed(1);
        sourceLabel = 'Estimated required tension';
      }
    }

    if (!Number.isFinite(tension)) return null;
    if (tension < tensionMin - 1e-9 || tension > tensionMax + 1e-9) return null;

    let color = accentColor;
    if (Number.isFinite(avail) && tension > avail + 1e-3) color = EXCEED_COLOR;

    const tooltipParts = [];
    if (S.label) tooltipParts.push(S.label);
    tooltipParts.push(`Depth ≈ ${depth.toFixed(1)} m`);
    tooltipParts.push(`${sourceLabel || 'Tension'} ≈ ${Math.round(tension)} kgf`);
    if (Number.isFinite(avail)) tooltipParts.push(`Available: ${Math.round(avail)} kgf`);

    return {
      depth,
      tension,
      color,
      title: tooltipParts.join('
')
    };
  }).filter(Boolean);

  pointData.sort((a, b) => a.depth - b.depth);

  pointData.forEach(point => {
    const circle = svgEl('circle', {
      cx: sx(point.depth),
      cy: sy(point.tension),
      r: 5,
      fill: point.color,
      stroke: '#fff',
      'stroke-width': 1.5
    });
    if (point.title) {
      const title = svgEl('title', {});
      title.textContent = point.title;
      circle.appendChild(title);
    }
    svg.appendChild(circle);
  });

  if (tensionMin <= 0 && tensionMax >= 0) {
    svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
  }
}

function coerceNumeric(wrap, field) {
  if (!wrap) return null;
  const fields = Array.isArray(field) ? field : [field];
  for (const name of fields) {
    if (!name) continue;
    const raw = wrap[name];
    if (Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/,/g, '').trim();
      if (!cleaned) continue;
      const parsed = Number.parseFloat(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}


function wrapsToDepthSegments(wraps, speedField, tensionField, deadEnd = 0, scenario = 'electric') {
  /** @type {Array<Object>} */
  const segments = [];
  let fallbackStart = null;

  for (const wrap of wraps) {
    if (!wrap) continue;
    const totalLen = coerceNumeric(wrap, 'total_cable_len_m');
    const preOn = coerceNumeric(wrap, 'pre_spooled_len_m');
    let depthEnd = coerceNumeric(wrap, ['post_dep', 'post_deployed_m', 'deployed_len_m']);

    if (!Number.isFinite(depthEnd)) {
      fallbackStart = null;
      continue;
    }

    let depthStart = coerceNumeric(wrap, ['pre_dep', 'pre_deployed_m']);
    if (Number.isFinite(totalLen) && Number.isFinite(preOn) && !Number.isFinite(depthStart)) {
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

    const speedValMpm = coerceNumeric(wrap, speedField);
    const candidateFields = (scenario === 'hydraulic')
      ? [
          { field: ['vP', 'vp', 'v_p', 'vp_mpm', 'hyd_speed_power_mpm'], kind: 'power' },
          { field: ['vQ', 'vq', 'v_q', 'vq_mpm', 'hyd_speed_flow_mpm'], kind: 'flow' }
        ]
      : [];
    /** @type {{kind: 'power'|'flow', value_ms: number}[]} */
    const candidateSpeedsMs = [];
    for (const { field, kind } of candidateFields) {
      const val = coerceNumeric(wrap, field);
      if (!Number.isFinite(val)) continue;
      const ms = val / 60;
      if (Number.isFinite(ms)) candidateSpeedsMs.push({ kind, value_ms: ms });
    }

    const speedMs = Number.isFinite(speedValMpm) ? speedValMpm / 60 : null;
    /** @type {{kind: 'power'|'flow', value_ms: number}[]} */
    const filteredCandidates = [];
    const seenKeys = new Set();
    for (const candidate of candidateSpeedsMs) {
      if (speedMs !== null && Math.abs(candidate.value_ms - speedMs) <= 1e-6) {
        continue;
      }
      const key = `${candidate.kind}:${candidate.value_ms.toFixed(6)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      filteredCandidates.push(candidate);
    }
    const tensionVal = coerceNumeric(wrap, tensionField);
    const requiredVal = coerceNumeric(wrap, [
      'tension_required_kgf',
      'tension_req_kgf'
    ]);
    const theoreticalVal = coerceNumeric(wrap, [
      'tension_theoretical_kgf',
      'tension_theo_kgf'
    ]);

    segments.push({
      depth_start: depthStart,
      depth_end: depthEnd,
      speed_ms: speedMs,
      candidate_speeds_ms: filteredCandidates,
      avail_tension_kgf: Number.isFinite(tensionVal) ? tensionVal : null,
      tension_required_kgf: Number.isFinite(requiredVal) ? requiredVal : null,
      tension_theoretical_kgf: Number.isFinite(theoreticalVal) ? theoreticalVal : null,
      label: Number.isFinite(wrap.wrap_no)
        ? `W${wrap.wrap_no}`
        : (Number.isFinite(wrap.layer_no) ? `L${wrap.layer_no}` : '')
    });

    fallbackStart = depthEnd + deadEnd;
  }

  return segments;
}
