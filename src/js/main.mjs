// ===== main.mjs app bootstrap, compute, render, plots =====

import {
  q, read,
  G, W_PER_HP, PSI_TO_PA, CC_PER_GAL, M_PER_IN,
  tension_kgf, elec_available_tension_kgf,
  gpm_from_cc_rev_and_rpm, rpm_from_gpm_and_disp,
  psi_from_torque_and_disp_Nm_cc, torque_per_motor_from_pressure_Pa,
  line_speed_mpm_from_motor_rpm, hp_from_psi_and_gpm,
} from './utils.mjs';

import { collectInputState, setupInputPersistence } from './persist-inputs.mjs';


import { renderElectricTables } from './electric.mjs';

import { renderHydraulicTables } from './hydraulic.mjs';

import { drawWaveContours, drawWaveHeightContours } from './plots/wave-contours.mjs';
import { drawDepthProfiles } from './plots/depth-profiles.mjs';
import { drawHydraulicRpmTorque } from './plots/rpm-torque.mjs';
import { setupComponentSelectors } from './component-selectors.mjs';
import { renderDrumVisualization, clearDrumVisualization } from './drum-visual.mjs';
import { renderLatexFragments } from './katex-renderer.mjs';
import { buildComputationModel } from './analysis-data.mjs';
import { renderReport } from './report-renderer.mjs';

// ---- App state for plots/tables ----
let lastElLayer = [], lastElWraps = [];
let lastHyLayer = [], lastHyWraps = [];
/** @type {{ rows: any, summary: any, cfg: any, meta: any } | null} */
let lastDrumState = null;
/** @type {DepthProfileContext|null} */
let lastDepthProfileContext = null;
let lastComputedModel = null;

function readAccentColor() {
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent');
    if (val) return val.trim();
  }
  return '#2c56a3';
}

function updateTorqueCheckMessages(gearboxFailed, motorFailed) {
  const gearboxMsgEl = /** @type {HTMLElement|null} */ (q('gearbox_torque_check_msg'));
  const motorMsgEl = /** @type {HTMLElement|null} */ (q('motor_torque_check_msg'));
  if (gearboxMsgEl) {
    gearboxMsgEl.textContent = gearboxFailed ? 'Gearbox torque check failed.' : '';
  }
  if (motorMsgEl) {
    motorMsgEl.textContent = motorFailed ? 'Motor torque check failed.' : '';
  }
}

/**
 * @typedef {Object} DepthProfileWrap
 * @property {number} wrap_no
 * @property {number} layer_no
 * @property {number} layer_dia_in
 * @property {number} pre_spooled_len_m
 * @property {number} spooled_len_m
 * @property {number} deployed_len_m
 * @property {number} total_cable_len_m
 * @property {number} pre_deployed_len_m
 */

/**
 * @typedef {Object} DepthProfileContext
 * @property {'electric'|'hydraulic'} scenario
 * @property {DepthProfileWrap[]} wraps
 * @property {number} dead_end_m
 * @property {number} cable_w_kgpm
 * @property {number} gr1
 * @property {number} gr2
 * @property {number} motors
 * @property {number} denom_mech
 * @property {number} gear_product
 * @property {number} motor_max_rpm
 * @property {number} motor_tmax
 * @property {number} P_per_motor_W
 * @property {boolean} electricEnabled
 * @property {boolean} hydraulicEnabled
 * @property {{
 *   h_strings: number,
 *   h_emotor_hp: number,
 *   h_emotor_eff: number,
 *   h_emotor_rpm: number,
 *   h_pump_cc: number,
 *   h_max_psi: number,
 *   h_hmot_cc: number,
 *   h_hmot_rpm_cap: number,
 *   torque_per_hmotor_maxP: number,
 *   torque_at_drum_maxP_factor: number,
 *   q_tot_gpm: number,
 *   rpm_flow_per_motor: number,
 *   hp_elec_in_total: number,
 *   eff_total: number
 * }} hydraulic
 */

/**
 * @typedef {Object} SpeedProfileSegments
 * @property {string} label
 * @property {string} color
 * @property {{depth_start:number, depth_end:number, speed_ms:number}[]} segments
 * @property {number} [strokeWidth]
 * @property {number} [legendStrokeWidth]
 * @property {string|null} [strokeDasharray]
 * @property {string|null} [legendStrokeDasharray]
 * @property {string} [inlineLabel]
 * @property {string} [inlineLabelColor]
 */

function buildDepthProfileContext({
  scenario,
  rows,
  cfg,
  cable_w_kgpm,
  gr1,
  gr2,
  motors,
  motor_max_rpm,
  motor_tmax,
  P_per_motor_W,
  denom_mech,
  gear_product,
  electricEnabled,
  hydraulicEnabled,
  hydraulic
}) {
  if (!scenario || !Array.isArray(rows)) return null;

  const wraps = rows.map(r => ({
    wrap_no: r.wrap_no,
    layer_no: r.layer_no,
    layer_dia_in: r.layer_dia_in,
    pre_spooled_len_m: r.pre_spooled_len_m,
    spooled_len_m: r.spooled_len_m,
    deployed_len_m: r.deployed_len_m,
    total_cable_len_m: r.total_cable_len_m,
    pre_deployed_len_m: Number.isFinite(r.total_cable_len_m) && Number.isFinite(r.pre_spooled_len_m)
      ? +(r.total_cable_len_m - r.pre_spooled_len_m).toFixed(3)
      : null
  })).filter(wrap => Number.isFinite(wrap.layer_dia_in));

  const safeHydraulic = hydraulic || {};
  const hydraulicContext = {
    h_strings: safeHydraulic.h_strings || 0,
    h_emotor_hp: safeHydraulic.h_emotor_hp || 0,
    h_emotor_eff: safeHydraulic.h_emotor_eff || 0,
    h_emotor_rpm: safeHydraulic.h_emotor_rpm || 0,
    h_pump_cc: safeHydraulic.h_pump_cc || 0,
    h_max_psi: safeHydraulic.h_max_psi || 0,
    h_hmot_cc: safeHydraulic.h_hmot_cc || 0,
    h_hmot_rpm_cap: safeHydraulic.h_hmot_rpm_cap || 0,
    torque_per_hmotor_maxP: safeHydraulic.torque_per_hmotor_maxP || 0,
    torque_at_drum_maxP_factor: safeHydraulic.torque_at_drum_maxP_factor || 0,
    q_tot_gpm: safeHydraulic.q_tot_gpm || 0,
    rpm_flow_per_motor: safeHydraulic.rpm_flow_per_motor || 0,
    hp_elec_in_total: (safeHydraulic.h_emotor_hp || 0) * (safeHydraulic.h_strings || 0),
    eff_total: safeHydraulic.h_emotor_eff || 0
  };

  return {
    scenario,
    wraps,
    dead_end_m: Number.isFinite(cfg?.dead_end_m) ? cfg.dead_end_m : 0,
    cable_w_kgpm: Number.isFinite(cable_w_kgpm) ? cable_w_kgpm : 0,
    gr1: Number.isFinite(gr1) ? gr1 : 0,
    gr2: Number.isFinite(gr2) ? gr2 : 0,
    motors: Number.isFinite(motors) ? motors : 0,
    denom_mech: Number.isFinite(denom_mech) ? denom_mech : 0,
    gear_product: Number.isFinite(gear_product) ? gear_product : 0,
    motor_max_rpm: Number.isFinite(motor_max_rpm) ? motor_max_rpm : 0,
    motor_tmax: Number.isFinite(motor_tmax) ? motor_tmax : 0,
    P_per_motor_W: Number.isFinite(P_per_motor_W) ? P_per_motor_W : 0,
    electricEnabled: Boolean(electricEnabled),
    hydraulicEnabled: Boolean(hydraulicEnabled),
    hydraulic: hydraulicContext
  };
}


