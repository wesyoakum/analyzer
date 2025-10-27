// ===== plots/wave-contours.mjs — Speed vs Period with wave-height contours (DOM-agnostic) =====
import { niceTicks, svgEl, svgPathFromPoints } from '../utils.mjs';

/**
 * Draw the wave contour plot (speed vs period with height contours).
 *
 * @param {SVGSVGElement} svg                      - target SVG element
 * @param {Object} opts
 * @param {'electric'|'hydraulic'} opts.scenario   - which layer speeds to plot
 * @param {number} opts.Tmin                       - min period (s)
 * @param {number} opts.Tmax                       - max period (s)
 * @param {number} opts.Hmax                       - max wave height (m, peak-to-trough)
 * @param {Array<Object>} opts.elLayers            - electric layer rows (for scenario='electric')
 * @param {Array<Object>} opts.hyLayers            - hydraulic layer rows (for scenario='hydraulic')
 */
export function drawWaveContours(svg, {
  scenario = 'electric',
  Tmin = 4,
  Tmax = 20,
  Hmax = 6,
  elLayers = [],
  hyLayers = []
} = {}) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  Tmin = Math.max(0.1, +Tmin || 4);
  Tmax = Math.max(Tmin + 0.1, +Tmax || 20);
  Hmax = Math.max(0.5, +Hmax || 6);

  // layer speeds in m/s (start-of-layer)
  let layerSpeeds = [];
  if (scenario === 'electric') {
    layerSpeeds = (elLayers || [])
      .filter(r => Number.isFinite(+r.line_speed_at_start_mpm))
      .map(r => ({ layer_no: r.layer_no, v_ms: (+r.line_speed_at_start_mpm) / 60 }));
  } else {
    layerSpeeds = (hyLayers || [])
      .filter(r => Number.isFinite(+r.hyd_speed_available_mpm))
      .map(r => ({ layer_no: r.layer_no, v_ms: (+r.hyd_speed_available_mpm) / 60 }));
  }
  layerSpeeds.sort((a, b) => a.v_ms - b.v_ms);

  // Y range from contours and layers
  const vmaxFromContours = Math.PI * Hmax / Math.max(Tmin, 1e-9);
  const vmaxFromLayers = layerSpeeds.length ? Math.max(...layerSpeeds.map(x => x.v_ms)) : 0;
  const Vmax = Math.max(vmaxFromContours, vmaxFromLayers) * 1.05 || 1;

  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const ML = 64, MR = 20, MT = 20, MB = 46;
  const innerW = W - ML - MR, innerH = H - MT - MB;

  const sx = t => ML + (t - Tmin) / (Tmax - Tmin) * innerW;
  const sy = v => MT + (1 - v / Vmax) * innerH;

  // frame
  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  // grid & ticks
  const xt = niceTicks(Tmin, Tmax, 8).ticks;
  const yt = niceTicks(0, Vmax, 6).ticks;
  xt.forEach(tx => {
    const X = sx(tx);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const t = svgEl('text', { x: X, y: H - 8, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
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
  svg.appendChild(svgEl('text', { x: ML + innerW / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' }))
     .textContent = 'Period T (s)';
  svg.appendChild(svgEl('text', {
    x: 18, y: MT + innerH / 2, transform: `rotate(-90,18,${MT + innerH / 2})`,
    'text-anchor': 'middle', 'font-size': '12', fill: '#444'
  })).textContent = 'Speed (m/s)';

  // contour lines for H from 0.5 to Hmax in 0.5 m step
  const Hstep = 0.5;
  for (let Hm = Hstep; Hm <= Hmax + 1e-9; Hm += Hstep) {
    const pts = [];
    const samples = 200;
    for (let i = 0; i <= samples; i++) {
      const T = Tmin + (Tmax - Tmin) * i / samples;
      const v = Math.PI * Hm / Math.max(T, 1e-9);
      pts.push([sx(T), sy(v)]);
    }
    svg.appendChild(svgEl('path', {
      d: svgPathFromPoints(pts),
      fill: 'none',
      stroke: '#000',
      'stroke-width': 1.5,
      'stroke-dasharray': (Math.abs(Hm - Math.round(Hm)) < 1e-9) ? '0' : '6 6'
    }));
  }

  // horizontal gray lines for each layer speed
  layerSpeeds.forEach(L => {
    const Y = sy(L.v_ms);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: '#999', 'stroke-width': 1.5 }));
    const lbl = svgEl('text', { x: W - MR - 2, y: Y - 3, 'text-anchor': 'end', 'font-size': '11', fill: '#666' });
    lbl.textContent = `L${L.layer_no} (${L.v_ms.toFixed(2)} m/s)`;
    svg.appendChild(lbl);
  });

  // zero line
  svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
}
