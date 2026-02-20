// ===== plots/depth-profiles.mjs  Speed vs Depth & Tension vs Depth (DOM-agnostic) =====
import { niceTicks, svgEl } from '../utils.mjs';

const CANDIDATE_POWER_COLOR = '#9249c6'; // purple
const CANDIDATE_FLOW_COLOR = '#eed500'; // yellow
const EXCEED_COLOR = '#c65353'; // red
const TENSION_REQUIRED_COLOR = '#7f8c99'; // matches legend swatch
const RATED_SPEED_COLOR = '#888888'; // gray
const PITA_PINK = 'e056e8'; // pink
const CLARS_BLUE = '#2163a5'; // blue

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
  operating_depth_m = null,
  rated_swl_kgf = null,
  depth_xmin = 0,
  depth_xmax = null,
  speed_ymin = 0,
  speed_ymax = null,
  tension_depth_xmin = null,
  tension_depth_xmax = null,
  tension_ymin = 0,
  tension_ymax = null,
  speed_primary_label = null,
  speed_extra_profiles = []
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
  const opDepth = Number.isFinite(operating_depth_m) ? Math.max(0, operating_depth_m) : null;
  const ratedSwl = Number.isFinite(rated_swl_kgf) ? Math.max(0, rated_swl_kgf) : null;
  const maxAvailT = Math.max(0, ...segments.map(S => S.avail_tension_kgf || 0));
  const toNumber = val => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return NaN;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    const num = Number(val);
    return Number.isFinite(num) ? num : NaN;
  };

  let depthMin = toNumber(depth_xmin);
  if (!Number.isFinite(depthMin) || depthMin < 0) depthMin = 0;

  let depthMax = toNumber(depth_xmax);
  const depthCandidates = [depthMin + 0.1];
  if (Number.isFinite(maxDepth)) depthCandidates.push(maxDepth);
  if (Number.isFinite(opDepth)) depthCandidates.push(opDepth);
  const autoDepthMax = Math.max(...depthCandidates);
  if (Number.isFinite(depthMax)) {
    depthMax = Math.max(depthMin + 0.1, depthMax);
  } else {
    depthMax = autoDepthMax;
  }
  if (depthMax <= depthMin) depthMax = depthMin + 1;

  let speedMin = toNumber(speed_ymin);
  if (!Number.isFinite(speedMin) || speedMin < 0) speedMin = 0;

  let speedMax = toNumber(speed_ymax);
  const autoSpeedMax = Math.max(speedMin + 0.1, 3, maxSpeedFromCandidates, ratedSpeedMs || 0);
  if (Number.isFinite(speedMax)) {
    speedMax = Math.max(speedMin + 0.1, speedMax);
  } else {
    speedMax = autoSpeedMax;
  }
  if (speedMax <= speedMin) speedMax = speedMin + 1;

  let tensionDepthMin = toNumber(tension_depth_xmin);
  if (!Number.isFinite(tensionDepthMin) || tensionDepthMin < 0) tensionDepthMin = depthMin;

  let tensionDepthMax = toNumber(tension_depth_xmax);
  const tensionDepthCandidates = [tensionDepthMin + 0.1];
  if (Number.isFinite(maxDepth)) tensionDepthCandidates.push(maxDepth);
  if (Number.isFinite(opDepth)) tensionDepthCandidates.push(opDepth);
  const autoTensionDepthMax = Math.max(...tensionDepthCandidates);
  if (Number.isFinite(tensionDepthMax)) {
    tensionDepthMax = Math.max(tensionDepthMin + 0.1, tensionDepthMax);
  } else {
    tensionDepthMax = autoTensionDepthMax;
  }
  if (tensionDepthMax <= tensionDepthMin) tensionDepthMax = tensionDepthMin + 1;

  const tensionDepth = Math.max(maxDepth, tensionDepthMax);
  const maxTheoT = payload_kg + cable_w_kgpm * tensionDepth;
  const maxReqT = maxTheoT;

  let tensionMin = toNumber(tension_ymin);
  if (!Number.isFinite(tensionMin) || tensionMin < 0) tensionMin = 0;

  let tensionMax = toNumber(tension_ymax);
  const swlTarget = Number.isFinite(ratedSwl) ? ratedSwl * 1.5 : 0;
  const autoTensionBase = Math.max(tensionMin + 1, maxReqT, maxAvailT, swlTarget);
  const autoTensionMax = autoTensionBase * 1.05;
  if (Number.isFinite(tensionMax)) {
    tensionMax = Math.max(tensionMin + 1, tensionMax);
  } else {
    tensionMax = autoTensionMax;
  }
  if (tensionMax <= tensionMin) tensionMax = tensionMin + 1;

  const accentColor = getAccentColor();

  // Render both
  drawSpeedProfile(svgSpeed, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs, {
    primaryLabel: speed_primary_label,
    extraProfiles: Array.isArray(speed_extra_profiles) ? speed_extra_profiles : [],
    enablePins: true
  });
  drawTensionProfile(svgTension, segments, tensionDepthMin, tensionDepthMax, tensionMin, tensionMax, payload_kg, cable_w_kgpm, accentColor);
}