function formatPayloadLabel(payloadKg) {
  if (!Number.isFinite(payloadKg)) return '';
  const rounded = Math.round(payloadKg);
  return `Payload ${rounded.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function formatPayloadInlineLabel(payloadKg) {
  if (!Number.isFinite(payloadKg)) return '';
  const rounded = Math.round(payloadKg);
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function computeDepthSpeedSegmentsForPayload(payloadKg, context, options = {}) {
  if (!context) return [];
  const scenario = context.scenario;
  if (scenario === 'electric' && !context.electricEnabled) return [];
  if (scenario === 'hydraulic' && !context.hydraulicEnabled) return [];

  const mode = options.mode === 'power'
    ? 'power'
    : (options.mode === 'flow' ? 'flow' : 'available');
  const payload = Number.isFinite(payloadKg) ? Math.max(0, payloadKg) : 0;
  const cableWeight = Number.isFinite(context.cable_w_kgpm) ? context.cable_w_kgpm : 0;
  const gearSafe = Math.max(context.gear_product, 1e-9);
  const motorsSafe = Math.max(context.motors, 1);
  const denomSafe = Math.max(context.denom_mech, 1e-9);
  const deadEnd = Number.isFinite(context.dead_end_m) ? context.dead_end_m : 0;

  /** @type {{depth_start:number, depth_end:number, speed_ms:number}[]} */
  const segments = [];
  let fallbackStart = null;

  for (const wrap of context.wraps) {
    if (!wrap) continue;
    const depthEndRaw = Number.isFinite(wrap.deployed_len_m) ? wrap.deployed_len_m : null;
    if (!Number.isFinite(depthEndRaw)) {
      fallbackStart = null;
      continue;
    }
    let depthStartRaw = Number.isFinite(wrap.pre_deployed_len_m) ? wrap.pre_deployed_len_m : null;
    if (!Number.isFinite(depthStartRaw)) {
      if (Number.isFinite(wrap.total_cable_len_m) && Number.isFinite(wrap.pre_spooled_len_m)) {
        depthStartRaw = wrap.total_cable_len_m - wrap.pre_spooled_len_m;
      } else if (Number.isFinite(fallbackStart)) {
        depthStartRaw = fallbackStart;
      }
    }
    if (!Number.isFinite(depthStartRaw)) depthStartRaw = depthEndRaw;
    if (depthStartRaw < depthEndRaw) {
      const tmp = depthStartRaw;
      depthStartRaw = depthEndRaw;
      depthEndRaw = tmp;
    }
    const toDepth = (v) => {
      if (!Number.isFinite(v)) return 0;
      const adj = v - deadEnd;
      return +Math.max(0, adj).toFixed(3);
    };
    const depthStart = toDepth(depthStartRaw);
    const depthEnd = toDepth(depthEndRaw);
    fallbackStart = depthEndRaw + deadEnd;

    if (!Number.isFinite(wrap.layer_dia_in) || wrap.layer_dia_in <= 0) continue;
    const radius_m = (wrap.layer_dia_in * M_PER_IN) / 2;
    if (!Number.isFinite(radius_m) || radius_m <= 0) continue;

    const theoretical_tension = tension_kgf(depthEndRaw, payload, cableWeight);
    const required_tension = theoretical_tension;
    const tension_N = required_tension * G;
    const drum_T = tension_N * radius_m;

    let speed_mpm = 0;

    if (scenario === 'electric') {
      const motorTorque = drum_T / denomSafe;
      let rpm_power_e = 0;
      if (context.P_per_motor_W > 0 && motorTorque > 0) {
        rpm_power_e = (context.P_per_motor_W / motorTorque) * 60 / (2 * Math.PI);
      } else if (context.P_per_motor_W > 0 && Math.abs(motorTorque) <= 1e-9) {
        rpm_power_e = Number.POSITIVE_INFINITY;
      }
      const rpmLimit = (Number.isFinite(context.motor_max_rpm) && context.motor_max_rpm > 0)
        ? context.motor_max_rpm
        : Number.POSITIVE_INFINITY;
      const rpmCapped = Math.min(rpmLimit, rpm_power_e);
      const computedMpm = Number.isFinite(rpmCapped)
        ? line_speed_mpm_from_motor_rpm(rpmCapped, context.gr1, context.gr2, wrap.layer_dia_in)
        : 0;
      speed_mpm = Number.isFinite(computedMpm) && computedMpm > 0 ? computedMpm : 0;
    } else if (scenario === 'hydraulic') {
      const hyd = context.hydraulic || {};
      const rpmFlowPerMotor = hyd.rpm_flow_per_motor;
      let speed_flow_mpm = 0;
      if (Number.isFinite(rpmFlowPerMotor)) {
        speed_flow_mpm = rpmFlowPerMotor > 0
          ? line_speed_mpm_from_motor_rpm(rpmFlowPerMotor, context.gr1, context.gr2, wrap.layer_dia_in)
          : 0;
      } else if (rpmFlowPerMotor === Number.POSITIVE_INFINITY) {
        speed_flow_mpm = Number.POSITIVE_INFINITY;
      }
      if (!Number.isFinite(speed_flow_mpm)) {
        speed_flow_mpm = speed_flow_mpm === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : 0;
      }
      const tension_theoretical_N = theoretical_tension * G;
      let speed_power_mpm = 0;
      if (hyd.hp_elec_in_total > 0 && hyd.eff_total > 0 && tension_theoretical_N > 0) {
        const power_available_W = hyd.hp_elec_in_total * hyd.eff_total * W_PER_HP;
        const speed_power_mps = power_available_W / tension_theoretical_N;
        speed_power_mpm = speed_power_mps * 60;
      }
      if (!Number.isFinite(speed_power_mpm) || speed_power_mpm < 0) speed_power_mpm = 0;
      let selectedSpeedMpm = speed_power_mpm;
      if (mode === 'flow') {
        selectedSpeedMpm = speed_flow_mpm;
      } else if (mode !== 'power') {
        selectedSpeedMpm = Math.min(speed_power_mpm, speed_flow_mpm);
      }
      if (!Number.isFinite(selectedSpeedMpm) || selectedSpeedMpm < 0) selectedSpeedMpm = 0;
      speed_mpm = selectedSpeedMpm;
    }

    const speed_ms = speed_mpm / 60;
    if (!Number.isFinite(speed_ms)) continue;

    segments.push({
      depth_start: depthStart,
      depth_end: depthEnd,
      speed_ms: Math.max(0, speed_ms)
    });
  }

  segments.sort((a, b) => (b.depth_start || 0) - (a.depth_start || 0));
  return segments;
}

const CSV_BUTTON_SPECS = {
  csv_el_layer: {
    filename: () => 'electric-layer.csv',
    columns: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'max_tension_theoretical_kgf',
      'line_speed_at_start_mpm', 'tension_theoretical_start_kgf',
      'tension_required_start_kgf', 'avail_tension_kgf'
    ],
    header: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'max_tension_theoretical_kgf',
      'line_speed_at_start_mpm', 'tension_theoretical_start_kgf',
      'tension_required_start_kgf', 'avail_tension_kgf'
    ],
    getRows: () => lastElLayer
  },
  csv_el_wraps: {
    filename: () => 'electric-wraps.csv',
    columns: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'tau_req_drum_kNm', 'motor_torque_Nm', 'motor_rpm',
      'line_speed_mpm', 'avail_tension_kgf'
    ],
    header: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'tau_req_drum_kNm', 'motor_torque_Nm', 'motor_rpm',
      'line_speed_mpm', 'avail_tension_kgf'
    ],
    getRows: () => lastElWraps
  },
  csv_hy_layer: {
    filename: () => 'hydraulic-layer.csv',
    columns: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'hyd_P_required_psi',
      'hyd_speed_power_mpm', 'hyd_speed_flow_mpm', 'hyd_speed_available_mpm',
      'hyd_hp_req', 'hyd_hp_sys', 'hyd_tau_avail_kNm',
      'hyd_tension_theoretical_start_kgf', 'hyd_tension_required_start_kgf',
      'hyd_avail_tension_kgf'
    ],
    header: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'hyd_P_required_psi',
      'hyd_speed_power_mpm', 'hyd_speed_flow_mpm', 'hyd_speed_available_mpm',
      'hyd_hp_req', 'hyd_hp_sys', 'hyd_tau_avail_kNm',
      'hyd_tension_theoretical_start_kgf', 'hyd_tension_required_start_kgf',
      'hyd_avail_tension_kgf'
    ],
    getRows: () => lastHyLayer
  },
  csv_hy_wraps: {
    filename: () => 'hydraulic-wraps.csv',
    columns: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'hyd_P_required_psi', 'hyd_speed_power_mpm',
      'hyd_speed_flow_mpm', 'hyd_speed_available_mpm', 'hyd_hp_req',
      'hyd_hp_sys', 'hyd_tau_avail_kNm', 'hyd_avail_tension_kgf'
    ],
    header: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'hyd_P_required_psi', 'hyd_speed_power_mpm',
      'hyd_speed_flow_mpm', 'hyd_speed_available_mpm', 'hyd_hp_req',
      'hyd_hp_sys', 'hyd_tau_avail_kNm', 'hyd_avail_tension_kgf'
    ],
    getRows: () => lastHyWraps
  }
};

const SYSTEM_TYPE_SELECT_ID = 'system_type_select';
const DEFAULT_SYSTEM_TYPE = 'electric';
const PLOT_DISPLAY_SETTING_IDS = [
  'wave_scenario',
  'wave_tmin',
  'wave_tmax',
  'wave_vmin',
  'wave_vmax',
  'wave_tmin_height',
  'wave_tmax_height',
  'wave_hmin',
  'wave_hmax',
  'wave_speed_show_sea_states',
  'wave_show_sea_states',
  'wave_show_breaking_limit',
  'wave_show_pm_curve',
  'wave_show_jonswap_curve',
  'wave_show_smb_curve',
  'depth_xmin',
  'depth_xmax',
  'depth_speed_ymin',
  'depth_speed_ymax',
  'depth_xmin_tension',
  'depth_xmax_tension',
  'depth_tension_ymin',
  'depth_tension_ymax',
  'hyd_torque_xmin',
  'hyd_torque_xmax',
  'hyd_rpm_ymin',
  'hyd_rpm_ymax'
];

function readElementStateValue(el) {
  if (!el) return undefined;
  if (el.tagName === 'INPUT') {
    const input = /** @type {HTMLInputElement} */ (el);
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'radio') return input.checked ? input.value : undefined;
    return input.value;
  }
  if (el.tagName === 'SELECT') {
    const select = /** @type {HTMLSelectElement} */ (el);
    if (select.multiple) {
      return Array.from(select.options)
        .filter(opt => opt.selected)
        .map(opt => opt.value);
    }
    return select.value;
  }
  if (el.tagName === 'TEXTAREA') {
    return /** @type {HTMLTextAreaElement} */ (el).value;
  }
  return undefined;
}

const PROJECT_STATE_PINS_KEY = '__plotPins';

function clonePinArray(value, requiredKeys = []) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(pin => pin && typeof pin === 'object' && requiredKeys.every(key => Number.isFinite(pin[key])))
    .map((pin, idx) => ({ ...pin, label: typeof pin.label === 'string' && pin.label ? pin.label : `P${idx + 1}` }));
}

function collectProjectPlotPins() {
  const waveSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg'));
  const waveHeightSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg_height'));
  const depthSpeedSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_svg'));
  const depthTensionSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_tension_svg'));
  const rpmSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('hyd_rpm_torque_svg'));

  return {
    wave: clonePinArray(waveSvg?._wavePins, ['x', 'y']),
    waveHeight: clonePinArray(waveHeightSvg?._wavePins, ['x', 'y']),
    depthSpeed: clonePinArray(depthSpeedSvg?._depthSpeedPins, ['depth', 'speed']),
    depthTension: clonePinArray(depthTensionSvg?._depthTensionPins, ['depth', 'tension']),
    rpmTorque: clonePinArray(rpmSvg?._rpmTorquePins, ['torque', 'rpm'])
  };
}

function applyProjectPlotPins(pinState) {
  if (!pinState || typeof pinState !== 'object') return;
  const waveSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg'));
  const waveHeightSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg_height'));
  const depthSpeedSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_svg'));
  const depthTensionSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_tension_svg'));
  const rpmSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('hyd_rpm_torque_svg'));

  if (waveSvg) waveSvg._wavePins = clonePinArray(pinState.wave, ['x', 'y']);
  if (waveHeightSvg) waveHeightSvg._wavePins = clonePinArray(pinState.waveHeight, ['x', 'y']);
  if (depthSpeedSvg) depthSpeedSvg._depthSpeedPins = clonePinArray(pinState.depthSpeed, ['depth', 'speed']);
  if (depthTensionSvg) depthTensionSvg._depthTensionPins = clonePinArray(pinState.depthTension, ['depth', 'tension']);
  if (rpmSvg) rpmSvg._rpmTorquePins = clonePinArray(pinState.rpmTorque, ['torque', 'rpm']);
}

function collectProjectState() {
  const state = collectInputState();
  PLOT_DISPLAY_SETTING_IDS.forEach(id => {
    const el = document.getElementById(id);
    const value = readElementStateValue(el);
    if (value !== undefined) {
      state[id] = value;
    }
  });
  state[PROJECT_STATE_PINS_KEY] = collectProjectPlotPins();
  return state;
}

function applyProjectState(state) {
  if (!state || typeof state !== 'object') return;
  Object.entries(state).forEach(([id, value]) => {
    if (id === PROJECT_STATE_PINS_KEY) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') {
      const input = /** @type {HTMLInputElement} */ (el);
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else if (input.type === 'radio') {
        input.checked = value === input.value;
      } else {
        input.value = value == null ? '' : String(value);
      }
    } else if (el.tagName === 'SELECT') {
      const select = /** @type {HTMLSelectElement} */ (el);
      if (select.multiple && Array.isArray(value)) {
        const values = new Set(value.map(String));
        Array.from(select.options).forEach(opt => {
          opt.selected = values.has(opt.value);
        });
      } else {
        select.value = value == null ? '' : String(value);
      }
    } else if (el.tagName === 'TEXTAREA') {
      el.value = value == null ? '' : String(value);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  applyProjectPlotPins(state[PROJECT_STATE_PINS_KEY]);
}

function sanitizeProjectFilename(name) {
  const trimmed = String(name || 'project').trim().toLowerCase();
  const normalized = trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || 'project';
}

function downloadProjectJson(project) {
  const payload = JSON.stringify(project, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `${sanitizeProjectFilename(project?.name)}-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function setupProjectManager() {
  const nameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('project_name'));
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('project_select'));
  const saveNewBtn = document.getElementById('save_project_new');
  const saveBtn = document.getElementById('save_project');
  const renameBtn = document.getElementById('rename_project');
  const loadBtn = document.getElementById('load_project');
  const importBtn = document.getElementById('import_project');
  const importFileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('import_project_file'));
  const exportBtn = document.getElementById('export_project');
  const deleteBtn = document.getElementById('delete_project');
  const statusEl = document.getElementById('project_status');
  if (!nameInput || !select || !saveNewBtn || !saveBtn || !renameBtn || !loadBtn || !importBtn || !importFileInput || !exportBtn || !deleteBtn || !statusEl) return;

  const LOCAL_PROJECTS_KEY = 'analyzer.projects.v1';
  let cachedProjects = [];

  const setStatus = (message) => {
    statusEl.textContent = message || '';
  };

  const normalizeProject = (project) => {
    if (!project || typeof project !== 'object' || Array.isArray(project)) return null;
    if (typeof project.id !== 'string' || !project.id.trim()) return null;
    if (typeof project.name !== 'string' || !project.name.trim()) return null;
    if (!project.state || typeof project.state !== 'object' || Array.isArray(project.state)) return null;
    return {
      id: project.id,
      name: project.name.trim(),
      state: project.state,
      ...(typeof project.description === 'string' ? { description: project.description } : {}),
      ...(typeof project.createdAt === 'string' ? { createdAt: project.createdAt } : {}),
      ...(typeof project.updatedAt === 'string' ? { updatedAt: project.updatedAt } : {}),
      ...(project.origin ? { origin: project.origin } : {})
    };
  };

  const toImportedProject = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const candidate = raw.project && typeof raw.project === 'object' && !Array.isArray(raw.project)
      ? raw.project
      : raw;

    const fromSavedShape = normalizeProject(candidate);
    if (fromSavedShape) {
      return {
        ...fromSavedShape,
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
      };
    }

    if (!candidate.state || typeof candidate.state !== 'object' || Array.isArray(candidate.state)) return null;
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : 'Imported project',
      state: candidate.state
    };
  };

  const getProjectStorage = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const probeKey = `${LOCAL_PROJECTS_KEY}.__probe__`;
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return window.localStorage;
    } catch (err) {
      console.warn('Project fallback storage disabled:', err);
      return null;
    }
  };

  const readLocalProjects = () => {
    const storage = getProjectStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(LOCAL_PROJECTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeProject).filter(Boolean);
    } catch (err) {
      console.warn('Unable to read local projects:', err);
      return [];
    }
  };

  const writeLocalProjects = (projects) => {
    const storage = getProjectStorage();
    if (!storage) return false;
    try {
      storage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
      return true;
    } catch (err) {
      console.warn('Unable to persist local projects:', err);
      return false;
    }
  };

  const upsertLocalProject = ({ id, name, state }) => {
    const timestamp = new Date().toISOString();
    const projects = readLocalProjects();
    const existingIndex = id ? projects.findIndex(project => project.id === id) : -1;
    if (existingIndex >= 0) {
      const existing = projects[existingIndex];
      const merged = {
        ...existing,
        id: existing.id,
        name,
        state,
        updatedAt: timestamp,
        createdAt: existing.createdAt || timestamp
      };
      projects[existingIndex] = merged;
      writeLocalProjects(projects);
      return merged;
    }

    const created = {
      id: id || `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      name,
      state,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    projects.push(created);
    writeLocalProjects(projects);
    return created;
  };

  const mergeProjects = (...lists) => {
    const byId = new Map();
    lists.flat().forEach((candidate) => {
      const project = normalizeProject(candidate);
      if (!project) return;
      byId.set(project.id, project);
    });
    return Array.from(byId.values()).sort((a, b) => {
      const aUpdated = typeof a.updatedAt === 'string' ? Date.parse(a.updatedAt) : 0;
      const bUpdated = typeof b.updatedAt === 'string' ? Date.parse(b.updatedAt) : 0;
      return bUpdated - aUpdated;
    });
  };

  const renderProjects = (projects) => {
    cachedProjects = projects;
    const currentSelection = select.value;
    while (select.options.length > 1) {
      select.remove(1);
    }
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
    select.value = projects.some(project => project.id === currentSelection) ? currentSelection : '';
  };

  const loadProjects = async () => {
    const localProjects = readLocalProjects();
    let remoteProjects = [];
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const body = await response.json();
        remoteProjects = (Array.isArray(body?.projects) ? body.projects : []).map(normalizeProject).filter(Boolean);
      }
    } catch (err) {
      // local fallback stays active
    }

    const merged = mergeProjects(remoteProjects, localProjects);
    renderProjects(merged);
    return merged;
  };

  const getProjectById = async (projectId) => {
    if (!projectId) return null;
    const cached = cachedProjects.find(project => project.id === projectId);
    if (cached) return cached;
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      if (response.ok) {
        const body = await response.json();
        return normalizeProject(body?.project);
      }
    } catch (err) {
      // Fallback to local and preset-backed projects below.
    }
    const projects = await loadProjects();
    return projects.find(project => project.id === projectId) || null;
  };

  const saveProject = async ({ useSelectedId }) => {
    const selectedId = useSelectedId ? select.value || undefined : undefined;
    const name = nameInput.value.trim();
    if (!name) {
      window.alert('Enter a project name before saving.');
      return;
    }

    const payload = {
      ...(selectedId ? { id: selectedId } : {}),
      name,
      state: collectProjectState()
    };

    let savedProject = null;
    let savedRemotely = false;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const body = await response.json();
        savedProject = normalizeProject(body?.project);
        savedRemotely = Boolean(savedProject?.id);
      }
    } catch (err) {
      // local fallback below
    }

    if (!savedProject) {
      savedProject = upsertLocalProject(payload);
    } else {
      upsertLocalProject(savedProject);
    }


    await loadProjects();
    select.value = savedProject.id;
    nameInput.value = savedProject.name || name;
    setStatus(savedRemotely ? (selectedId ? 'Project updated.' : 'Project saved.') : (selectedId ? 'Updated locally (offline/server unavailable).' : 'Saved locally (offline/server unavailable).'));
  };

  saveNewBtn.addEventListener('click', async () => {
    await saveProject({ useSelectedId: false });
  });

  saveBtn.addEventListener('click', async () => {
    if (!select.value) {
      window.alert('Select a saved project to update, or use Save new.');
      return;
    }
    await saveProject({ useSelectedId: true });
  });

  renameBtn.addEventListener('click', async () => {
    const selectedId = select.value;
    if (!selectedId) {
      window.alert('Select a saved project to rename.');
      return;
    }

    const nextName = nameInput.value.trim();
    if (!nextName) {
      window.alert('Enter a new project name first.');
      return;
    }

    const current = await getProjectById(selectedId);
    if (!current || typeof current.state !== 'object' || current.state === null) {
      window.alert('Unable to rename: project data could not be loaded.');
      return;
    }

    await saveProject({ useSelectedId: true });
    nameInput.value = nextName;
  });

  loadBtn.addEventListener('click', async () => {
    const selectedId = select.value;
    if (!selectedId) {
      window.alert('Select a saved project to load.');
      return;
    }

    const project = await getProjectById(selectedId);
    if (!project || typeof project.state !== 'object' || project.state === null) {
      window.alert('Unable to load project.');
      return;
    }

    applyProjectState(project.state);
    nameInput.value = project.name || '';
    computeAll();
    setStatus('Project loaded.');
  });

  importBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async () => {
    const file = importFileInput.files?.[0];
    importFileInput.value = '';
    if (!file) return;

    try {
      const raw = JSON.parse(await file.text());
      const imported = toImportedProject(raw);
      if (!imported) {
        window.alert('Selected file is not a valid project export.');
        return;
      }

      applyProjectState(imported.state);
      computeAll();
      nameInput.value = imported.name;

      const localImported = upsertLocalProject(imported);
      await loadProjects();
      select.value = localImported.id;
      setStatus('Project imported from file and loaded.');
    } catch (err) {
      window.alert('Unable to import project file. Ensure it is valid JSON.');
    }
  });

  exportBtn.addEventListener('click', async () => {
    const selectedId = select.value;
    if (!selectedId) {
      window.alert('Select a saved project to export.');
      return;
    }

    const project = await getProjectById(selectedId);
    if (!project || typeof project.state !== 'object' || project.state === null) {
      window.alert('Unable to export project.');
      return;
    }

    downloadProjectJson(project);
    setStatus('Project exported to JSON file.');
  });

  deleteBtn.addEventListener('click', async () => {
    const selectedId = select.value;
    if (!selectedId) {
      window.alert('Select a saved project to delete.');
      return;
    }

    const selectedName = select.selectedOptions?.[0]?.textContent || 'this project';
    if (!window.confirm(`Delete ${selectedName}?`)) return;

    try {
      await fetch(`/api/projects/${encodeURIComponent(selectedId)}`, { method: 'DELETE' });
    } catch (err) {
      // ignore; local delete still applied
    }

    const projects = readLocalProjects().filter(project => project.id !== selectedId);
    writeLocalProjects(projects);


    await loadProjects();
    nameInput.value = '';
    setStatus('Project deleted.');
  });

  select.addEventListener('change', () => {
    const option = select.selectedOptions?.[0];
    if (option?.value) {
      nameInput.value = option.textContent || '';
      setStatus('');
      return;
    }
    nameInput.value = '';
    setStatus('');
  });

  await loadProjects();
  setStatus('');
}


// ---- Wire up events once DOM is ready ----
document.addEventListener('DOMContentLoaded', () => {
  setupInputPersistence();

  setupComponentSelectors();

  setupCollapsibleToggles();

  setupDriveModeControls();

  setupCsvDownloads();

  setupWrapTableToggleLabels();

  setupPlotSettingsDialogs();

  configureSectionFourContent();

  setupProjectManager();

  setupAutoRecompute();

  updateBuildIndicator();



  setupUnitConverter();

  renderDocumentMath();

  document.querySelectorAll('.param-label').forEach(label => {
    const code = label.dataset.code;
    if (code) {
      label.setAttribute('title', code);
    }
  });

  // Wave/depth/hydraulic plot controls
  ['wave_scenario', 'wave_tmin', 'wave_tmax', 'wave_vmin', 'wave_vmax', 'wave_tmin_height', 'wave_tmax_height', 'wave_hmin', 'wave_hmax', 'wave_speed_show_sea_states', 'wave_show_sea_states', 'wave_show_breaking_limit', 'wave_show_pm_curve', 'wave_show_jonswap_curve', 'wave_show_smb_curve',
    'depth_xmin', 'depth_xmax', 'depth_speed_ymin', 'depth_speed_ymax',
    'depth_xmin_tension', 'depth_xmax_tension', 'depth_tension_ymin', 'depth_tension_ymax',
    'hyd_torque_xmin', 'hyd_torque_xmax', 'hyd_rpm_ymin', 'hyd_rpm_ymax']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const rerender = () => redrawPlots();
      el.addEventListener('change', rerender);
      el.addEventListener('input', rerender);
    });

  // Initial compute
  computeAll();
});


function setupPlotSettingsDialogs() {
  document.querySelectorAll('[data-plot-settings-target]').forEach(btn => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const id = btn.dataset.plotSettingsTarget;
    if (!id) return;
    const dialog = /** @type {HTMLDialogElement|null} */ (document.getElementById(id));
    if (!dialog) return;
    btn.addEventListener('click', () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
    });
  });

  document.querySelectorAll('[data-sync-source]').forEach(proxy => {
    if (!(proxy instanceof HTMLInputElement)) return;
    const sourceId = proxy.dataset.syncSource;
    if (!sourceId) return;
    const source = /** @type {HTMLInputElement|null} */ (document.getElementById(sourceId));
    if (!source) return;

    const syncFromSource = () => {
      proxy.value = source.value;
    };
    const syncToSource = () => {
      source.value = proxy.value;
      source.dispatchEvent(new Event('change', { bubbles: true }));
    };

    syncFromSource();
    source.addEventListener('change', syncFromSource);
    proxy.addEventListener('change', syncToSource);
    proxy.addEventListener('input', syncToSource);
  });
}

function renderDocumentMath() {
  if (typeof window.renderMathInElement === 'function') {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
  renderLatexFragments(document.body);
}

function updateBuildIndicator() {
  const indicator = /** @type {HTMLElement|null} */ (document.getElementById('build-info'));
  if (!indicator) return;

  indicator.textContent = 'LATEST COMMIT VERSION UNAVAILABLE';

  fetch(`/api/build-info?ts=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Build info request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(payload => {
      const rawTimestamp = typeof payload?.latestCommitAt === 'string' ? payload.latestCommitAt : '';
      const rawHash = typeof payload?.latestCommitHash === 'string' ? payload.latestCommitHash : '';
      if (!rawTimestamp || !rawHash) {
        throw new Error('Build info response did not include commit version details.');
      }

      indicator.textContent = formatGeneratedStamp(new Date(rawTimestamp), rawHash);
    })
    .catch(() => {
      indicator.textContent = 'LATEST COMMIT VERSION UNAVAILABLE';
    });
}

/**
 * @param {Date} date
 * @param {string} hash
 */
function formatGeneratedStamp(date, hash) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const zone = (map.timeZoneName || 'CDT').toUpperCase();
  const shortHash = hash.trim().slice(0, 12) || 'unknown';
  return `LATEST COMMIT ${shortHash} @ ${map.year}-${map.month}-${map.day}, ${map.hour}:${map.minute}:${map.second} ${zone}`;
}

