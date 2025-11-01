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
  if (svg._waveHoverHandlers) {
    const { move, leave } = svg._waveHoverHandlers;
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerleave', leave);
    svg.removeEventListener('pointerenter', move);
    delete svg._waveHoverHandlers;
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

  let hoverLayer = null;

  if (mode === 'speed') {
    // contour lines for H from 0.5 to Hmax in 0.5 m step
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
        stroke: '#999',
        'stroke-width': 1.5,
        'stroke-dasharray': (Math.abs(Hm - Math.round(Hm)) < 1e-9) ? '0' : '6 6'
      }));
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

    hoverLayer = svgEl('g', { 'pointer-events': 'none' });
    const hoverLine = svgEl('line', {
      x1: ML,
      x2: ML,
      y1: MT,
      y2: H - MB,
      stroke: accentColor,
      'stroke-width': 1.5,
      'stroke-dasharray': '6 4',
      opacity: 0
    });
    const hoverLabel = svgEl('text', {
      x: ML,
      y: H - MB + 20,
      'text-anchor': 'middle',
      'font-size': '12',
      fill: accentColor,
      opacity: 0
    });
    hoverLayer.appendChild(hoverLine);
    hoverLayer.appendChild(hoverLabel);
    svg.appendChild(hoverLayer);

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const updateHover = evt => {
      const rect = svg.getBoundingClientRect();
      const localX = evt.clientX - rect.left;
      if (localX < ML || localX > W - MR) {
        hoverLine.setAttribute('opacity', '0');
        hoverLabel.setAttribute('opacity', '0');
        return;
      }

      const clampedX = clamp(localX, ML, W - MR);
      const T = Tmin + ((clampedX - ML) / Math.max(innerW, 1e-9)) * (Tmax - Tmin);
      hoverLine.setAttribute('x1', clampedX);
      hoverLine.setAttribute('x2', clampedX);
      hoverLine.setAttribute('opacity', '1');

      const displayT = Math.round(T * 10) / 10;
      hoverLabel.setAttribute('x', clampedX);
      hoverLabel.textContent = `${displayT.toFixed(1)} sec`;
      hoverLabel.setAttribute('opacity', '1');
    };

    const hideHover = () => {
      hoverLine.setAttribute('opacity', '0');
      hoverLabel.setAttribute('opacity', '0');
    };

    svg.addEventListener('pointermove', updateHover);
    svg.addEventListener('pointerenter', updateHover);
    svg.addEventListener('pointerleave', hideHover);
    svg._waveHoverHandlers = { move: updateHover, leave: hideHover };
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

  // zero line
  if (yMin <= 0 && yMax >= 0) {
    svg.appendChild(svgEl('line', { x1: ML, y1: sy(0), x2: W - MR, y2: sy(0), stroke: '#bbb', 'stroke-dasharray': '4 4' }));
  }
  if (hoverLayer) svg.appendChild(hoverLayer);
}