// ---------- Speed vs Depth ----------
function drawSpeedProfile(svg, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs = null, options = {}) {
  if (svg && svg._depthSpeedHandlers) {
    const { move, leave, click, contextmenu, dblclick } = svg._depthSpeedHandlers;
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
    svg.removeEventListener('pointerenter', move);
    if (click) svg.removeEventListener('click', click);
    if (contextmenu) svg.removeEventListener('contextmenu', contextmenu);
    if (dblclick) svg.removeEventListener('dblclick', dblclick);
    delete svg._depthSpeedHandlers;
  }

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

  const extraProfiles = Array.isArray(options.extraProfiles) ? options.extraProfiles : [];
  const enablePins = Boolean(options.enablePins);
  const showLegend = options && options.showLegend !== undefined ? Boolean(options.showLegend) : true;
  const legendEntries = [];
  if (showLegend && options.primaryLabel) {
    legendEntries.push({ label: options.primaryLabel, color: accentColor, strokeWidth: 4.8, strokeDasharray: null });
  }
  if (showLegend) {
    extraProfiles.forEach(profile => {
      if (!profile || !profile.label) return;
      const defaultDash = '6 4';
      const strokeDash = (profile.legendStrokeDasharray === undefined)
        ? ((profile.strokeDasharray === undefined) ? defaultDash : profile.strokeDasharray)
        : profile.legendStrokeDasharray;
      const strokeWidth = Number.isFinite(profile.legendStrokeWidth)
        ? profile.legendStrokeWidth
        : (Number.isFinite(profile.strokeWidth) ? profile.strokeWidth : 3);
      legendEntries.push({
        label: profile.label,
        color: profile.color || '#555',
        strokeDasharray: strokeDash,
        strokeWidth
      });
    });
  }

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  niceTicks(depthMin, depthMax, 8).ticks.forEach(dx => {
    if (dx < depthMin - 1e-9 || dx > depthMax + 1e-9) return;
    const X = sx(dx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - MB + 18, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
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

  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
    .textContent = 'Depth (m)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = 'Speed (m/s)';

  const inlineLabels = [];
  extraProfiles.forEach(profile => {
    if (!profile || !Array.isArray(profile.segments)) return;
    const strokeColor = profile.color || '#555';
    const defaultDash = '6 4';
    const strokeDash = (profile.strokeDasharray === undefined) ? defaultDash : profile.strokeDasharray;
    const strokeWidth = Number.isFinite(profile.strokeWidth) ? profile.strokeWidth : 2;
    let labelPlaced = false;
    profile.segments.forEach(seg => {
      if (!seg || !Number.isFinite(seg.speed_ms)) return;
      const depthEnd = Math.min(seg.depth_start, seg.depth_end);
      const depthStart = Math.max(seg.depth_start, seg.depth_end);
      if (Math.max(depthStart, depthEnd) < depthMin - 1e-9) return;
      if (Math.min(depthStart, depthEnd) > depthMax + 1e-9) return;
      if (seg.speed_ms < speedMin - 1e-9 || seg.speed_ms > speedMax + 1e-9) return;
      const x0 = sx(depthEnd);
      const x1 = sx(depthStart);
      if (Math.abs(x1 - x0) < 1e-6) return;
      const y = sy(seg.speed_ms);
      const attrs = {
        x1: x0,
        y1: y,
        x2: x1,
        y2: y,
        stroke: strokeColor,
        'stroke-width': strokeWidth
      };
      if (strokeDash) attrs['stroke-dasharray'] = strokeDash;
      svg.appendChild(svgEl('line', attrs));

      if (!labelPlaced && profile.inlineLabel) {
        const span = Math.abs(x1 - x0);
        if (span >= 6) {
          const midX = (x0 + x1) / 2;
          const clampedX = Math.min(Math.max(midX, ML + 24), W - MR - 24);
          const labelYRaw = y - 8;
          const clampedY = Math.min(Math.max(labelYRaw, MT + 12), H - MB - 12);
          inlineLabels.push({
            text: profile.inlineLabel,
            x: clampedX,
            y: clampedY,
            color: profile.inlineLabelColor || strokeColor
          });
          labelPlaced = true;
        }
      }
    });
  });

  inlineLabels.forEach(label => {
    const textAttrs = {
      x: label.x,
      y: label.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': '12',
      fill: label.color,
      style: 'paint-order: stroke; stroke: #fff; stroke-width: 3px;'
    };
    const textEl = svgEl('text', textAttrs);
    textEl.textContent = label.text;
    svg.appendChild(textEl);
  });

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

  let pins = [];
  const getPins = () => {
    if (!Array.isArray(svg._depthSpeedPins)) svg._depthSpeedPins = [];
    return svg._depthSpeedPins;
  };

  if (enablePins) {
    pins = getPins()
      .filter(pin => Number.isFinite(pin.depth) && Number.isFinite(pin.speed))
      .map((pin, idx) => ({
        ...pin,
        depth: clampDepth(pin.depth),
        speed: clampSpeed(pin.speed),
        label: pin.label || `P${idx + 1}`
      }));
    pins.forEach((pin, idx) => {
      pin.label = `P${idx + 1}`;
    });
    svg._depthSpeedPins = pins;

    pins.forEach(pin => {
      const x = sx(pin.depth);
      const y = sy(pin.speed);
      svg.appendChild(svgEl('circle', {
        cx: x,
        cy: y,
        r: 5,
        fill: accentColor,
        stroke: '#fff',
        'stroke-width': 1.5
      }));
      const pinLabel = svgEl('text', {
        x: x + 8,
        y: y - 8,
        'font-size': '11',
        fill: accentColor,
        style: 'paint-order: stroke; stroke: #fff; stroke-width: 2px;'
      });
      pinLabel.textContent = `${pin.label} (${formatDepthLabel(pin.depth)} m, ${pin.speed.toFixed(2)} m/s)`;
      svg.appendChild(pinLabel);
    });
  }

  const hoverLayer = svgEl('g', { 'pointer-events': 'none' });
  const hoverVLine = svgEl('line', {
    x1: ML,
    x2: ML,
    y1: MT,
    y2: H - MB,
    stroke: accentColor,
    'stroke-width': 1.5,
    'stroke-dasharray': '6 4',
    opacity: 0
  });
  const hoverHLine = svgEl('line', {
    x1: ML,
    x2: W - MR,
    y1: MT,
    y2: MT,
    stroke: accentColor,
    'stroke-width': 1.5,
    'stroke-dasharray': '6 4',
    opacity: 0
  });
  const hoverXLabel = svgEl('text', {
    x: ML,
    y: H - MB + 20,
    'text-anchor': 'middle',
    'font-size': '12',
    fill: accentColor,
    opacity: 0
  });
  const hoverYLabel = svgEl('text', {
    x: ML - 8,
    y: MT,
    'text-anchor': 'end',
    'font-size': '12',
    fill: accentColor,
    opacity: 0
  });
  hoverLayer.appendChild(hoverVLine);
  hoverLayer.appendChild(hoverHLine);
  hoverLayer.appendChild(hoverXLabel);
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
    return {
      x: offsetX + (evt.clientX - rect.left) * scaleX,
      y: offsetY + (evt.clientY - rect.top) * scaleY
    };
  };

  const updateHover = evt => {
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) {
      hoverVLine.setAttribute('opacity', '0');
      hoverHLine.setAttribute('opacity', '0');
      hoverXLabel.setAttribute('opacity', '0');
      hoverYLabel.setAttribute('opacity', '0');
      return;
    }

    const clampedX = clamp(localX, ML, W - MR);
    const clampedY = clamp(localY, MT, H - MB);
    const depthVal = depthMin + ((clampedX - ML) / Math.max(innerW, 1e-9)) * depthSpan;
    const speedVal = speedMax - ((clampedY - MT) / Math.max(innerH, 1e-9)) * speedSpan;

    hoverVLine.setAttribute('x1', clampedX);
    hoverVLine.setAttribute('x2', clampedX);
    hoverVLine.setAttribute('opacity', '1');
    hoverHLine.setAttribute('y1', clampedY);
    hoverHLine.setAttribute('y2', clampedY);
    hoverHLine.setAttribute('opacity', '1');

    const depthLabel = formatDepthLabel(depthVal);
    const speedLabel = Math.round(speedVal * 100) / 100;
    hoverXLabel.setAttribute('x', clampedX);
    hoverXLabel.textContent = `${depthLabel} m`;
    hoverXLabel.setAttribute('opacity', '1');
    hoverYLabel.setAttribute('y', clampedY + 4);
    hoverYLabel.textContent = `${speedLabel.toFixed(2)} m/s`;
    hoverYLabel.setAttribute('opacity', '1');
  };

  const hideHover = () => {
    hoverVLine.setAttribute('opacity', '0');
    hoverHLine.setAttribute('opacity', '0');
    hoverXLabel.setAttribute('opacity', '0');
    hoverYLabel.setAttribute('opacity', '0');
  };

  svg.addEventListener('pointermove', updateHover);
  svg.addEventListener('pointerenter', updateHover);
  svg.addEventListener('pointerleave', hideHover);

  let clickHandler = null;
  let contextMenuHandler = null;
  let clearPinsHandler = null;
  if (enablePins) {
    const nearestPinIndex = (depthVal, speedVal) => {
      const tolDepth = Math.max(0.25, depthSpan * 0.015);
      const tolSpeed = Math.max(0.05, speedSpan * 0.02);
      let bestIdx = -1;
      let bestScore = Infinity;
      getPins().forEach((pin, idx) => {
        const dDepth = Math.abs(pin.depth - depthVal);
        const dSpeed = Math.abs(pin.speed - speedVal);
        if (dDepth <= tolDepth && dSpeed <= tolSpeed) {
          const score = dDepth / tolDepth + dSpeed / tolSpeed;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
      });
      return bestIdx;
    };

    clickHandler = evt => {
      const { x: localX, y: localY } = toViewBoxPoint(evt);
      if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
      const depthVal = depthMin + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * depthSpan;
      const speedVal = speedMax - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * speedSpan;
      const roundedDepth = Math.round(depthVal * 10) / 10;
      const roundedSpeed = Math.round(speedVal * 100) / 100;
      const existingIdx = nearestPinIndex(roundedDepth, roundedSpeed);
      if (existingIdx === -1) {
        const nextPins = [...getPins(), { depth: roundedDepth, speed: roundedSpeed, label: '' }]
          .map((pin, idx) => ({ ...pin, label: `P${idx + 1}` }));
        svg._depthSpeedPins = nextPins;
      }
      drawSpeedProfile(svg, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs, options);
    };

    contextMenuHandler = evt => {
      evt.preventDefault();
      const { x: localX, y: localY } = toViewBoxPoint(evt);
      if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
      const depthVal = depthMin + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * depthSpan;
      const speedVal = speedMax - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * speedSpan;
      const idx = nearestPinIndex(depthVal, speedVal);
      if (idx === -1) return;
      const nextPins = getPins().filter((_, pinIdx) => pinIdx !== idx)
        .map((pin, order) => ({ ...pin, label: `P${order + 1}` }));
      svg._depthSpeedPins = nextPins;
      drawSpeedProfile(svg, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs, options);
    };

    clearPinsHandler = () => {
      svg._depthSpeedPins = [];
      drawSpeedProfile(svg, segments, depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs, options);
    };

    svg.addEventListener('click', clickHandler);
    svg.addEventListener('contextmenu', contextMenuHandler);
    svg.addEventListener('dblclick', clearPinsHandler);
  }

  svg._depthSpeedHandlers = {
    move: updateHover,
    leave: hideHover,
    click: clickHandler,
    contextmenu: contextMenuHandler,
    dblclick: clearPinsHandler
  };

  if (legendEntries.length) {
    const legendGroup = svgEl('g', {});
    const legendX = W - MR - 180;
    let offsetY = 0;
    legendEntries.forEach(entry => {
      const g = svgEl('g', { transform: `translate(${legendX},${MT + 16 + offsetY})` });
      const lineAttrs = {
        x1: 0,
        y1: 0,
        x2: 22,
        y2: 0,
        stroke: entry.color || '#555',
        'stroke-width': Number.isFinite(entry.strokeWidth) ? entry.strokeWidth : 3
      };
      if (entry.strokeDasharray) lineAttrs['stroke-dasharray'] = entry.strokeDasharray;
      g.appendChild(svgEl('line', lineAttrs));
      const text = svgEl('text', { x: 28, y: 4, 'font-size': '12', fill: '#333' });
      text.textContent = entry.label;
      g.appendChild(text);
      legendGroup.appendChild(g);
      offsetY += 18;
    });
    svg.appendChild(legendGroup);
  }
}

export function drawStandaloneSpeedProfiles(svg, {
  segments = [],
  extraProfiles = [],
  depthMin: depthMinOverride,
  depthMax: depthMaxOverride,
  speedMin: speedMinOverride,
  speedMax: speedMaxOverride,
  ratedSpeedMs = null,
  primaryLabel = null,
  accentColor: accentOverride,
  showLegend = true
} = {}) {
  if (!svg) return;

  const allSegments = [];
  const collectSegment = seg => {
    if (!seg) return;
    const d0 = Number.isFinite(seg.depth_start) ? seg.depth_start : null;
    const d1 = Number.isFinite(seg.depth_end) ? seg.depth_end : null;
    const speed = Number.isFinite(seg.speed_ms) ? seg.speed_ms : null;
    if (Number.isFinite(d0)) allSegments.push({ type: 'depth', value: d0 });
    if (Number.isFinite(d1)) allSegments.push({ type: 'depth', value: d1 });
    if (Number.isFinite(speed)) allSegments.push({ type: 'speed', value: speed });
  };

  (segments || []).forEach(collectSegment);
  (extraProfiles || []).forEach(profile => {
    if (!profile || !Array.isArray(profile.segments)) return;
    profile.segments.forEach(collectSegment);
  });

  let depthMin = Number.isFinite(depthMinOverride) ? Math.max(0, depthMinOverride) : 0;
  let depthMax;
  if (Number.isFinite(depthMaxOverride)) {
    depthMax = Math.max(depthMin + 0.1, depthMaxOverride);
  } else {
    const depthCandidates = [depthMin + 0.1];
    allSegments.forEach(entry => {
      if (entry.type === 'depth' && Number.isFinite(entry.value)) depthCandidates.push(entry.value);
    });
    const autoDepthMax = Math.max(...depthCandidates);
    depthMax = Number.isFinite(autoDepthMax) ? autoDepthMax : depthMin + 1;
  }
  if (!Number.isFinite(depthMax) || depthMax <= depthMin) depthMax = depthMin + 1;

  let speedMin = Number.isFinite(speedMinOverride) ? Math.max(0, speedMinOverride) : 0;
  let speedMax;
  if (Number.isFinite(speedMaxOverride)) {
    speedMax = Math.max(speedMin + 0.1, speedMaxOverride);
  } else {
    const speedCandidates = [speedMin + 0.1, 3];
    allSegments.forEach(entry => {
      if (entry.type === 'speed' && Number.isFinite(entry.value)) speedCandidates.push(entry.value);
    });
    const autoSpeedMax = Math.max(...speedCandidates);
    speedMax = Number.isFinite(autoSpeedMax) ? autoSpeedMax : speedMin + 1;
  }
  if (!Number.isFinite(speedMax) || speedMax <= speedMin) speedMax = speedMin + 1;

  const accentColor = accentOverride || getAccentColor();

  drawSpeedProfile(svg, segments || [], depthMin, depthMax, speedMin, speedMax, accentColor, ratedSpeedMs, {
    primaryLabel,
    extraProfiles: Array.isArray(extraProfiles) ? extraProfiles : [],
    showLegend
  });
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
  if (svg && svg._depthTensionHandlers) {
    const { move, leave, pointerup, contextmenu, dblclick } = svg._depthTensionHandlers;
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
    svg.removeEventListener('pointerenter', move);
    if (pointerup) svg.removeEventListener('pointerup', pointerup);
    if (contextmenu) svg.removeEventListener('contextmenu', contextmenu);
    if (dblclick) svg.removeEventListener('dblclick', dblclick);
    delete svg._depthTensionHandlers;
  }

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
    const t = svgEl('text', { x: X, y: H - MB + 18, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
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

  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
    .textContent = 'Depth (m)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = 'Tension (kgf)';

  const normalizedSegments = segments.map(S => {
    const depthStartRaw = Math.max(S.depth_start, S.depth_end);
    const depthEndRaw = Math.min(S.depth_start, S.depth_end);
    if (!Number.isFinite(depthStartRaw) || !Number.isFinite(depthEndRaw)) return null;
    if (Math.max(depthStartRaw, depthEndRaw) < depthMin - 1e-9) return null;
    if (Math.min(depthStartRaw, depthEndRaw) > depthMax + 1e-9) return null;
    return {
      depth_start: clampDepth(depthStartRaw),
      depth_end: clampDepth(depthEndRaw),
      avail_tension_kgf: Number.isFinite(S.avail_tension_kgf) ? S.avail_tension_kgf : null
    };
  }).filter(Boolean);

  const safePayload = Number.isFinite(payload_kg) ? payload_kg : 0;
  const safeCableWeight = Number.isFinite(cable_w_kgpm) ? cable_w_kgpm : 0;
  const requirementIntercept = safePayload;
  const requirementSlope = safeCableWeight;
  const requiredAt = depth => requirementIntercept + requirementSlope * depth;

  const availablePieces = [];
  normalizedSegments.forEach(seg => {
    const avail = seg.avail_tension_kgf;
    if (!Number.isFinite(avail)) return;
    if (avail < tensionMin - 1e-9 || avail > tensionMax + 1e-9) return;
    const dShallow = Math.min(seg.depth_start, seg.depth_end);
    const dDeep = Math.max(seg.depth_start, seg.depth_end);
    if (dDeep - dShallow < 1e-9) return;

    const requiredShallow = requiredAt(dShallow);
    const requiredDeep = requiredAt(dDeep);
    const meetsShallow = avail >= requiredShallow - 1e-6;
    const meetsDeep = avail >= requiredDeep - 1e-6;

    if (Math.abs(requirementSlope) < 1e-9 || meetsShallow === meetsDeep) {
      availablePieces.push({
        d0: dShallow,
        d1: dDeep,
        tension: avail,
        color: meetsShallow ? accentColor : EXCEED_COLOR
      });
      return;
    }

    const crossingDepth = (avail - requirementIntercept) / requirementSlope;
    const clampedCross = Math.min(Math.max(crossingDepth, dShallow), dDeep);
    if (clampedCross - dShallow > 1e-9) {
      availablePieces.push({
        d0: dShallow,
        d1: clampedCross,
        tension: avail,
        color: meetsShallow ? accentColor : EXCEED_COLOR
      });
    }
    if (dDeep - clampedCross > 1e-9) {
      availablePieces.push({
        d0: clampedCross,
        d1: dDeep,
        tension: avail,
        color: meetsShallow ? EXCEED_COLOR : accentColor
      });
    }
  });

  availablePieces.forEach(seg => {
    const x0 = sx(seg.d0);
    const x1 = sx(seg.d1);
    if (Math.abs(x1 - x0) < 1e-6) return;
    const y = sy(seg.tension);
    svg.appendChild(svgEl('line', {
      x1: x0,
      y1: y,
      x2: x1,
      y2: y,
      stroke: seg.color,
      'stroke-width': 2.4
    }));
  });

  const drawPieces = (pieces, { strokeWidth = 2, dash = null } = {}) => {
    pieces.forEach(seg => {
      const d0 = clampDepth(seg.d0);
      const d1 = clampDepth(seg.d1);
      if (Math.abs(d1 - d0) < 1e-6) return;
      const pts = [
        [sx(d0), sy(seg.T0)],
        [sx(d1), sy(seg.T1)]
      ];
      const attrs = {
        d: pathFrom(pts),
        fill: 'none',
        stroke: seg.color,
        'stroke-width': strokeWidth
      };
      if (dash) attrs['stroke-dasharray'] = dash;
      svg.appendChild(svgEl('path', attrs));
    });
  };

  const requirementPieces = buildRequirementCurve(depthMin, depthMax, payload_kg, cable_w_kgpm);
  drawPieces(requirementPieces, { strokeWidth: 2, dash: '6 4' });

  if (tensionMin <= 0 && tensionMax >= 0) {
    svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
  }

  let pins = [];
  const getPins = () => {
    if (!Array.isArray(svg._depthTensionPins)) svg._depthTensionPins = [];
    return svg._depthTensionPins;
  };

  pins = getPins()
    .filter(pin => Number.isFinite(pin.depth) && Number.isFinite(pin.tension))
    .map((pin, idx) => ({
      ...pin,
      depth: clampDepth(pin.depth),
      tension: clampTension(pin.tension),
      label: pin.label || `P${idx + 1}`
    }));
  pins.forEach((pin, idx) => {
    pin.label = `P${idx + 1}`;
  });
  svg._depthTensionPins = pins;

  pins.forEach(pin => {
    const x = sx(pin.depth);
    const y = sy(pin.tension);
    svg.appendChild(svgEl('circle', {
      cx: x,
      cy: y,
      r: 5,
      fill: accentColor,
      stroke: '#fff',
      'stroke-width': 1.5
    }));
    const pinLabel = svgEl('text', {
      x: x + 8,
      y: y - 8,
      'font-size': '11',
      fill: accentColor,
      style: 'paint-order: stroke; stroke: #fff; stroke-width: 2px;'
    });
    pinLabel.textContent = `${pin.label} (${formatDepthLabel(pin.depth)} m, ${removeTrailingZeros((Math.round(pin.tension * 10) / 10).toFixed(1))} kgf)`;
    svg.appendChild(pinLabel);
  });

  const hoverLayer = svgEl('g', { 'pointer-events': 'none' });
  const hoverVLine = svgEl('line', {
    x1: ML,
    x2: ML,
    y1: MT,
    y2: H - MB,
    stroke: accentColor,
    'stroke-width': 1.5,
    'stroke-dasharray': '6 4',
    opacity: 0
  });
  const hoverHLine = svgEl('line', {
    x1: ML,
    x2: W - MR,
    y1: MT,
    y2: MT,
    stroke: accentColor,
    'stroke-width': 1.5,
    'stroke-dasharray': '6 4',
    opacity: 0
  });
  const hoverXLabel = svgEl('text', {
    x: ML,
    y: H - MB + 20,
    'text-anchor': 'middle',
    'font-size': '12',
    fill: accentColor,
    opacity: 0
  });
  const hoverYLabel = svgEl('text', {
    x: ML - 8,
    y: MT,
    'text-anchor': 'end',
    'font-size': '12',
    fill: accentColor,
    opacity: 0
  });
  hoverLayer.appendChild(hoverVLine);
  hoverLayer.appendChild(hoverHLine);
  hoverLayer.appendChild(hoverXLabel);
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
    return {
      x: offsetX + (evt.clientX - rect.left) * scaleX,
      y: offsetY + (evt.clientY - rect.top) * scaleY
    };
  };

  const updateHover = evt => {
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) {
      hoverVLine.setAttribute('opacity', '0');
      hoverHLine.setAttribute('opacity', '0');
      hoverXLabel.setAttribute('opacity', '0');
      hoverYLabel.setAttribute('opacity', '0');
      return;
    }

    const clampedX = clamp(localX, ML, W - MR);
    const clampedY = clamp(localY, MT, H - MB);
    const depthVal = depthMin + ((clampedX - ML) / Math.max(innerW, 1e-9)) * depthSpan;
    const tensionVal = tensionMax - ((clampedY - MT) / Math.max(innerH, 1e-9)) * tensionSpan;

    hoverVLine.setAttribute('x1', clampedX);
    hoverVLine.setAttribute('x2', clampedX);
    hoverVLine.setAttribute('opacity', '1');
    hoverHLine.setAttribute('y1', clampedY);
    hoverHLine.setAttribute('y2', clampedY);
    hoverHLine.setAttribute('opacity', '1');

    const depthLabel = formatDepthLabel(depthVal);
    const tensionLabel = removeTrailingZeros((Math.round(tensionVal * 10) / 10).toFixed(1));
    hoverXLabel.setAttribute('x', clampedX);
    hoverXLabel.textContent = `${depthLabel} m`;
    hoverXLabel.setAttribute('opacity', '1');
    hoverYLabel.setAttribute('y', clampedY + 4);
    hoverYLabel.textContent = `${tensionLabel} kgf`;
    hoverYLabel.setAttribute('opacity', '1');
  };

  const hideHover = () => {
    hoverVLine.setAttribute('opacity', '0');
    hoverHLine.setAttribute('opacity', '0');
    hoverXLabel.setAttribute('opacity', '0');
    hoverYLabel.setAttribute('opacity', '0');
  };

  svg.addEventListener('pointermove', updateHover);
  svg.addEventListener('pointerenter', updateHover);
  svg.addEventListener('pointerleave', hideHover);

  const nearestPinIndex = (depthVal, tensionVal) => {
    const tolDepth = Math.max(0.25, depthSpan * 0.015);
    const tolTension = Math.max(5, tensionSpan * 0.02);
    let bestIdx = -1;
    let bestScore = Infinity;
    getPins().forEach((pin, idx) => {
      const dDepth = Math.abs(pin.depth - depthVal);
      const dTension = Math.abs(pin.tension - tensionVal);
      if (dDepth <= tolDepth && dTension <= tolTension) {
        const score = dDepth / tolDepth + dTension / tolTension;
        if (score < bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
    });
    return bestIdx;
  };

  const pointerUpHandler = evt => {
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
    const depthVal = depthMin + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * depthSpan;
    const tensionVal = tensionMax - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * tensionSpan;
    const roundedDepth = Math.round(depthVal * 10) / 10;
    const roundedTension = Math.round(tensionVal * 10) / 10;
    const existingIdx = nearestPinIndex(roundedDepth, roundedTension);
    if (existingIdx === -1) {
      const nextPins = [...getPins(), { depth: roundedDepth, tension: roundedTension, label: '' }]
        .map((pin, idx) => ({ ...pin, label: `P${idx + 1}` }));
      svg._depthTensionPins = nextPins;
    }
    drawTensionProfile(svg, segments, depthMin, depthMax, tensionMin, tensionMax, payload_kg, cable_w_kgpm, accentColor);
  };

  const contextMenuHandler = evt => {
    evt.preventDefault();
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
    const depthVal = depthMin + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * depthSpan;
    const tensionVal = tensionMax - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * tensionSpan;
    const idx = nearestPinIndex(depthVal, tensionVal);
    if (idx === -1) return;
    const nextPins = getPins().filter((_, pinIdx) => pinIdx !== idx)
      .map((pin, order) => ({ ...pin, label: `P${order + 1}` }));
    svg._depthTensionPins = nextPins;
    drawTensionProfile(svg, segments, depthMin, depthMax, tensionMin, tensionMax, payload_kg, cable_w_kgpm, accentColor);
  };

  const clearPinsHandler = () => {
    svg._depthTensionPins = [];
    drawTensionProfile(svg, segments, depthMin, depthMax, tensionMin, tensionMax, payload_kg, cable_w_kgpm, accentColor);
  };

  svg.addEventListener('pointerup', pointerUpHandler);
  svg.addEventListener('contextmenu', contextMenuHandler);
  svg.addEventListener('dblclick', clearPinsHandler);

  svg._depthTensionHandlers = {
    move: updateHover,
    leave: hideHover,
    pointerup: pointerUpHandler,
    contextmenu: contextMenuHandler,
    dblclick: clearPinsHandler
  };

  function pathFrom(pts) {
    if (!pts.length) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    return d;
  }
}

function buildRequirementCurve(depthMin, depthMax, payload_kg, cable_w_kgpm) {
  if (!Number.isFinite(depthMin) || !Number.isFinite(depthMax)) return [];
  if (!Number.isFinite(payload_kg) || !Number.isFinite(cable_w_kgpm)) return [];

  const clampedMin = Math.min(depthMin, depthMax);
  const clampedMax = Math.max(depthMin, depthMax);
  if (Math.abs(clampedMax - clampedMin) < 1e-9) return [];


  return [{
    d0: clampedMin,
    d1: clampedMax,
    color: TENSION_REQUIRED_COLOR,
    T0: payload_kg + cable_w_kgpm * clampedMin,
    T1: payload_kg + cable_w_kgpm * clampedMax
  }];
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
      const key = `${candidate.kind}:${candidate.value_ms.toFixed(6)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      filteredCandidates.push(candidate);
    }
    const tensionVal = coerceNumeric(wrap, tensionField);

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