function setupUnitConverter() {
  const inputValueEl = /** @type {HTMLInputElement|null} */ (document.getElementById('unit-converter-input-value'));
  const categoryEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('unit-converter-category'));
  const inputUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('unit-converter-input-unit'));
  const outputUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('unit-converter-output-unit'));
  const outputValueEl = /** @type {HTMLOutputElement|null} */ (document.getElementById('unit-converter-output-value'));

  if (!inputValueEl || !categoryEl || !inputUnitEl || !outputUnitEl || !outputValueEl) return;

  const categories = {
    force: {
      label: 'Force',
      base: 'N',
      units: { kgf: 9.80665, N: 1, lb: 4.4482216153, Te: 9806.65, short_ton: 8896.4432305, kN: 1000 }
    },
    torque: { label: 'Torque', base: 'N_m', units: { N_m: 1, lb_ft: 1.3558179483, in_lb: 0.112984829 } },
    power: { label: 'Power', base: 'W', units: { W: 1, kW: 1000, hp: 745.69987158 } },
    speed: {
      label: 'Speed',
      base: 'm_per_s',
      units: { ft_per_s: 0.3048, ft_per_min: 0.00508, m_per_s: 1, m_per_min: 1 / 60, knots: 0.5144444444, mph: 0.44704, km_per_hr: 0.2777777778 }
    },
    length: { label: 'Length', base: 'm', units: { m: 1, km: 1000, ft: 0.3048, in: 0.0254 } },
    pressure: { label: 'Pressure', base: 'Pa', units: { psi: 6894.757293, ksi: 6894757.293, kPa: 1000, bar: 100000 } },
    flow: { label: 'Flow', base: 'm3_per_s', units: { gpm: 0.0000630901964, L_per_min: 1 / 60000, cc_per_min: 1 / 60000000 } },
    volume: { label: 'Volume', base: 'm3', units: { gal: 0.003785411784, cc: 1e-6, L: 0.001 } },
    linear_mass: { label: 'Linear mass', base: 'kg_per_m', units: { kg_per_m: 1, kg_per_km: 0.001, lb_per_ft: 1.48816394357 } }
  };

  const unitLabels = {
    kgf: 'kgf', N: 'N', lb: 'lb', Te: 'Tonne (Te)', short_ton: 'Ton (short ton)', kN: 'kN',
    N_m: 'N·m', lb_ft: 'lb·ft', in_lb: 'in·lb', W: 'W', kW: 'kW', hp: 'hp',
    ft_per_s: 'ft/s', ft_per_min: 'ft/min', m_per_s: 'm/s', m_per_min: 'm/min', knots: 'nauts', mph: 'mph', km_per_hr: 'km/hr',
    m: 'm', km: 'km', ft: 'ft', in: 'in', psi: 'psi', ksi: 'ksi', kPa: 'kPa', bar: 'bar',
    gpm: 'gpm', L_per_min: 'L/min', cc_per_min: 'cc/min', gal: 'gal', cc: 'cc', L: 'L',
    kg_per_m: 'kg/m', kg_per_km: 'kg/km', lb_per_ft: 'lb/ft'
  };

  const formatValue = (value, digits = 6) => value.toLocaleString(undefined, { maximumFractionDigits: digits });

  const populateSelect = (selectEl, unitKeys, preferred = null) => {
    selectEl.innerHTML = '';
    unitKeys.forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = unitLabels[key] || key;
      selectEl.appendChild(option);
    });
    const fallback = preferred && unitKeys.includes(preferred) ? preferred : unitKeys[0];
    selectEl.value = fallback;
  };

  Object.entries(categories).forEach(([key, spec]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = spec.label;
    categoryEl.appendChild(option);
  });

  const syncCategoryUnits = () => {
    const spec = categories[categoryEl.value] || categories.linear_mass;
    const unitKeys = Object.keys(spec.units);
    const prevIn = inputUnitEl.value;
    const prevOut = outputUnitEl.value;
    populateSelect(inputUnitEl, unitKeys, unitKeys.includes(prevIn) ? prevIn : unitKeys[0]);
    populateSelect(outputUnitEl, unitKeys, unitKeys.includes(prevOut) ? prevOut : unitKeys[Math.min(1, unitKeys.length - 1)]);
  };

  const convert = (value, fromUnit, toUnit, category) => {
    const spec = categories[category];
    if (!spec) return null;
    const fromFactor = spec.units[fromUnit];
    const toFactor = spec.units[toUnit];
    if (!Number.isFinite(value) || !fromFactor || !toFactor) return null;
    return value * fromFactor / toFactor;
  };

  const readEfficiency = el => {
    const raw = Number.parseFloat(el.value);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw > 1 ? raw / 100 : raw;
  };

  const refreshConverter = () => {
    const converted = convert(Number.parseFloat(inputValueEl.value), inputUnitEl.value, outputUnitEl.value, categoryEl.value);
    outputValueEl.textContent = Number.isFinite(converted) ? formatValue(converted) : '—';
  };

  const bindEvents = (elements, fn) => {
    ['input', 'change'].forEach(eventName => elements.forEach(el => el?.addEventListener(eventName, fn)));
  };

  // Weight in air -> weight in water
  const airValueEl = /** @type {HTMLInputElement|null} */ (document.getElementById('air-water-air-value'));
  const airUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('air-water-air-unit'));
  const sgEl = /** @type {HTMLInputElement|null} */ (document.getElementById('air-water-sg'));
  const fluidDensityEl = /** @type {HTMLInputElement|null} */ (document.getElementById('air-water-fluid-density'));
  const airOutEl = /** @type {HTMLOutputElement|null} */ (document.getElementById('air-water-output'));
  const airOutUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('air-water-output-unit'));

  if (airUnitEl && airOutUnitEl) {
    populateSelect(airUnitEl, Object.keys(categories.force.units), 'kgf');
    populateSelect(airOutUnitEl, Object.keys(categories.force.units), 'kgf');
  }

  const refreshAirWater = () => {
    if (!airValueEl || !airUnitEl || !sgEl || !fluidDensityEl || !airOutEl || !airOutUnitEl) return;
    const airForceN = convert(Number.parseFloat(airValueEl.value), airUnitEl.value, 'N', 'force');
    const sg = Number.parseFloat(sgEl.value);
    const fluidDensity = Number.parseFloat(fluidDensityEl.value);
    if (!Number.isFinite(airForceN) || !Number.isFinite(sg) || !Number.isFinite(fluidDensity) || sg <= 0 || fluidDensity < 0) {
      airOutEl.textContent = '—';
      return;
    }
    const fluidSg = fluidDensity / 1000;
    const waterForceN = airForceN * (1 - fluidSg / sg);
    const converted = convert(waterForceN, 'N', airOutUnitEl.value, 'force');
    airOutEl.textContent = Number.isFinite(converted) ? formatValue(converted) : '—';
  };

  // Mechanical power
  const mechForceValEl = /** @type {HTMLInputElement|null} */ (document.getElementById('mech-power-force-value'));
  const mechForceUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('mech-power-force-unit'));
  const mechSpeedValEl = /** @type {HTMLInputElement|null} */ (document.getElementById('mech-power-speed-value'));
  const mechSpeedUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('mech-power-speed-unit'));
  const mechEffEl = /** @type {HTMLInputElement|null} */ (document.getElementById('mech-power-efficiency'));
  const mechOutEl = /** @type {HTMLOutputElement|null} */ (document.getElementById('mech-power-output'));
  const mechOutUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('mech-power-output-unit'));

  if (mechForceUnitEl) populateSelect(mechForceUnitEl, Object.keys(categories.force.units), 'kgf');
  if (mechSpeedUnitEl) populateSelect(mechSpeedUnitEl, Object.keys(categories.speed.units), 'm_per_s');
  if (mechOutUnitEl) populateSelect(mechOutUnitEl, Object.keys(categories.power.units), 'kW');

  const refreshMechanicalPower = () => {
    if (!mechForceValEl || !mechForceUnitEl || !mechSpeedValEl || !mechSpeedUnitEl || !mechEffEl || !mechOutEl || !mechOutUnitEl) return;
    const forceN = convert(Number.parseFloat(mechForceValEl.value), mechForceUnitEl.value, 'N', 'force');
    const speedMps = convert(Number.parseFloat(mechSpeedValEl.value), mechSpeedUnitEl.value, 'm_per_s', 'speed');
    const eff = readEfficiency(mechEffEl);
    if (!Number.isFinite(forceN) || !Number.isFinite(speedMps) || !Number.isFinite(eff)) {
      mechOutEl.textContent = '—';
      return;
    }
    const powerW = forceN * speedMps * eff;
    const converted = convert(powerW, 'W', mechOutUnitEl.value, 'power');
    mechOutEl.textContent = Number.isFinite(converted) ? formatValue(converted) : '—';
  };

  // Hydraulic power
  const hydPressureValEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd-power-pressure-value'));
  const hydPressureUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('hyd-power-pressure-unit'));
  const hydFlowValEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd-power-flow-value'));
  const hydFlowUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('hyd-power-flow-unit'));
  const hydEffEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd-power-efficiency'));
  const hydOutEl = /** @type {HTMLOutputElement|null} */ (document.getElementById('hyd-power-output'));
  const hydOutUnitEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('hyd-power-output-unit'));

  if (hydPressureUnitEl) populateSelect(hydPressureUnitEl, Object.keys(categories.pressure.units), 'psi');
  if (hydFlowUnitEl) populateSelect(hydFlowUnitEl, Object.keys(categories.flow.units), 'gpm');
  if (hydOutUnitEl) populateSelect(hydOutUnitEl, Object.keys(categories.power.units), 'kW');

  const refreshHydraulicPower = () => {
    if (!hydPressureValEl || !hydPressureUnitEl || !hydFlowValEl || !hydFlowUnitEl || !hydEffEl || !hydOutEl || !hydOutUnitEl) return;
    const pressurePa = convert(Number.parseFloat(hydPressureValEl.value), hydPressureUnitEl.value, 'Pa', 'pressure');
    const flowM3S = convert(Number.parseFloat(hydFlowValEl.value), hydFlowUnitEl.value, 'm3_per_s', 'flow');
    const eff = readEfficiency(hydEffEl);
    if (!Number.isFinite(pressurePa) || !Number.isFinite(flowM3S) || !Number.isFinite(eff)) {
      hydOutEl.textContent = '—';
      return;
    }
    const powerW = pressurePa * flowM3S * eff;
    const converted = convert(powerW, 'W', hydOutUnitEl.value, 'power');
    hydOutEl.textContent = Number.isFinite(converted) ? formatValue(converted) : '—';
  };

  categoryEl.value = 'linear_mass';
  syncCategoryUnits();
  bindEvents([inputValueEl, inputUnitEl, outputUnitEl], refreshConverter);
  categoryEl.addEventListener('change', () => {
    syncCategoryUnits();
    refreshConverter();
  });

  bindEvents([airValueEl, airUnitEl, sgEl, fluidDensityEl, airOutUnitEl], refreshAirWater);
  bindEvents([mechForceValEl, mechForceUnitEl, mechSpeedValEl, mechSpeedUnitEl, mechEffEl, mechOutUnitEl], refreshMechanicalPower);
  bindEvents([hydPressureValEl, hydPressureUnitEl, hydFlowValEl, hydFlowUnitEl, hydEffEl, hydOutUnitEl], refreshHydraulicPower);

  refreshConverter();
  refreshAirWater();
  refreshMechanicalPower();
  refreshHydraulicPower();
}

