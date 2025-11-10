// ===== plots/rpm-torque.mjs — Hydraulic available RPM vs torque =====
import { niceTicks, svgEl, svgPathFromPoints } from '../utils.mjs';

function getAccentColor() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.getComputedStyle) {
    const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent');
    if (val) return val.trim();
  }
  return '#2c56a3';
}

/**
 * Draw available hydraulic drum RPM as a function of torque demand.
 * The available RPM is the lower of the flow-limited and power-limited RPM.
 * @param {SVGSVGElement} svg
 * @param {Object} opts
 * @param {Array<Object>} [opts.wraps]
 */
export function drawHydraulicRpmTorque(svg, { wraps = [] } = {}) {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const data = (Array.isArray(wraps) ? wraps : [])
    .map(w => ({
      wrap: w.wrap_no,
      layer: w.layer_no,
      torque: toNumber(w.torque_Nm),
      rpmAvail: toNumber(w.hyd_drum_rpm_available)
    }))
    .filter(d => Number.isFinite(d.torque) && d.torque > 0 && Number.isFinite(d.rpmAvail) && d.rpmAvail >= 0);

  if (!data.length) {
    const msg = svgEl('text', {
      x: (svg.viewBox.baseVal.width || svg.clientWidth || 1000) / 2,
      y: (svg.viewBox.baseVal.height || svg.clientHeight || 540) / 2,
      'text-anchor': 'middle',
      'font-size': '16',
      fill: '#666'
    });
    msg.textContent = 'No hydraulic data available';
    svg.appendChild(msg);
    return;
  }

  data.sort((a, b) => a.torque - b.torque);

  const accent = getAccentColor();
  const W = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const H = svg.viewBox.baseVal.height || svg.clientHeight || 540;
  const ML = 70, MR = 20, MT = 20, MB = 60;
  const innerW = W - ML - MR;
  const innerH = H - MT - MB;

  const torqueMin = 0;
  const torqueMaxData = Math.max(...data.map(d => d.torque));
  const torqueExtent = Math.max(torqueMin + 1, torqueMaxData);
  const { step: torqueStep } = niceTicks(torqueMin, torqueExtent, 6);
  const torqueMax = torqueMin + Math.max(1, Math.ceil((torqueExtent - torqueMin) / Math.max(torqueStep, 1e-9))) * Math.max(torqueStep, 1e-9);
  const rpmMaxCandidate = Math.max(...data.map(d => d.rpmAvail));
  const rpmMin = 0;
  const rpmMax = Math.max(rpmMin + 1, rpmMaxCandidate * 1.1);

  const sx = torque => ML + (Math.min(Math.max(torque, torqueMin), torqueMax) - torqueMin) / (torqueMax - torqueMin) * innerW;
  const sy = rpm => MT + (1 - (Math.min(Math.max(rpm, rpmMin), rpmMax) - rpmMin) / (rpmMax - rpmMin)) * innerH;

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  const torqueTicks = niceTicks(torqueMin, torqueMax, 6).ticks;
  torqueTicks.forEach(t => {
    if (t < torqueMin - 1e-9 || t > torqueMax + 1e-9) return;
    const X = sx(t);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const label = svgEl('text', { x: X, y: H - 30, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    label.textContent = formatNumber(t, 0);
    svg.appendChild(label);
  });

  const rpmTicks = niceTicks(rpmMin, rpmMax, 6).ticks;
  rpmTicks.forEach(r => {
    if (r < rpmMin - 1e-9 || r > rpmMax + 1e-9) return;
    const Y = sy(r);
    svg.appendChild(svgEl('line', { x1: ML, y1: Y, x2: W - MR, y2: Y, stroke: '#eee' }));
    const label = svgEl('text', { x: ML - 8, y: Y + 4, 'text-anchor': 'end', 'font-size': '12', fill: '#444' });
    label.textContent = formatNumber(r, 0);
    svg.appendChild(label);
  });

  svg.appendChild(svgEl('text', {
    x: ML + innerW / 2,
    y: H - 6,
    'text-anchor': 'middle',
    'font-size': '13',
    fill: '#333'
  })).textContent = 'Torque at drum (N·m)';

  const ylabel = svgEl('text', {
    x: 16,
    y: MT + innerH / 2,
    'text-anchor': 'middle',
    'font-size': '13',
    fill: '#333',
    transform: `rotate(-90 16 ${MT + innerH / 2})`
  });
  ylabel.textContent = 'Drum RPM';
  svg.appendChild(ylabel);

  const pathFor = (field, { dropAtMaxTorque = false } = {}) => {
    const points = data
      .map(d => [d.torque, d[field]])
      .filter(([torque, rpm]) => Number.isFinite(torque) && Number.isFinite(rpm));

    if (!points.length) return '';

    if (dropAtMaxTorque) {
      const lastPoint = points[points.length - 1];
      if (lastPoint && lastPoint[1] > rpmMin + 1e-9) {
        points.push([lastPoint[0], rpmMin]);
      }
    }

    return svgPathFromPoints(points.map(([torque, rpm]) => [sx(torque), sy(rpm)]));
  };

  const availPath = pathFor('rpmAvail', { dropAtMaxTorque: true });
  if (availPath) {
    svg.appendChild(svgEl('path', {
      d: availPath,
      fill: 'none',
      stroke: accent,
      'stroke-width': 3
    }));
  }

  data.forEach(d => {
    svg.appendChild(svgEl('circle', {
      cx: sx(d.torque),
      cy: sy(d.rpmAvail),
      r: 3,
      fill: '#fff',
      stroke: accent,
      'stroke-width': 1.5
    }));
  });
}

function toNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return NaN;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  const num = Number(val);
  return Number.isFinite(num) ? num : NaN;
}

function formatNumber(val, decimals = 0) {
  const factor = Math.pow(10, decimals);
  return String(Math.round(val * factor) / factor);
}
