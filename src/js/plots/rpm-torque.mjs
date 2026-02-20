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
 * @param {number} [opts.torqueMin]
 * @param {number} [opts.torqueMax]
 * @param {number} [opts.rpmMin]
 * @param {number} [opts.rpmMax]
 */
export function drawHydraulicRpmTorque(
  svg,
  { wraps = [], torqueMin = 0, torqueMax = null, rpmMin = 0, rpmMax = null } = {}
) {
  if (!svg) return;
  if (svg._rpmTorqueHandlers) {
    const { move, leave, pointerup, contextmenu, dblclick } = svg._rpmTorqueHandlers;
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
    svg.removeEventListener('pointerenter', move);
    if (pointerup) svg.removeEventListener('pointerup', pointerup);
    if (contextmenu) svg.removeEventListener('contextmenu', contextmenu);
    if (dblclick) svg.removeEventListener('dblclick', dblclick);
    delete svg._rpmTorqueHandlers;
  }
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

  const torqueMinVal = Number.isFinite(Number(torqueMin)) ? Math.max(0, Number(torqueMin)) : 0;
  const torqueMaxData = Math.max(...data.map(d => d.torque));
  const torqueExtent = Math.max(torqueMinVal + 1, torqueMaxData);
  const { step: torqueStep } = niceTicks(torqueMinVal, torqueExtent, 6);
  const autoTorqueMax = torqueMinVal + Math.max(1, Math.ceil((torqueExtent - torqueMinVal) / Math.max(torqueStep, 1e-9))) * Math.max(torqueStep, 1e-9);
  const torqueMaxVal = Number.isFinite(Number(torqueMax)) && Number(torqueMax) > torqueMinVal ? Number(torqueMax) : autoTorqueMax;

  const rpmMinVal = Number.isFinite(Number(rpmMin)) ? Math.max(0, Number(rpmMin)) : 0;
  const rpmMaxCandidate = Math.max(...data.map(d => d.rpmAvail));
  const autoRpmMax = Math.max(rpmMinVal + 1, rpmMaxCandidate * 1.1);
  const rpmMaxVal = Number.isFinite(Number(rpmMax)) && Number(rpmMax) > rpmMinVal ? Number(rpmMax) : autoRpmMax;

  const sx = torque => ML + (Math.min(Math.max(torque, torqueMinVal), torqueMaxVal) - torqueMinVal) / (torqueMaxVal - torqueMinVal) * innerW;
  const sy = rpm => MT + (1 - (Math.min(Math.max(rpm, rpmMinVal), rpmMaxVal) - rpmMinVal) / (rpmMaxVal - rpmMinVal)) * innerH;

  svg.appendChild(svgEl('rect', { x: ML, y: MT, width: innerW, height: innerH, fill: '#fff', stroke: '#ccc' }));

  const torqueTicks = niceTicks(torqueMinVal, torqueMaxVal, 6).ticks;
  torqueTicks.forEach(t => {
    if (t < torqueMinVal - 1e-9 || t > torqueMaxVal + 1e-9) return;
    const X = sx(t);
    svg.appendChild(svgEl('line', { x1: X, y1: MT, x2: X, y2: H - MB, stroke: '#eee' }));
    const label = svgEl('text', { x: X, y: H - 30, 'text-anchor': 'middle', 'font-size': '12', fill: '#444' });
    label.textContent = formatNumber(t, 0);
    svg.appendChild(label);
  });

  const rpmTicks = niceTicks(rpmMinVal, rpmMaxVal, 6).ticks;
  rpmTicks.forEach(r => {
    if (r < rpmMinVal - 1e-9 || r > rpmMaxVal + 1e-9) return;
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
      if (lastPoint && lastPoint[1] > rpmMinVal + 1e-9) {
        points.push([lastPoint[0], rpmMinVal]);
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

  const minPoint = data.find(d => Number.isFinite(d.rpmAvail));
  if (minPoint) {
    const y = sy(minPoint.rpmAvail);
    svg.appendChild(svgEl('line', {
      x1: sx(torqueMinVal),
      y1: y,
      x2: sx(minPoint.torque),
      y2: y,
      stroke: accent,
      'stroke-width': 2
    }));
  }

  let pins = [];
  const getPins = () => {
    if (!Array.isArray(svg._rpmTorquePins)) svg._rpmTorquePins = [];
    return svg._rpmTorquePins;
  };

  pins = getPins()
    .filter(pin => Number.isFinite(pin.torque) && Number.isFinite(pin.rpm))
    .map((pin, idx) => ({
      ...pin,
      torque: Math.min(Math.max(pin.torque, torqueMinVal), torqueMaxVal),
      rpm: Math.min(Math.max(pin.rpm, rpmMinVal), rpmMaxVal),
      label: pin.label || `P${idx + 1}`
    }));
  pins.forEach((pin, idx) => { pin.label = `P${idx + 1}`; });
  svg._rpmTorquePins = pins;

  pins.forEach(pin => {
    const x = sx(pin.torque);
    const y = sy(pin.rpm);
    svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5, fill: accent, stroke: '#fff', 'stroke-width': 1.5 }));
    const label = svgEl('text', {
      x: x + 8,
      y: y - 8,
      'font-size': '11',
      fill: accent,
      style: 'paint-order: stroke; stroke: #fff; stroke-width: 2px;'
    });
    label.textContent = `${pin.label} (${formatNumber(pin.torque, 0)} N·m, ${formatNumber(pin.rpm, 1)} rpm)`;
    svg.appendChild(label);
  });

  const hoverLayer = svgEl('g', { 'pointer-events': 'none' });
  const hoverVLine = svgEl('line', { x1: ML, x2: ML, y1: MT, y2: H - MB, stroke: accent, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0 });
  const hoverHLine = svgEl('line', { x1: ML, x2: W - MR, y1: MT, y2: MT, stroke: accent, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0 });
  const hoverXLabel = svgEl('text', { x: ML, y: H - MB + 20, 'text-anchor': 'middle', 'font-size': '12', fill: accent, opacity: 0 });
  const hoverYLabel = svgEl('text', { x: ML - 8, y: MT, 'text-anchor': 'end', 'font-size': '12', fill: accent, opacity: 0 });
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
    return { x: offsetX + (evt.clientX - rect.left) * scaleX, y: offsetY + (evt.clientY - rect.top) * scaleY };
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
    const torqueVal = torqueMinVal + ((clampedX - ML) / Math.max(innerW, 1e-9)) * (torqueMaxVal - torqueMinVal);
    const rpmVal = rpmMaxVal - ((clampedY - MT) / Math.max(innerH, 1e-9)) * (rpmMaxVal - rpmMinVal);
    hoverVLine.setAttribute('x1', clampedX);
    hoverVLine.setAttribute('x2', clampedX);
    hoverVLine.setAttribute('opacity', '1');
    hoverHLine.setAttribute('y1', clampedY);
    hoverHLine.setAttribute('y2', clampedY);
    hoverHLine.setAttribute('opacity', '1');
    hoverXLabel.setAttribute('x', clampedX);
    hoverXLabel.textContent = `${formatNumber(torqueVal, 0)} N·m`;
    hoverXLabel.setAttribute('opacity', '1');
    hoverYLabel.setAttribute('y', clampedY + 4);
    hoverYLabel.textContent = `${formatNumber(rpmVal, 1)} rpm`;
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

  const nearestPinIndex = (torqueVal, rpmVal) => {
    const tolTorque = Math.max(5, (torqueMaxVal - torqueMinVal) * 0.015);
    const tolRpm = Math.max(2, (rpmMaxVal - rpmMinVal) * 0.02);
    let bestIdx = -1;
    let bestScore = Infinity;
    getPins().forEach((pin, idx) => {
      const dTorque = Math.abs(pin.torque - torqueVal);
      const dRpm = Math.abs(pin.rpm - rpmVal);
      if (dTorque <= tolTorque && dRpm <= tolRpm) {
        const score = dTorque / tolTorque + dRpm / tolRpm;
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
    const torqueVal = torqueMinVal + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * (torqueMaxVal - torqueMinVal);
    const rpmVal = rpmMaxVal - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * (rpmMaxVal - rpmMinVal);
    const roundedTorque = Math.round(torqueVal);
    const roundedRpm = Math.round(rpmVal * 10) / 10;
    if (nearestPinIndex(roundedTorque, roundedRpm) === -1) {
      svg._rpmTorquePins = [...getPins(), { torque: roundedTorque, rpm: roundedRpm, label: '' }]
        .map((pin, idx) => ({ ...pin, label: `P${idx + 1}` }));
    }
    drawHydraulicRpmTorque(svg, { wraps, torqueMin: torqueMinVal, torqueMax: torqueMaxVal, rpmMin: rpmMinVal, rpmMax: rpmMaxVal });
  };

  const contextMenuHandler = evt => {
    evt.preventDefault();
    const { x: localX, y: localY } = toViewBoxPoint(evt);
    if (localX < ML || localX > W - MR || localY < MT || localY > H - MB) return;
    const torqueVal = torqueMinVal + ((clamp(localX, ML, W - MR) - ML) / Math.max(innerW, 1e-9)) * (torqueMaxVal - torqueMinVal);
    const rpmVal = rpmMaxVal - ((clamp(localY, MT, H - MB) - MT) / Math.max(innerH, 1e-9)) * (rpmMaxVal - rpmMinVal);
    const idx = nearestPinIndex(torqueVal, rpmVal);
    if (idx === -1) return;
    svg._rpmTorquePins = getPins().filter((_, pinIdx) => pinIdx !== idx).map((pin, order) => ({ ...pin, label: `P${order + 1}` }));
    drawHydraulicRpmTorque(svg, { wraps, torqueMin: torqueMinVal, torqueMax: torqueMaxVal, rpmMin: rpmMinVal, rpmMax: rpmMaxVal });
  };

  const clearPinsHandler = () => {
    svg._rpmTorquePins = [];
    drawHydraulicRpmTorque(svg, { wraps, torqueMin: torqueMinVal, torqueMax: torqueMaxVal, rpmMin: rpmMinVal, rpmMax: rpmMaxVal });
  };

  svg.addEventListener('pointerup', pointerUpHandler);
  svg.addEventListener('contextmenu', contextMenuHandler);
  svg.addEventListener('dblclick', clearPinsHandler);

  svg._rpmTorqueHandlers = {
    move: updateHover,
    leave: hideHover,
    pointerup: pointerUpHandler,
    contextmenu: contextMenuHandler,
    dblclick: clearPinsHandler
  };
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