function setupCsvDownloads() {
  Object.entries(CSV_BUTTON_SPECS).forEach(([id, spec]) => {
    const btn = q(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const rows = spec.getRows ? spec.getRows() : [];
      if (!rows || rows.length === 0) return;
      const csv = rowsToCsv(rows, spec.columns, spec.header);
      triggerCsvDownload(csv, spec.filename ? spec.filename() : `${id}.csv`);
    });
  });

  updateCsvButtonStates();
}

function updateCsvButtonStates() {
  Object.entries(CSV_BUTTON_SPECS).forEach(([id, spec]) => {
    const btn = q(id);
    if (!btn) return;
    const rows = spec.getRows ? spec.getRows() : [];
    btn.disabled = !(Array.isArray(rows) && rows.length > 0);
  });
}

function rowsToCsv(rows, columns, headerRow) {
  const header = (headerRow && headerRow.length ? headerRow : columns).map(csvEscapeCell).join(',');
  const dataLines = rows.map(row => columns.map(col => csvEscapeCell(row[col])).join(','));
  return [header, ...dataLines].join('\r\n');
}

function csvEscapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function triggerCsvDownload(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function setupCollapsibleToggles() {
  let collapseIdCounter = 0;
  const configs = [
    { selector: '#component-catalog-card', headerSelector: '.section-title', defaultExpanded: false },
    { selector: '.plot-controls__group', headerSelector: '.plot-controls__group-title', defaultExpanded: false }
  ];

  configs.forEach(({ selector, headerSelector, defaultExpanded }) => {
    document.querySelectorAll(selector).forEach(container => {
      initCollapsibleContainer(container, headerSelector, defaultExpanded);
    });
  });

  /**
   * @param {Element} container
   * @param {string} headerSelector
   * @param {boolean} defaultExpanded
   */
  function initCollapsibleContainer(container, headerSelector, defaultExpanded) {
    if (!(container instanceof HTMLElement)) return;
    if (container.dataset.collapseInit === 'true') return;

    const headerEl = container.querySelector(headerSelector);
    if (!headerEl) return;

    // Remove leading whitespace before the header to avoid stray text nodes.
    let cursor = container.firstChild;
    while (cursor && cursor !== headerEl) {
      const nextCursor = cursor.nextSibling;
      if (cursor.nodeType === Node.TEXT_NODE && !(cursor.textContent || '').trim()) {
        container.removeChild(cursor);
      }
      cursor = nextCursor;
    }

    const body = document.createElement('div');
    body.classList.add('collapse-body');

    let node = headerEl.nextSibling;
    while (node) {
      const next = node.nextSibling;
      body.appendChild(node);
      node = next;
    }

    const headerWrapper = document.createElement('div');
    headerWrapper.classList.add('collapse-header');
    headerWrapper.appendChild(headerEl);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.classList.add('collapse-toggle');
    headerWrapper.appendChild(toggle);

    container.insertBefore(headerWrapper, container.firstChild);
    container.appendChild(body);
    container.dataset.collapseInit = 'true';

    if (!body.id) {
      collapseIdCounter += 1;
      body.id = `collapse-body-${collapseIdCounter}`;
    }
    toggle.setAttribute('aria-controls', body.id);

    let expanded = defaultExpanded;

    const applyState = (value) => {
      expanded = value;
      toggle.textContent = expanded ? '[-]' : '[+]';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.setAttribute('aria-label', expanded ? 'Collapse section' : 'Expand section');
      body.hidden = !expanded;
      container.classList.toggle('is-collapsed', !expanded);
    };

    applyState(expanded);

    toggle.addEventListener('click', () => {
      applyState(!expanded);
    });
  }
}

function setupWrapTableToggleLabels() {
  const detailsItems = Array.from(document.querySelectorAll('details.collapsible'));
  detailsItems.forEach(details => {
    const hint = details.querySelector('.collapsible-hint');
    if (!(hint instanceof HTMLElement)) return;

    const openLabel = hint.dataset.collapsibleOpenLabel || '[-]';
    const closedLabel = hint.dataset.collapsibleClosedLabel || '[+]';

    const apply = () => {
      hint.textContent = details.hasAttribute('open') ? openLabel : closedLabel;
    };

    apply();
    details.addEventListener('toggle', apply);
  });
}

function configureSectionFourContent() {
  const tab = /** @type {HTMLElement|null} */ (document.getElementById('tab-instructions'));
  if (tab) tab.textContent = 'Section 4: Symbols, Calculations, and Instructions';

  const title = /** @type {HTMLElement|null} */ (document.getElementById('hydraulic-core-equations-title'));
  if (title) title.textContent = 'Section 4: Symbols, Calculations, and Instructions';

  const equationCard = /** @type {HTMLElement|null} */ (document.getElementById('hydraulic-core-equations'));
  const exportGuideCard = /** @type {HTMLElement|null} */ (document.getElementById('preset-export-guide'));
  const catalogCard = /** @type {HTMLElement|null} */ (document.getElementById('component-catalog-card'));
  const panel = /** @type {HTMLElement|null} */ (document.getElementById('panel-instructions'));

  if (panel && exportGuideCard) panel.appendChild(exportGuideCard);

  if (equationCard) {
    const headings = equationCard.querySelectorAll('h3');
    if (headings[0]) headings[0].textContent = 'Section 4.1: Symbols';
    if (headings[1]) headings[1].textContent = 'Section 4.2: Calculations';

    const rows = Array.from(equationCard.querySelectorAll('tbody tr'));
    rows.forEach(row => {
      if (!(row instanceof HTMLTableRowElement)) return;
      const symbolCell = row.cells[0];
      const descCell = row.cells[1];
      if (!symbolCell || !descCell) return;
      const symbol = (symbolCell.textContent || '').replace(/\s+/g, '');
      if (symbol.includes('n_e')) descCell.textContent = 'electric prime mover speed';
      if (symbol.includes('P_{nom}')) descCell.textContent = 'total nominal prime-mover power';
      if (symbol.includes('P_{avail}')) descCell.textContent = 'available prime-mover power';
      if (symbol.includes('η_{em}') || symbol.includes('\eta_{em}')) descCell.textContent = 'electromechanical chain efficiency';
    });

    const calcHeadings = equationCard.querySelectorAll('h3 + ol ~ h3');
    calcHeadings.forEach(heading => {
      if (!(heading instanceof HTMLElement)) return;
      const h4 = document.createElement('h4');
      h4.textContent = heading.textContent || '';
      heading.replaceWith(h4);
    });
  }

  if (catalogCard) {
    const heading = catalogCard.querySelector('.section-title');
    if (heading) heading.textContent = 'Section 4.3: Instructions — How to update component presets';
    catalogCard.classList.add('instructions-only');
  }

  if (exportGuideCard) {
    const heading = exportGuideCard.querySelector('.section-title');
    if (heading) heading.textContent = 'Section 4.3: Instructions — Exporting component presets';
    exportGuideCard.classList.add('instructions-only');
  }
}

function renderInputSummary() {
  const summaryRoot = /** @type {HTMLElement|null} */ (document.getElementById('input-summary'));
  const summaryIntro = /** @type {HTMLElement|null} */ (document.getElementById('input-summary-intro'));
  const sourceRoot = /** @type {HTMLElement|null} */ (document.getElementById('sidebar-inputs'));
  if (!summaryRoot || !sourceRoot) return;

  renderInputSummaryIntro(summaryIntro);

  const cards = Array.from(sourceRoot.querySelectorAll('[data-summary-card]'))
    .map(el => /** @type {HTMLElement} */ (el))
    .filter(card => !card.classList.contains('is-hidden'));

  const frag = document.createDocumentFragment();

  cards.forEach(card => {
    const summaryCard = document.createElement('section');
    summaryCard.classList.add('card', 'summary-card');

    const cardTitle = getNodeText(card.querySelector('.section-title'));
    if (cardTitle) {
      const heading = document.createElement('h2');
      heading.classList.add('section-title', 'summary-card__title');
      heading.textContent = cardTitle;
      summaryCard.appendChild(heading);
    }

    const sectionsContainer = document.createElement('div');
    sectionsContainer.classList.add('input-summary__sections');

    const inputSections = Array.from(card.querySelectorAll('.input-section'))
      .map(el => /** @type {HTMLElement} */ (el))
      .filter(section => section.closest('[data-summary-card]') === card && !section.classList.contains('is-hidden'));

    if (inputSections.length) {
      inputSections.forEach(section => {
        const sectionSummary = buildInputSectionSummary(section);
        if (sectionSummary) sectionsContainer.appendChild(sectionSummary);
      });
    } else {
      const plotGroups = Array.from(card.querySelectorAll('.plot-controls__group'))
        .map(el => /** @type {HTMLElement} */ (el))
        .filter(group => group.closest('[data-summary-card]') === card && !group.classList.contains('is-hidden'));

      if (plotGroups.length) {
        plotGroups.forEach(group => {
          const groupSummary = buildPlotGroupSummary(group);
          if (groupSummary) sectionsContainer.appendChild(groupSummary);
        });
      }
    }

    if (!sectionsContainer.children.length) {
      const tables = collectTables(card, table => table.closest('[data-summary-card]') === card);
      if (tables.length) {
        const fallbackSection = document.createElement('section');
        fallbackSection.classList.add('input-summary__section');
        tables.forEach(table => fallbackSection.appendChild(buildSummaryTable(table)));
        sectionsContainer.appendChild(fallbackSection);
      }
    }

    if (!sectionsContainer.children.length) return;

    summaryCard.appendChild(sectionsContainer);
    frag.appendChild(summaryCard);
  });

  summaryRoot.replaceChildren(frag);
}

/**
 * @param {HTMLElement|null} introRoot
 */
function renderInputSummaryIntro(introRoot) {
  if (!introRoot) return;

  const systemType = extractControlValue('system_type_select');
  const winchType = extractControlValue('winch_type_select');
  const selectedSystem = extractControlValue('system_select');

  const modeText = selectedSystem === 'Custom (manual input)'
    ? 'Custom parameter set'
    : `Preset basis: ${selectedSystem}`;

  introRoot.innerHTML = '';

  const intro = document.createElement('p');
  intro.className = 'summary-intro__body';
  intro.textContent = 'This section documents the exact options and numeric values used for the calculations, plots, and tabulated results in the remainder of this report.';

  const meta = document.createElement('div');
  meta.className = 'summary-intro__meta';
  meta.innerHTML = `
    <p><strong>System:</strong> ${systemType} / ${winchType}</p>
    <p><strong>Configuration Basis:</strong> ${modeText}</p>
  `;

  introRoot.append(intro, meta);
}

/**
 * @param {string} id
 */
function extractControlValue(id) {
  const control = document.getElementById(id);
  if (control instanceof HTMLSelectElement) {
    const option = control.selectedOptions[0];
    return normalizeText(option ? option.textContent : control.value);
  }
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    return normalizeText(control.value);
  }
  return '–';
}

