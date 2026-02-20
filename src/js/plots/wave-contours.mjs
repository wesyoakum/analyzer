// ===== plots/wave-contours.mjs â€” Wave contour plots (DOM-agnostic) =====
import { niceTicks, svgEl, svgPathFromPoints } from '../utils.mjs';

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

function renderWavePlot(svg, {
  scenario = 'electric',
  Tmin = 4,
  Tmax = 20,
  Hmin = 0,
  Hmax = 6,
  speedMin = 0,
  speedMax = null,

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
  if (scenario === 'electric') {
    layerSpeeds = (elLayers || [])
      .filter(r => Number.isFinite(+r.line_speed_at_start_mpm))
      .map(r => ({ layer_no: r.layer_no, v_ms: (+r.line_speed_at_start_mpm) / 60 }));
  } else {
    layerSpeeds = (hyLayers || [])
      .filter(r => Number.isFinite(+r.hyd_speed_available_mpm))
      .map(r => ({ layer_no: r.layer_no, v_ms: (+r.hyd_speed_available_mpm) / 60 }));
  }
  layerSpeeds = layerSpeeds.filter(L => Number.isFinite(L.v_ms) && L.v_ms >= 0);
  layerSpeeds.sort((a, b) => a.v_ms - b.v_ms);

  // Y range (speed plot only) derived from contours and layers
  const vmaxFromContours = Math.PI * Hmax / Math.max(Tmin, 1e-9);
  let maxLayerSpeed = 0;
  for (const { v_ms } of layerSpeeds) {
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
    return '#2c56a3';
  })();


  if (mode === 'speed') {
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

    // horizontal lines for each layer speed
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

    if (contourLabelLayer.childNodes.length) {
      svg.appendChild(contourLabelLayer);
    }

  } else {
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
    renderWavePlot(svg, { scenario, Tmin, Tmax, Hmin, Hmax, speedMin, speedMax, elLayers, hyLayers }, mode);
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
    renderWavePlot(svg, { scenario, Tmin, Tmax, Hmin, Hmax, speedMin, speedMax, elLayers, hyLayers }, mode);
  };

  const clearPinsHandler = () => {
    svg._wavePins = [];
    renderWavePlot(svg, { scenario, Tmin, Tmax, Hmin, Hmax, speedMin, speedMax, elLayers, hyLayers }, mode);
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
