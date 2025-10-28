// ===== plots/depth-profiles.mjs — Speed vs Depth & Tension vs Depth (DOM-agnostic) =====
import { niceTicks, svgEl } from '../utils.mjs';

/**
 * Draw both depth profile plots (speed & tension).
 *
 * @param {SVGSVGElement} svgSpeed
 * @param {SVGSVGElement} svgTension
 * @param {Object} opts
 * @param {'electric'|'hydraulic'} opts.scenario
 * @param {Array<Object>} opts.elLayers
 * @param {Array<Object>} opts.hyLayers
 * @param {number} opts.payload_kg
 * @param {number} opts.cable_w_kgpm
 */
export function drawDepthProfiles(svgSpeed, svgTension, {
  scenario = 'electric',
  elLayers = [],
  hyLayers = [],
  payload_kg = 0,
  cable_w_kgpm = 0
} = {}) {
  // Build layer intervals [depth_start, depth_end] with values
  let layers = [];
  if (scenario === 'electric') {
    layers = (elLayers || []).map(L => ({
      layer_no: L.layer_no,
      depth_start: L.pre_deployed_m,
      depth_end:   L.post_deployed_m,
      speed_ms: (Number.isFinite(+L.line_speed_at_start_mpm) ? (+L.line_speed_at_start_mpm) / 60 : null),
      avail_tension_kgf: (Number.isFinite(+L.avail_tension_kgf_at_start) ? +L.avail_tension_kgf_at_start : null)
    }));
  } else {
    layers = (hyLayers || []).map(L => ({
      layer_no: L.layer_no,
      depth_start: L.pre_deployed_m,
      depth_end:   L.post_deployed_m,
      speed_ms: (Number.isFinite(+L.hyd_speed_available_mpm) ? (+L.hyd_speed_available_mpm) / 60 : null),
      avail_tension_kgf: (Number.isFinite(+L.hyd_avail_tension_kgf_at_start) ? +L.hyd_avail_tension_kgf_at_start : null)
    }));
  }
  // Sort deep to shallow by start depth
  layers.sort((a, b) => b.depth_start - a.depth_start);

  // Extents
  const maxDepth = layers.length ? Math.max(...layers.map(L => L.depth_start)) : 0;
  const maxSpeed = Math.max(1, ...layers.map(L => L.speed_ms || 0));
  const maxAvailT = Math.max(0, ...layers.map(L => L.avail_tension_kgf || 0));
  const maxReqT = payload_kg + cable_w_kgpm * maxDepth;
  const maxTension = Math.max(maxReqT, maxAvailT) * 1.05 || 1;

  // Render both
  drawSpeedProfile(svgSpeed, layers, maxDepth, maxSpeed);
  drawTensionProfile(svgTension, layers, maxDepth, maxTension, payload_kg, cable_w_kgpm);
}

// ---------- Speed vs Depth ----------
function drawSpeedProfile(svg, layers, maxDepth, maxSpeed) {
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

  // step plot (gray) across each layer interval
  layers.forEach(L => {
    if (!Number.isFinite(L.speed_ms)) return;
    const y = sy(L.speed_ms);
    const x0 = sx(L.depth_end);
    const x1 = sx(L.depth_start);
    svg.appendChild(svgEl('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: '#999', 'stroke-width': 2 }));
    svg.appendChild(svgEl('text', { x: x1 - 3, y: y - 4, 'text-anchor': 'end', 'font-size': '11', fill: '#666' }))
       .textContent = `L${L.layer_no}`;
  });

  // zero line
  svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
}

// ---------- Tension vs Depth ----------
function drawTensionProfile(svg, layers, maxDepth, maxTension, payload_kg, cable_w_kgpm) {
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

  // required tension curve (solid black): Treq = payload + cable_w * depth
  const N = 200; const pts = [];
  for (let i = 0; i <= N; i++) {
    const d = maxDepth * i / N;
    const Treq = payload_kg + cable_w_kgpm * d;
    pts.push([sx(d), sy(Treq)]);
  }
  svg.appendChild(svgEl('path', { d: pathFrom(pts), fill: 'none', stroke: '#000', 'stroke-width': 2 }));

  // available tension as gray steps across each layer interval
  layers.forEach(L => {
    if (!Number.isFinite(L.avail_tension_kgf)) return;
    const y = sy(L.avail_tension_kgf);
    const x0 = sx(L.depth_end);
    const x1 = sx(L.depth_start);
    svg.appendChild(svgEl('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: '#999', 'stroke-width': 2 }));
    svg.appendChild(svgEl('text', { x: x1 - 3, y: y - 4, 'text-anchor': 'end', 'font-size': '11', fill: '#666' }))
       .textContent = `L${L.layer_no}`;
  });

  svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));

  function pathFrom(pts) {
    if (!pts.length) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    return d;
  }
}