/**
 * @param {HTMLElement} sectionEl
 */
function buildInputSectionSummary(sectionEl) {
  const summarySection = document.createElement('section');
  summarySection.classList.add('input-summary__section');

  const title = getNodeText(sectionEl.querySelector('.input-section__title'));
  if (title) {
    const heading = document.createElement('h3');
    heading.classList.add('input-summary__section-title');
    heading.textContent = title;
    summarySection.appendChild(heading);
  }

  collectTables(sectionEl, table => table.closest('.input-section') === sectionEl && !table.closest('.input-subsection'))
    .forEach(table => summarySection.appendChild(buildSummaryTable(table)));

  const subsections = Array.from(sectionEl.querySelectorAll('.input-subsection'))
    .map(el => /** @type {HTMLElement} */ (el))
    .filter(sub => sub.closest('.input-section') === sectionEl && !sub.classList.contains('is-hidden'));

  subsections.forEach(subsection => {
    const subsectionSummary = buildInputSubsectionSummary(subsection);
    if (subsectionSummary) summarySection.appendChild(subsectionSummary);
  });

  if (!summarySection.children.length) return null;
  return summarySection;
}

/**
 * @param {HTMLElement} subsectionEl
 */
function buildInputSubsectionSummary(subsectionEl) {
  const summarySubsection = document.createElement('section');
  summarySubsection.classList.add('input-summary__subsection');

  const title = getNodeText(subsectionEl.querySelector('.input-subsection__title'));
  if (title) {
    const heading = document.createElement('h4');
    heading.classList.add('input-summary__subsection-title');
    heading.textContent = title;
    summarySubsection.appendChild(heading);
  }

  collectTables(subsectionEl, table => table.closest('.input-subsection') === subsectionEl)
    .forEach(table => summarySubsection.appendChild(buildSummaryTable(table)));

  if (!summarySubsection.children.length) return null;
  return summarySubsection;
}

/**
 * @param {HTMLElement} groupEl
 */
function buildPlotGroupSummary(groupEl) {
  const summarySection = document.createElement('section');
  summarySection.classList.add('input-summary__section');

  const title = getNodeText(groupEl.querySelector('.plot-controls__group-title'));
  if (title) {
    const heading = document.createElement('h3');
    heading.classList.add('input-summary__section-title');
    heading.textContent = title;
    summarySection.appendChild(heading);
  }

  collectTables(groupEl, table => table.closest('.plot-controls__group') === groupEl)
    .forEach(table => summarySection.appendChild(buildSummaryTable(table)));

  if (!summarySection.children.length) return null;
  return summarySection;
}

/**
 * @param {HTMLElement} tableEl
 */
function buildSummaryTable(tableEl) {
  const summaryTable = document.createElement('table');
  summaryTable.classList.add('worksheet', 'worksheet--summary');

  const header = tableEl.tHead ? tableEl.tHead.cloneNode(true) : null;
  if (header instanceof HTMLTableSectionElement) {
    const headers = header.querySelectorAll('th');
    if (headers.length > 1) headers[1].textContent = 'Selected Value';
    summaryTable.appendChild(header);
  }

  const body = document.createElement('tbody');

  Array.from(tableEl.tBodies).forEach(srcBody => {
    Array.from(srcBody.rows).forEach(row => {
      const summaryRow = document.createElement('tr');
      summaryRow.className = row.className;

      if (row.classList.contains('note') || row.cells.length === 1) {
        const srcCell = row.cells[0];
        const cell = document.createElement('td');
        cell.colSpan = srcCell.colSpan || row.cells.length || 1;
        cell.className = srcCell.className;
        cell.textContent = normalizeText(srcCell.textContent);
        summaryRow.appendChild(cell);
        body.appendChild(summaryRow);
        return;
      }

      const headerCell = row.querySelector('th');
      if (headerCell) {
        const clonedHeader = headerCell.cloneNode(true);
        summaryRow.appendChild(clonedHeader);
      }

      const valueCell = document.createElement('td');
      valueCell.classList.add('value');
      valueCell.textContent = extractSummaryValue(row.querySelector('td.value'));
      summaryRow.appendChild(valueCell);

      const unitsCell = row.querySelector('td.units');
      if (unitsCell) {
        const clonedUnits = unitsCell.cloneNode(true);
        clonedUnits.textContent = normalizeText(unitsCell.textContent);
        summaryRow.appendChild(clonedUnits);
      }

      body.appendChild(summaryRow);
    });
  });

  summaryTable.appendChild(body);
  return summaryTable;
}

/**
 * @param {HTMLElement} tableCell
 */
function extractSummaryValue(tableCell) {
  if (!tableCell) return '–';

  const formControl = tableCell.querySelector('input, select, textarea');
  if (formControl instanceof HTMLInputElement) {
    if (formControl.type === 'checkbox') {
      return formControl.checked ? 'Yes' : 'No';
    }
    if (formControl.type === 'radio') {
      return formControl.checked ? normalizeText(formControl.value) : '–';
    }
    if (formControl.id === 'wraps_override') {
      const wrapValue = Number(formControl.value);
      if (!(Number.isFinite(wrapValue) && wrapValue > 0)) {
        const autoWraps = Number(lastDrumState?.meta?.wraps_per_layer_used);
        if (Number.isFinite(autoWraps) && autoWraps > 0) {
          return autoWraps.toFixed(1);
        }
      }
    }
    return normalizeText(formControl.value);
  }

  if (formControl instanceof HTMLSelectElement) {
    if (formControl.multiple) {
      const selections = Array.from(formControl.selectedOptions).map(opt => normalizeText(opt.textContent));
      return selections.length ? selections.join(', ') : '–';
    }
    const option = formControl.selectedOptions[0];
    const text = option ? normalizeText(option.textContent) : '–';
    return text === 'Custom (manual input)' ? '–' : text;
  }

  if (formControl instanceof HTMLTextAreaElement) {
    return normalizeText(formControl.value);
  }

  const outputField = tableCell.querySelector('.output-field');
  if (outputField) {
    return normalizeText(outputField.textContent);
  }

  return normalizeText(tableCell.textContent);
}

/**
 * @param {Element|null} node
 */
function getNodeText(node) {
  if (!node) return '';
  return normalizeText(node.textContent);
}

/**
 * @param {Element} root
 * @param {(table: HTMLTableElement) => boolean} predicate
 */
function collectTables(root, predicate) {
  return Array.from(root.querySelectorAll('table.worksheet'))
    .map(el => /** @type {HTMLTableElement} */ (el))
    .filter(table => predicate(table));
}

/**
 * @param {string|null} text
 */
function normalizeText(text) {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  return trimmed || '–';
}

function setupAutoRecompute() {
  const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
  if (!inputs.length) return;

  const handler = () => computeAll();

  inputs.forEach(el => {
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', handler);
      return;
    }

    if (el.tagName === 'INPUT') {
      const type = el.type;
      if (type === 'checkbox' || type === 'radio' || type === 'range' || type === 'color') {
        el.addEventListener('change', handler);
        return;
      }
    }

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
}

function updateMinimumSystemHp(ratedSpeedMpm, ratedSwlKgf, efficiency) {
  const output = /** @type {HTMLElement|null} */ (document.getElementById('system_min_hp'));
  if (!output) return;

  const validSpeed = Number.isFinite(ratedSpeedMpm) && ratedSpeedMpm > 0;
  const validSwl = Number.isFinite(ratedSwlKgf) && ratedSwlKgf > 0;

  if (!validSpeed || !validSwl) {
    output.textContent = '–';
    return;
  }

  const eff = Number.isFinite(efficiency) && efficiency > 0 ? efficiency : 1;
  const force_N = ratedSwlKgf * G;
  const speed_mps = ratedSpeedMpm / 60;
  const base_power_W = force_N * speed_mps;
  const base_hp = base_power_W / W_PER_HP;
  const hp_with_eff = base_hp / eff;
  const min_hp = hp_with_eff * 1.2;

  output.textContent = Number.isFinite(min_hp) ? min_hp.toFixed(1) : '–';
}

function clearMinimumSystemHp() {
  const output = /** @type {HTMLElement|null} */ (document.getElementById('system_min_hp'));
  if (output) output.textContent = '–';
}

function syncDerivedCableLengths() {
  const deadEndInput = /** @type {HTMLInputElement|null} */ (document.getElementById('dead_m'));

  const cableLength = read('cable_len_m');
  const maxOperatingDepth = read('depth_m');
  const deadEndLength = Number.isFinite(cableLength) && Number.isFinite(maxOperatingDepth)
    ? +(cableLength - maxOperatingDepth).toFixed(3)
    : NaN;

  if (deadEndInput) {
    deadEndInput.value = Number.isFinite(deadEndLength) ? String(deadEndLength) : '';
  }

  return {
    maxOperatingDepth: Number.isFinite(maxOperatingDepth) ? maxOperatingDepth : null,
    deadEndLength: Number.isFinite(deadEndLength) ? deadEndLength : null
  };
}

function updateStrengthOnlyMaxLength(payloadKgf, cableWeightKgfPerM, mblKgf, safetyFactor) {
  const output = /** @type {HTMLElement|null} */ (document.getElementById('max_length_strength_m'));
  if (!output) return;

  const validPayload = Number.isFinite(payloadKgf) && payloadKgf >= 0;
  const validCableWeight = Number.isFinite(cableWeightKgfPerM) && cableWeightKgfPerM > 0;
  const validMbl = Number.isFinite(mblKgf) && mblKgf > 0;
  const validSf = Number.isFinite(safetyFactor) && safetyFactor > 0;
  if (!validPayload || !validCableWeight || !validMbl || !validSf) {
    output.textContent = '–';
    return;
  }

  const allowableTensionKgf = mblKgf / safetyFactor;
  const maxLengthM = (allowableTensionKgf - payloadKgf) / cableWeightKgfPerM;
  const boundedLengthM = Math.max(0, maxLengthM);
  output.textContent = Number.isFinite(boundedLengthM) ? boundedLengthM.toFixed(1) : '–';
}

function setupDriveModeControls() {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById(SYSTEM_TYPE_SELECT_ID));
  if (select) {
    const handler = () => {
      syncDriveModeVisibility();
    };
    select.addEventListener('change', handler);
    select.addEventListener('input', handler);
  }

  syncDriveModeVisibility();
}

function driveModeEnabled(mode) {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById(SYSTEM_TYPE_SELECT_ID));
  const rawValue = (select && select.value) ? select.value : DEFAULT_SYSTEM_TYPE;
  const normalized = rawValue === 'electric' || rawValue === 'hydraulic' ? rawValue : DEFAULT_SYSTEM_TYPE;
  return normalized === mode;
}

function getActiveScenario() {
  if (driveModeEnabled('electric')) return 'electric';
  if (driveModeEnabled('hydraulic')) return 'hydraulic';
  return DEFAULT_SYSTEM_TYPE;
}

function syncDriveModeVisibility() {
  const electricEnabled = driveModeEnabled('electric');
  const hydraulicEnabled = driveModeEnabled('hydraulic');

  document.querySelectorAll('[data-drive-scope]').forEach(el => {
    const scope = el.getAttribute('data-drive-scope');
    if (scope === 'electric') {
      el.classList.toggle('is-hidden', !electricEnabled);
    } else if (scope === 'hydraulic') {
      el.classList.toggle('is-hidden', !hydraulicEnabled);
    }
  });

  updateScenarioOptions('wave_scenario', electricEnabled, hydraulicEnabled);
}

function updateScenarioOptions(selectId, electricEnabled, hydraulicEnabled) {
  const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(selectId));
  if (!selectEl) return;

  let needsChange = false;
  Array.from(selectEl.options).forEach(opt => {
    if (opt.value === 'electric') {
      const disabled = !electricEnabled;
      if (opt.disabled !== disabled) opt.disabled = disabled;
      if (opt.hidden !== disabled) opt.hidden = disabled;
      if (disabled && opt.selected) needsChange = true;
    } else if (opt.value === 'hydraulic') {
      const disabled = !hydraulicEnabled;
      if (opt.disabled !== disabled) opt.disabled = disabled;
      if (opt.hidden !== disabled) opt.hidden = disabled;
      if (disabled && opt.selected) needsChange = true;
    }
  });

  if (needsChange) {
    if (electricEnabled) {
      selectEl.value = 'electric';
    } else if (hydraulicEnabled) {
      selectEl.value = 'hydraulic';
    } else {
      const first = Array.from(selectEl.options).find(opt => !opt.disabled);
      if (first) selectEl.value = first.value;
    }
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// ---- Core compute + render ----
function computeAll() {
  const errBox = /** @type {HTMLElement|null} */ (document.getElementById('err'));
  if (errBox) errBox.textContent = '';

  try {
    const derivedCable = syncDerivedCableLengths();

    const wraps_override_input = read('wraps_override');
    const wraps_per_layer_override = (
      Number.isFinite(wraps_override_input) && wraps_override_input > 0
    ) ? wraps_override_input : undefined;

    const rated_speed_mpm = read('rated_speed_mpm');
    const rated_swl_kgf = read('rated_swl_kgf');
    const system_efficiency = read('system_efficiency');
    updateMinimumSystemHp(rated_speed_mpm, rated_swl_kgf, system_efficiency);

    const payload_kg = read('payload_kg');
    const cable_w_kgpm = read('c_w_kgpm');
    const mbl_kgf = read('mbl_kgf');
    const safety_factor = read('safety_factor');
    updateStrengthOnlyMaxLength(payload_kg, cable_w_kgpm, mbl_kgf, safety_factor);

    const electricEnabled = driveModeEnabled('electric');
    const hydraulicEnabled = driveModeEnabled('hydraulic');

    const model = buildComputationModel({
      cable_dia_mm: read('c_mm'),
      operating_depth_m: derivedCable.maxOperatingDepth ?? read('depth_m'),
      dead_end_m: derivedCable.deadEndLength ?? read('dead_m'),
      core_dia_in: read('core_in'),
      flange_dia_in: read('flange_dia_in'),
      flange_to_flange_in: read('ftf_in'),
      lebus_thk_in: read('lebus_in'),
      packing_factor: read('pack'),
      wraps_per_layer_override,
      payload_kg,
      cable_w_kgpm,
      mbl_kgf,
      safety_factor,
      gr1: read('gr1'),
      gr2: read('gr2'),
      motors: read('motors'),
      electricEnabled,
      hydraulicEnabled,
      motor_max_rpm: read('motor_max_rpm'),
      motor_hp: read('motor_hp'),
      motor_eff: read('motor_eff'),
      motor_tmax: read('motor_tmax'),
      gearbox_max_torque_Nm: read('gearbox_max_torque_Nm'),
      h_strings: read('h_pump_strings'),
      h_emotor_hp: read('h_emotor_hp'),
      h_emotor_eff: read('h_emotor_eff'),
      h_emotor_rpm: read('h_emotor_rpm'),
      h_pump_cc: read('h_pump_cc'),
      h_max_psi: read('h_max_psi'),
      h_hmot_cc: read('h_hmot_cc'),
      h_hmot_rpm_cap: read('h_hmot_rpm_max')
    });

    lastComputedModel = model;

    const wrapsNoteEl = /** @type {HTMLTableCellElement|null} */ (document.getElementById('wraps_note'));
    if (wrapsNoteEl) {
      const calcWraps = model.meta && Number.isFinite(model.meta.wraps_per_layer_calc) ? model.meta.wraps_per_layer_calc : undefined;
      const display = (typeof calcWraps === 'number') ? calcWraps.toFixed(1) : '–';
      wrapsNoteEl.textContent = `Auto-calculated wraps per layer: ${display}.`;
    }

    lastDrumState = { rows: model.rows, summary: model.summary, cfg: model.cfg, meta: model.meta };
    renderDrumVisualization(model.rows, model.summary, model.cfg, model.meta);

    lastElLayer = model.tables.elLayer;
    lastHyLayer = model.tables.hyLayer;
    lastElWraps = model.tables.elWraps;
    lastHyWraps = model.tables.hyWraps;

    const scenarioActive = getActiveScenario();
    lastDepthProfileContext = buildDepthProfileContext({
      scenario: scenarioActive,
      rows: model.rows,
      cfg: model.cfg,
      cable_w_kgpm: model.inputs.cable_w_kgpm,
      gr1: model.inputs.gr1,
      gr2: model.inputs.gr2,
      motors: model.inputs.motors,
      motor_max_rpm: model.inputs.motor_max_rpm,
      motor_tmax: model.inputs.motor_tmax,
      P_per_motor_W: model.inputs.P_per_motor_W,
      denom_mech: model.inputs.denom_mech,
      gear_product: model.inputs.gear_product,
      electricEnabled: model.electricEnabled,
      hydraulicEnabled: model.hydraulicEnabled,
      hydraulic: {
        ...model.hydraulic,
        rpm_flow_per_motor: model.hydraulic.rpm_flow_per_motor_available
      }
    });

    const torqueChecks = renderElectricTables(
      lastElLayer,
      lastElWraps,
      q('tbody_el_layer'),
      q('tbody_el_wraps'),
      model.inputs.gearbox_max_torque_Nm,
      model.inputs.motor_tmax,
      q('el_tau_max_summary'),
      read('rated_swl_kgf'),
      model.summary.full_drum_dia_in,
      model.inputs.motors,
      model.inputs.gr1 * model.inputs.gr2
    );
    updateTorqueCheckMessages(Boolean(torqueChecks?.gearboxCheckFailed), Boolean(torqueChecks?.motorCheckFailed));
    renderHydraulicTables(lastHyLayer, lastHyWraps, q('tbody_hy_layer'), q('tbody_hy_wraps'));

    renderInputSummary();
    renderReport(document.getElementById('report-root'), { ...model, inputState: collectInputState() });
    renderLatexFragments(document.body);
    updateCsvButtonStates();
    redrawPlots();
  } catch (e) {
    console.error(e);
    if (errBox) errBox.textContent = 'ERROR: ' + (e && e.message ? e.message : e);
    clearMinimumSystemHp();
    lastElLayer = lastElWraps = lastHyLayer = lastHyWraps = [];
    lastDrumState = null;
    lastDepthProfileContext = null;
    lastComputedModel = null;
    clearDrumVisualization();
    clearPlots();
    updateTorqueCheckMessages(false, false);
    updateCsvButtonStates();
    renderInputSummary();
    renderReport(document.getElementById('report-root'), null);
    renderLatexFragments(document.body);
  }
}

// ---- Plot redraw helper (uses decoupled plotting modules) ----
function redrawPlots() {
  // Wave contours (optional - skip if controls/SVGs absent)
  const waveScenarioEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('wave_scenario'));
  const waveTminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmin'));
  const waveTmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmax'));
  const waveVminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_vmin'));
  const waveVmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_vmax'));
  const waveTminHeightEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmin_height'));
  const waveTmaxHeightEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmax_height'));
  const waveHminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_hmin'));
  const waveHmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_hmax'));
  const waveSpeedShowSeaStatesEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_speed_show_sea_states'));
  const waveShowSeaStatesEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_show_sea_states'));
  const waveShowBreakingLimitEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_show_breaking_limit'));
  const waveShowPmCurveEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_show_pm_curve'));
  const waveShowJonswapCurveEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_show_jonswap_curve'));
  const waveShowSmbCurveEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_show_smb_curve'));
  const waveSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg'));
  const waveSvgHeight = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg_height'));

  const parseInput = (el) => {
    if (!el) return NaN;
    return parseFloat((el.value || '').replace(',', '.'));
  };

  if (waveScenarioEl && waveTminEl && waveTmaxEl && waveHmaxEl && waveSvg && waveSvgHeight) {
    const TminVal = parseInput(waveTminEl);
    const TmaxVal = parseInput(waveTmaxEl);
    const speedMinVal = parseInput(waveVminEl);
    const speedMaxVal = parseInput(waveVmaxEl);
    const heightTminVal = parseInput(waveTminHeightEl);
    const heightTmaxVal = parseInput(waveTmaxHeightEl);
    const HminVal = parseInput(waveHminEl);
    const HmaxVal = parseInput(waveHmaxEl);
    const baseWaveOpts = {
      scenario: waveScenarioEl.value || 'electric',
      elLayers: lastElLayer,
      hyLayers: lastHyLayer
    };
    drawWaveContours(waveSvg, {
      ...baseWaveOpts,
      Tmin: Number.isFinite(TminVal) ? TminVal : 4,
      Tmax: Number.isFinite(TmaxVal) ? TmaxVal : 20,
      speedMin: Number.isFinite(speedMinVal) ? speedMinVal : undefined,
      speedMax: Number.isFinite(speedMaxVal) ? speedMaxVal : undefined,
      showSeaStateOverlay: Boolean(waveSpeedShowSeaStatesEl?.checked)
    });
    drawWaveHeightContours(waveSvgHeight, {
      ...baseWaveOpts,
      Tmin: Number.isFinite(heightTminVal) ? heightTminVal : 4,
      Tmax: Number.isFinite(heightTmaxVal) ? heightTmaxVal : 20,
      Hmin: Number.isFinite(HminVal) ? HminVal : undefined,
      Hmax: Number.isFinite(HmaxVal) ? HmaxVal : 6,
      showSeaStateOverlay: Boolean(waveShowSeaStatesEl?.checked),
      showBreakingLimit: Boolean(waveShowBreakingLimitEl?.checked),
      showPmCurve: Boolean(waveShowPmCurveEl?.checked),
      showJonswapCurve: Boolean(waveShowJonswapCurveEl?.checked),
      showSmbCurve: Boolean(waveShowSmbCurveEl?.checked)
    });
  }

  // Depth profiles (optional - skip if controls/SVGs absent)
  const depthSpeedSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_svg'));
  const depthTensionSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_tension_svg'));
  const depthXminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmin'));
  const depthXmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmax'));
  const depthSpeedYminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymin'));
  const depthSpeedYmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymax'));
  const depthXminTensionEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmin_tension'));
  const depthXmaxTensionEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmax_tension'));
  const depthTensionYminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_tension_ymin'));
  const depthTensionYmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_tension_ymax'));

  if (depthSpeedSvg && depthTensionSvg) {
    const ratedSpeedMpmRaw = read('rated_speed_mpm');
    const ratedSpeedMs = Number.isFinite(ratedSpeedMpmRaw) ? ratedSpeedMpmRaw / 60 : null;
    const operatingDepthRaw = read('depth_m');
    const operatingDepth = Number.isFinite(operatingDepthRaw) ? operatingDepthRaw : null;
    const ratedSwlRaw = read('rated_swl_kgf');
    const ratedSwl = Number.isFinite(ratedSwlRaw) ? ratedSwlRaw : null;
    const payloadRaw = read('payload_kg');
    const payloadVal = Number.isFinite(payloadRaw) ? Math.max(0, payloadRaw) : null;
    const activeScenario = getActiveScenario();
    let speedPrimaryLabel = null;
    /** @type {SpeedProfileSegments[]} */
    let flowSpeedProfiles = [];
    if (Number.isFinite(payloadVal)) {
      speedPrimaryLabel = formatPayloadLabel(payloadVal);
      if (lastDepthProfileContext && lastDepthProfileContext.scenario === activeScenario) {
        const accentColor = readAccentColor();

        if (activeScenario === 'hydraulic') {
          const segments = computeDepthSpeedSegmentsForPayload(payloadVal, lastDepthProfileContext, { mode: 'flow' });
          if (segments.length) {
            flowSpeedProfiles = [{
              label: `Flow limit — ${formatPayloadInlineLabel(payloadVal)}`,
              inlineLabel: formatPayloadInlineLabel(payloadVal),
              inlineLabelColor: accentColor,
              color: accentColor,
              strokeWidth: 3.2,
              legendStrokeWidth: 3.2,
              strokeDasharray: '6 4',
              legendStrokeDasharray: '6 4',
              segments
            }];
          }
        }

      }
    }
    const depthXminVal = parseInput(depthXminEl);
    const depthXmaxVal = parseInput(depthXmaxEl);
    const depthSpeedMinVal = parseInput(depthSpeedYminEl);
    const depthSpeedMaxVal = parseInput(depthSpeedYmaxEl);
    const depthXminTensionVal = parseInput(depthXminTensionEl);
    const depthXmaxTensionVal = parseInput(depthXmaxTensionEl);
    const depthTensionMinVal = parseInput(depthTensionYminEl);
    const depthTensionMaxVal = parseInput(depthTensionYmaxEl);
    const hydraulicHpAvailable = (activeScenario === 'hydraulic')
      ? (read('h_emotor_hp') * read('h_pump_strings'))
      : null;

    drawDepthProfiles(depthSpeedSvg, depthTensionSvg, {
      scenario: activeScenario,       // 'electric' | 'hydraulic'
      elWraps: lastElWraps,
      hyWraps: lastHyWraps,
      payload_kg: payloadRaw,
      cable_w_kgpm: read('c_w_kgpm'),
      dead_end_m: read('dead_m'),
      rated_speed_ms: ratedSpeedMs,
      operating_depth_m: operatingDepth,
      rated_swl_kgf: ratedSwl,
      hydraulic_hp_available: Number.isFinite(hydraulicHpAvailable) ? hydraulicHpAvailable : null,
      depth_xmin: Number.isFinite(depthXminVal) ? depthXminVal : undefined,
      depth_xmax: Number.isFinite(depthXmaxVal) ? depthXmaxVal : undefined,
      speed_ymin: Number.isFinite(depthSpeedMinVal) ? depthSpeedMinVal : undefined,
      speed_ymax: Number.isFinite(depthSpeedMaxVal) ? depthSpeedMaxVal : undefined,
      tension_depth_xmin: Number.isFinite(depthXminTensionVal) ? depthXminTensionVal : undefined,
      tension_depth_xmax: Number.isFinite(depthXmaxTensionVal) ? depthXmaxTensionVal : undefined,
      tension_ymin: Number.isFinite(depthTensionMinVal) ? depthTensionMinVal : undefined,
      tension_ymax: Number.isFinite(depthTensionMaxVal) ? depthTensionMaxVal : undefined,
      speed_primary_label: speedPrimaryLabel,
      speed_extra_profiles: flowSpeedProfiles
    });

  }

  const rpmTorqueSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('hyd_rpm_torque_svg'));
  const hydTorqueXminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd_torque_xmin'));
  const hydTorqueXmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd_torque_xmax'));
  const hydRpmYminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd_rpm_ymin'));
  const hydRpmYmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('hyd_rpm_ymax'));
  if (rpmTorqueSvg) {
    const torqueMinVal = parseInput(hydTorqueXminEl);
    const torqueMaxVal = parseInput(hydTorqueXmaxEl);
    const rpmMinVal = parseInput(hydRpmYminEl);
    const rpmMaxVal = parseInput(hydRpmYmaxEl);
    drawHydraulicRpmTorque(rpmTorqueSvg, {
      wraps: lastHyWraps,
      torqueMin: Number.isFinite(torqueMinVal) ? torqueMinVal : undefined,
      torqueMax: Number.isFinite(torqueMaxVal) ? torqueMaxVal : undefined,
      rpmMin: Number.isFinite(rpmMinVal) ? rpmMinVal : undefined,
      rpmMax: Number.isFinite(rpmMaxVal) ? rpmMaxVal : undefined
    });
  }
}

function clearPlots() {
  const svgs = [
    q('wave_svg'),
    q('wave_svg_height'),
    q('depth_speed_svg'),
    q('depth_tension_svg'),
    q('hyd_rpm_torque_svg')
  ];
  svgs.forEach(svg => { if (!svg) return; while (svg.firstChild) svg.removeChild(svg.firstChild); });
}
