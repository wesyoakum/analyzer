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

import { calcLayers } from './layer-engine.mjs';

import {
  rowsToElectricLayer, projectElectricWraps, renderElectricTables
} from './electric.mjs';

import {
  rowsToHydraulicLayer, projectHydraulicWraps, renderHydraulicTables
} from './hydraulic.mjs';

import { drawWaveContours, drawWaveHeightContours } from './plots/wave-contours.mjs';
import { drawDepthProfiles, drawStandaloneSpeedProfiles } from './plots/depth-profiles.mjs';
import { drawHydraulicRpmTorque } from './plots/rpm-torque.mjs';
import { setupComponentSelectors } from './component-selectors.mjs';
import { renderDrumVisualization, clearDrumVisualization } from './drum-visual.mjs';
import { renderLatexFragments } from './katex-renderer.mjs';

// ---- App state for plots/tables ----
let lastElLayer = [], lastElWraps = [];
let lastHyLayer = [], lastHyWraps = [];
/** @type {{ rows: any, summary: any, cfg: any, meta: any } | null} */
let lastDrumState = null;
/** @type {DepthProfileContext|null} */
let lastDepthProfileContext = null;

const EXTRA_SPEED_PROFILE_COLORS = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02'];

function readAccentColor() {
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const val = window.getComputedStyle(document.documentElement).getPropertyValue('--accent');
    if (val) return val.trim();
  }
  return '#2c56a3';
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

function buildPayloadValues(basePayloadKg) {
  if (!Number.isFinite(basePayloadKg)) return [];
  const values = [];
  const seen = new Set();
  const pushVal = (val) => {
    if (!Number.isFinite(val)) return;
    const rounded = +Math.max(0, val).toFixed(3);
    if (seen.has(rounded)) return;
    seen.add(rounded);
    values.push(rounded);
  };

  let current = Math.max(0, basePayloadKg);
  pushVal(current);
  while (current > 0) {
    current -= 1000;
    if (current < 0) current = 0;
    pushVal(current);
    if (current === 0) break;
  }
  if (!seen.has(0)) pushVal(0);
  return values;
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
      'max_tension_required_kgf', 'tau_avail_kNm', 'max_motor_torque_Nm',
      'motor_rpm_at_start', 'line_speed_at_start_mpm',
      'tension_theoretical_start_kgf', 'tension_required_start_kgf', 'avail_tension_kgf'
    ],
    header: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'max_tension_theoretical_kgf',
      'max_tension_required_kgf', 'tau_avail_kNm', 'max_motor_torque_Nm',
      'motor_rpm_at_start', 'line_speed_at_start_mpm',
      'tension_theoretical_start_kgf', 'tension_required_start_kgf', 'avail_tension_kgf'
    ],
    getRows: () => lastElLayer
  },
  csv_el_wraps: {
    filename: () => 'electric-wraps.csv',
    columns: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'tau_avail_kNm', 'motor_torque_Nm', 'motor_rpm',
      'line_speed_mpm', 'avail_tension_kgf'
    ],
    header: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'tau_avail_kNm', 'motor_torque_Nm', 'motor_rpm',
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

function applyProjectState(state) {
  if (!state || typeof state !== 'object') return;
  Object.entries(state).forEach(([id, value]) => {
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
}

async function setupProjectManager() {
  const nameInput = /** @type {HTMLInputElement|null} */ (document.getElementById('project_name'));
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('project_select'));
  const saveBtn = document.getElementById('save_project');
  const loadBtn = document.getElementById('load_project');
  const deleteBtn = document.getElementById('delete_project');
  if (!nameInput || !select || !saveBtn || !loadBtn || !deleteBtn) return;

  const LOCAL_PROJECTS_KEY = 'analyzer.projects.v1';

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
      return parsed.filter(project => project && typeof project === 'object' && project.id && project.name);
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

  const saveLocalProject = ({ id, name, state }) => {
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
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      name,
      state,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    projects.push(created);
    writeLocalProjects(projects);
    return created;
  };

  const renderProjects = (projects) => {
    const currentSelection = select.value;
    while (select.options.length > 1) {
      select.remove(1);
    }
    projects.forEach(project => {
      if (!project || typeof project !== 'object' || !project.id || !project.name) return;
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
    select.value = projects.some(project => project.id === currentSelection) ? currentSelection : '';
  };

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        const localProjects = readLocalProjects();
        renderProjects(localProjects);
        return localProjects;
      }
      const body = await response.json();
      const projects = Array.isArray(body?.projects) ? body.projects : [];
      renderProjects(projects);
      return projects;
    } catch (err) {
      const localProjects = readLocalProjects();
      renderProjects(localProjects);
      return localProjects;
    }
  };

  saveBtn.addEventListener('click', async () => {
    const selectedId = select.value || undefined;
    const name = nameInput.value.trim();
    if (!name) {
      window.alert('Enter a project name before saving.');
      return;
    }

    const payload = {
      ...(selectedId ? { id: selectedId } : {}),
      name,
      state: collectInputState()
    };

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const saved = saveLocalProject(payload);
        await loadProjects();
        select.value = saved.id;
        nameInput.value = saved.name || name;
        return;
      }

      const body = await response.json();
      const project = body?.project;
      if (!project?.id) {
        window.alert('Project saved but response was invalid.');
        return;
      }

      await loadProjects();
      select.value = project.id;
      nameInput.value = project.name || name;
    } catch (err) {
      const saved = saveLocalProject(payload);
      await loadProjects();
      select.value = saved.id;
      nameInput.value = saved.name || name;
    }
  });

  loadBtn.addEventListener('click', async () => {
    const selectedId = select.value;
    if (!selectedId) {
      window.alert('Select a saved project to load.');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedId)}`);
      if (!response.ok) {
        const localProject = readLocalProjects().find(project => project.id === selectedId);
        if (!localProject || typeof localProject.state !== 'object' || localProject.state === null) {
          window.alert('Project not found.');
          return;
        }
        applyProjectState(localProject.state);
        nameInput.value = localProject.name || '';
        computeAll();
        return;
      }
      const body = await response.json();
      const project = body?.project;
      if (!project || typeof project.state !== 'object' || project.state === null) {
        window.alert('Saved project is malformed.');
        return;
      }
      applyProjectState(project.state);
      nameInput.value = project.name || '';
      computeAll();
    } catch (err) {
      const localProject = readLocalProjects().find(project => project.id === selectedId);
      if (!localProject || typeof localProject.state !== 'object' || localProject.state === null) {
        window.alert('Unable to load project.');
        return;
      }
      applyProjectState(localProject.state);
      nameInput.value = localProject.name || '';
      computeAll();
    }
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
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedId)}`, {
        method: 'DELETE'
      });
      if (!response.ok && response.status !== 404) {
        const projects = readLocalProjects().filter(project => project.id !== selectedId);
        writeLocalProjects(projects);
        await loadProjects();
        nameInput.value = '';
        return;
      }
      await loadProjects();
      nameInput.value = '';
    } catch (err) {
      const projects = readLocalProjects().filter(project => project.id !== selectedId);
      writeLocalProjects(projects);
      await loadProjects();
      nameInput.value = '';
    }
  });

  select.addEventListener('change', () => {
    const option = select.selectedOptions?.[0];
    if (option?.value) {
      nameInput.value = option.textContent || '';
    }
  });

  await loadProjects();
}

// ---- Wire up events once DOM is ready ----
document.addEventListener('DOMContentLoaded', () => {
  setupInputPersistence();

  setupComponentSelectors();

  setupCollapsibleToggles();

  setupDriveModeControls();

  setupCsvDownloads();

  setupPlotResizeToggles();

  setupWrapTableToggleLabels();

  setupPlotSettingsDialogs();

  configureSectionFourContent();

  setupProjectManager();

  setupAutoRecompute();

  updateBuildIndicator();

  setupTabs();

  setupPdfExport();

  renderDocumentMath();

  document.querySelectorAll('.param-label').forEach(label => {
    const code = label.dataset.code;
    if (code) {
      label.setAttribute('title', code);
    }
  });

  // Wave/depth/hydraulic plot controls
  ['wave_scenario', 'wave_tmin', 'wave_tmax', 'wave_vmin', 'wave_vmax', 'wave_tmin_height', 'wave_tmax_height', 'wave_hmin', 'wave_hmax',
    'depth_xmin', 'depth_xmax', 'depth_speed_ymin', 'depth_speed_ymax',
    'depth_xmin_power', 'depth_xmax_power', 'depth_speed_ymin_power', 'depth_speed_ymax_power',
    'depth_xmin_tension', 'depth_xmax_tension', 'depth_tension_ymin', 'depth_tension_ymax',
    'hyd_torque_xmin', 'hyd_torque_xmax', 'hyd_rpm_ymin', 'hyd_rpm_ymax']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => redrawPlots());
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

  indicator.textContent = formatGeneratedStamp(new Date());
}

/**
 * @param {Date} date
 */
function formatGeneratedStamp(date) {
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
  return `GENERATED ${map.year}-${map.month}-${map.day}, ${map.hour}:${map.minute}:${map.second} ${zone}`;
}

function setupTabs() {
  /** @type {Array<{tab: HTMLElement, panel: HTMLElement}>} */
  const tabEntries = [];
  document.querySelectorAll('[role="tab"]').forEach(tabEl => {
    const controls = tabEl.getAttribute('aria-controls');
    const panel = controls ? /** @type {HTMLElement|null} */ (document.getElementById(controls)) : null;
    if (!panel) return;
    tabEntries.push({ tab: /** @type {HTMLElement} */ (tabEl), panel });
  });

  if (!tabEntries.length) return;

  /** @param {HTMLElement} el */
  const isDisabled = el => el.hasAttribute('disabled');

  const enabledTabs = () => tabEntries.map(entry => entry.tab).filter(tab => !isDisabled(tab));

  const activate = (nextTab, { setFocus = false } = {}) => {
    tabEntries.forEach(({ tab, panel }) => {
      const isActive = tab === nextTab;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;

      panel.classList.toggle('active', isActive);
      panel.toggleAttribute('hidden', !isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      panel.tabIndex = isActive ? 0 : -1;
    });

    if (setFocus) {
      nextTab.focus();
    }
  };

  const focusRelative = (currentTab, delta) => {
    const tabs = enabledTabs();
    if (!tabs.length) return;
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    activate(tabs[nextIndex], { setFocus: true });
  };

  const focusEdge = (first = true) => {
    const tabs = enabledTabs();
    if (!tabs.length) return;
    activate(first ? tabs[0] : tabs[tabs.length - 1], { setFocus: true });
  };

  tabEntries.forEach(({ tab }) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', evt => {
      switch (evt.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          evt.preventDefault();
          focusRelative(tab, -1);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          evt.preventDefault();
          focusRelative(tab, 1);
          break;
        case 'Home':
          evt.preventDefault();
          focusEdge(true);
          break;
        case 'End':
          evt.preventDefault();
          focusEdge(false);
          break;
        default:
          break;
      }
    });
  });

  const initialTab = tabEntries
    .map(entry => entry.tab)
    .find(tab => tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true');

  activate(initialTab || tabEntries[0].tab);
}

function setupPdfExport() {
  const exportBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('export_pdf'));
  if (!exportBtn) return;

  /** @type {Array<() => void>} */
  let printCleanupSteps = [];

  const preparePrintLayout = () => {
    if (printCleanupSteps.length) return;

    const cleanupSteps = [];

    let figureIndex = 1;
    const figureTargets = Array.from(document.querySelectorAll('#panel-performance .plot-panel, #panel-results .drum-visual'));
    figureTargets.forEach(target => {
      if (!(target instanceof HTMLElement)) return;
      const label = document.createElement('p');
      label.className = 'pdf-item-label pdf-item-label--figure';
      label.textContent = `Figure ${figureIndex}`;
      figureIndex += 1;
      target.insertAdjacentElement('afterend', label);
      cleanupSteps.push(() => label.remove());
    });

    let tableIndex = 1;
    const tableTargets = Array.from(document.querySelectorAll('#panel-results table, #panel-instructions table'));
    tableTargets.forEach(table => {
      if (!(table instanceof HTMLTableElement)) return;
      if (table.closest('.instructions-only')) return;
      const label = document.createElement('p');
      const tableNumber = tableIndex;
      label.className = 'pdf-item-label pdf-item-label--table';
      label.textContent = `Table ${tableNumber}`;
      tableIndex += 1;
      table.insertAdjacentElement('beforebegin', label);
      cleanupSteps.push(() => label.remove());

      if (tableNumber === 5) {
        table.classList.add('pdf-allow-split');
        cleanupSteps.push(() => table.classList.remove('pdf-allow-split'));
        const card = table.closest('.card');
        if (card instanceof HTMLElement) {
          card.classList.add('pdf-allow-split');
          cleanupSteps.push(() => card.classList.remove('pdf-allow-split'));
        }
      }
    });

    // Allow lightweight inline page-break markers in editable report text.
    const marker = '<< Add Page Break Here>>';
    const markerNodes = Array.from(document.querySelectorAll('.sheet p, .sheet div, .sheet span'));
    markerNodes.forEach(node => {
      if (!node.textContent || !node.textContent.includes(marker)) return;

      const originalText = node.textContent;
      node.textContent = originalText.replaceAll(marker, '').trim();

      const pageBreak = document.createElement('div');
      pageBreak.className = 'pdf-page-break';
      pageBreak.setAttribute('aria-hidden', 'true');
      node.insertAdjacentElement('afterend', pageBreak);

      cleanupSteps.push(() => {
        node.textContent = originalText;
        pageBreak.remove();
      });
    });

    const section34Card = document.querySelector('#panel-results .card[data-drive-scope="hydraulic"]');
    if (section34Card instanceof HTMLElement) {
      section34Card.classList.add('pdf-break-before');
      cleanupSteps.push(() => section34Card.classList.remove('pdf-break-before'));
    }

    const equationsCard = /** @type {HTMLElement|null} */ (document.getElementById('hydraulic-core-equations'));
    if (equationsCard) {
      const headings = Array.from(equationsCard.querySelectorAll('h3, h4'));
      const shouldHide = heading => /^\s*[CD]\)/.test((heading.textContent || '').trim());

      headings.forEach(heading => {
        if (!(heading instanceof HTMLElement) || !shouldHide(heading)) return;
        heading.classList.add('pdf-hide-temporary');
        cleanupSteps.push(() => heading.classList.remove('pdf-hide-temporary'));

        let sib = heading.nextElementSibling;
        while (sib && !(sib.matches('h3') || sib.matches('h4'))) {
          sib.classList.add('pdf-hide-temporary');
          const node = sib;
          cleanupSteps.push(() => node.classList.remove('pdf-hide-temporary'));
          sib = sib.nextElementSibling;
        }
      });
    }

    document.body.classList.add('pdf-export-mode');

    cleanupSteps.push(() => {
      document.body.classList.remove('pdf-export-mode');
    });

    printCleanupSteps = cleanupSteps;
  };

  const cleanupPrintLayout = () => {
    printCleanupSteps.forEach(fn => fn());
    printCleanupSteps = [];
  };

  exportBtn.addEventListener('click', () => {
    computeAll();
    preparePrintLayout();
    window.print();
  });

  window.addEventListener('beforeprint', preparePrintLayout);
  window.addEventListener('afterprint', cleanupPrintLayout);
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
    { selector: '#sidebar-inputs .card[data-drive-scope]', headerSelector: '.section-title', defaultExpanded: true },
    { selector: '#sidebar-inputs .input-section', headerSelector: '.input-section__title', defaultExpanded: true },
    { selector: '#sidebar-inputs .input-subsection', headerSelector: '.input-subsection__title', defaultExpanded: true },
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

function setupPlotResizeToggles() {
  const toggles = document.querySelectorAll('[data-plot-pair-toggle]');
  toggles.forEach(btn => {
    const pair = btn.closest('[data-plot-pair]');
    if (!pair) return;

    const setState = (expanded) => {
      pair.classList.toggle('is-expanded', expanded);
      btn.textContent = expanded ? '[-]' : '[+]';
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.setAttribute('aria-label', expanded ? 'Collapse plots to two columns' : 'Expand plots to full width');
    };

    setState(pair.classList.contains('is-expanded'));

    btn.addEventListener('click', () => {
      const next = !pair.classList.contains('is-expanded');
      setState(next);
    });
  });
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
    // Geometry & load inputs
    const wraps_override_input = read('wraps_override');
    const wraps_per_layer_override = (
      Number.isFinite(wraps_override_input) && wraps_override_input > 0
    ) ? wraps_override_input : undefined;

    const cfg = {
      cable_dia_mm: read('c_mm'),
      operating_depth_m: read('depth_m'),
      dead_end_m: read('dead_m'),
      core_dia_in: read('core_in'),
      flange_dia_in: read('flange_dia_in'),
      flange_to_flange_in: read('ftf_in'),
      lebus_thk_in: read('lebus_in'),
      packing_factor: read('pack'),
      wraps_per_layer_override
    };
    const payload_kg = read('payload_kg');
    const cable_w_kgpm = read('c_w_kgpm');

    const rated_speed_mpm = read('rated_speed_mpm');
    const rated_swl_kgf = read('rated_swl_kgf');
    const system_efficiency = read('system_efficiency');

    updateMinimumSystemHp(rated_speed_mpm, rated_swl_kgf, system_efficiency);

    const positiveOr = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

    // Shared drivetrain
    const gr1 = positiveOr(read('gr1'), 1);
    const gr2 = positiveOr(read('gr2'), 1);
    const motors = positiveOr(read('motors'), 1);
    const denom_mech = gr1 * gr2 * motors;
    const gear_product = Math.max(gr1, 1e-9) * Math.max(gr2, 1e-9);

    const electricEnabled = driveModeEnabled('electric');
    const hydraulicEnabled = driveModeEnabled('hydraulic');

    // Electric inputs
    const motor_max_rpm = read('motor_max_rpm');
    const motor_hp = positiveOr(read('motor_hp'), 0);
    const motor_eff = positiveOr(read('motor_eff'), 1);
    const motor_tmax = read('motor_tmax');
    const gearbox_max_torque_Nm = read('gearbox_max_torque_Nm');
    const P_per_motor_W = motor_hp * motor_eff * W_PER_HP;

    // Hydraulic inputs
    const h_strings = positiveOr(read('h_pump_strings'), 0);
    const h_emotor_hp = positiveOr(read('h_emotor_hp'), 0);
    const h_emotor_eff = positiveOr(read('h_emotor_eff'), 0); // electro-hydraulic efficiency
    const h_emotor_rpm = positiveOr(read('h_emotor_rpm'), 0);
    const h_pump_cc = positiveOr(read('h_pump_cc'), 0);
    const h_max_psi = positiveOr(read('h_max_psi'), 0);
    const h_hmot_cc = positiveOr(read('h_hmot_cc'), 0);
    const h_hmot_rpm_cap = positiveOr(read('h_hmot_rpm_max'), Infinity);

    // Usable hydraulic hp & flow from pump strings
    const hp_str_usable = h_emotor_hp * h_emotor_eff;
    const hp_tot_usable = hp_str_usable * h_strings;
    const q_str_gpm = gpm_from_cc_rev_and_rpm(h_pump_cc, h_emotor_rpm);
    const q_tot_gpm = q_str_gpm * h_strings;
    const rpm_flow_per_motor_available = Math.min(
      Number.isFinite(h_hmot_rpm_cap) && h_hmot_rpm_cap > 0 ? h_hmot_rpm_cap : Number.POSITIVE_INFINITY,
      rpm_from_gpm_and_disp(q_tot_gpm / Math.max(motors, 1), h_hmot_cc)
    );

    // Max-pressure torque per hydraulic motor and at drum (pressure-limited)
    const dP_Pa = h_max_psi * PSI_TO_PA;
    const torque_per_hmotor_maxP = torque_per_motor_from_pressure_Pa(dP_Pa, h_hmot_cc); // N·m per motor at max P
    const torque_at_drum_maxP_factor = Math.max(gr1, 1) * Math.max(gr2, 1) * Math.max(motors, 1);

    // Generate wraps from geometry
    const { rows, summary, meta } = calcLayers(cfg);

    const wrapsNoteEl = /** @type {HTMLTableCellElement|null} */ (document.getElementById('wraps_note'));
    if (wrapsNoteEl) {
      const calcWraps = meta && Number.isFinite(meta.wraps_per_layer_calc) ? meta.wraps_per_layer_calc : undefined;
      const display = (typeof calcWraps === 'number') ? calcWraps.toFixed(1) : '–';
      wrapsNoteEl.textContent = `Auto-calculated wraps per layer: ${display}.`;
    }

    // Per-wrap calculations (electric + hydraulic)
    for (const r of rows) {
      // Base tension and torque at drum
      const theoretical_tension = tension_kgf(r.deployed_len_m, payload_kg, cable_w_kgpm);
      const required_tension = +(theoretical_tension).toFixed(1);
      r.tension_theoretical_kgf = theoretical_tension;
      r.tension_kgf = required_tension;
      const tension_N = required_tension * G;
      const radius_m = (r.layer_dia_in * M_PER_IN) / 2;
      const drum_T = tension_N * radius_m;
      const motors_safe = Math.max(motors, 1);
      const gear_product_safe = Math.max(gear_product, 1e-9);
      const torque_per_hmotor_required = drum_T / (gear_product_safe * motors_safe);
      const drum_torque_required = torque_per_hmotor_required * gear_product_safe * motors_safe;
      r.torque_Nm = +drum_torque_required.toFixed(1);

      // ----- ELECTRIC per wrap -----
      if (electricEnabled) {
        const motorTorque_e = r.torque_Nm / (denom_mech || 1);
        r.motor_torque_Nm = +motorTorque_e.toFixed(2);

        // RPM limited by available power per motor and capped by motor max rpm
        let rpm_power_e = 0;
        if (P_per_motor_W > 0 && motorTorque_e > 0) {
          rpm_power_e = (P_per_motor_W / motorTorque_e) * 60 / (2 * Math.PI);
        } else if (P_per_motor_W > 0 && motorTorque_e === 0) {
          rpm_power_e = Number.POSITIVE_INFINITY;
        } else {
          rpm_power_e = 0;
        }
        const rpm_capped_e = Math.min(Number.isFinite(motor_max_rpm) ? motor_max_rpm : Infinity, rpm_power_e);
        r.motor_rpm = +((Number.isFinite(rpm_capped_e) ? rpm_capped_e : 0)).toFixed(1);

        // Line speed at drum
        r.line_speed_mpm = +line_speed_mpm_from_motor_rpm(r.motor_rpm, gr1, gr2, r.layer_dia_in).toFixed(2);

        // Available line tension from motor torque cap
        r.avail_tension_kgf = elec_available_tension_kgf(motor_tmax, gr1, gr2, motors, radius_m);
      } else {
        r.motor_torque_Nm = 0;
        r.motor_rpm = 0;
        r.line_speed_mpm = 0;
        r.avail_tension_kgf = 0;
      }

      // ----- HYDRAULIC per wrap -----
      if (hydraulicEnabled) {
        // Pressure-limited drum torque and available tension
        const drum_T_pressure_max = torque_per_hmotor_maxP * torque_at_drum_maxP_factor; // N·m at drum
        r.hyd_drum_torque_maxP_Nm = +drum_T_pressure_max.toFixed(2);
        const hyd_avail_tension_N = drum_T_pressure_max / Math.max(radius_m, 1e-12);
        r.hyd_avail_tension_kgf = +(hyd_avail_tension_N / G).toFixed(1);

        const D_m = r.layer_dia_in * M_PER_IN;
        const safe_drum_circumference = Math.max(Math.PI * Math.max(D_m, 1e-9), 1e-9);

        // Pressure required for current torque (per motor)
        const torque_per_hmotor = torque_per_hmotor_required;
        let P_req_psi = psi_from_torque_and_disp_Nm_cc(torque_per_hmotor, h_hmot_cc);
        if (!Number.isFinite(P_req_psi) || P_req_psi < 0) P_req_psi = 0;

        // Flow-limited speed
        const rpm_flow_per_motor = Math.min(
          h_hmot_rpm_cap,
          rpm_from_gpm_and_disp(q_tot_gpm / Math.max(motors, 1), h_hmot_cc)
        );
        const speed_flow_mpm = line_speed_mpm_from_motor_rpm(rpm_flow_per_motor, gr1, gr2, r.layer_dia_in);
        const rpm_flow_clean = Number.isFinite(rpm_flow_per_motor) && rpm_flow_per_motor > 0 ? rpm_flow_per_motor : 0;
        const rpm_flow_drum = rpm_flow_clean / gear_product_safe;

        // Power-limited speed (cap pressure at max if P_req exceeds max)
        const P_power_psi = (P_req_psi > 0) ? Math.min(P_req_psi, h_max_psi) : 0;
        const hp_elec_in_total = h_emotor_hp * h_strings;
        const eff_total = h_emotor_eff;

        let speed_power_mpm = 0;
        if (hp_elec_in_total > 0 && eff_total > 0 && theoretical_tension > 0) {
          const tension_theoretical_N = theoretical_tension * G;
          if (tension_theoretical_N > 0) {
            const power_available_W = hp_elec_in_total * eff_total * W_PER_HP;
            const speed_power_mps = power_available_W / tension_theoretical_N;
            speed_power_mpm = speed_power_mps * 60;
          }
        }
        if (!Number.isFinite(speed_power_mpm) || speed_power_mpm < 0) speed_power_mpm = 0;
        const rpm_power_drum = Number.isFinite(speed_power_mpm) && speed_power_mpm > 0
          ? speed_power_mpm / safe_drum_circumference
          : Number.isFinite(speed_power_mpm) && speed_power_mpm === 0
            ? 0
            : NaN;

        let speed_avail_mpm = Math.min(speed_power_mpm, speed_flow_mpm);
        if (!Number.isFinite(speed_avail_mpm) || speed_avail_mpm < 0) speed_avail_mpm = 0;
        const rpm_available_drum = Number.isFinite(speed_avail_mpm)
          ? speed_avail_mpm / safe_drum_circumference
          : NaN;

        let hp_used_at_available = 0;
        if (speed_avail_mpm > 0 && P_power_psi > 0) {
          // Power used at the actual available speed
          const drum_rpm_needed = speed_avail_mpm / Math.max(Math.PI * Math.max(D_m, 1e-9), 1e-9);
          const motor_rpm_needed = drum_rpm_needed * (Math.max(gr1, 1) * Math.max(gr2, 1));
          const gpm_per_motor_needed = (motor_rpm_needed * h_hmot_cc) / CC_PER_GAL;
          const gpm_total_needed = Math.max(motors, 1) * gpm_per_motor_needed;
          const gpm_used = Math.min(gpm_total_needed, q_tot_gpm);
          hp_used_at_available = hp_from_psi_and_gpm(P_power_psi, gpm_used);
          if (hp_used_at_available > hp_tot_usable) hp_used_at_available = hp_tot_usable;
        }

        r.hyd_P_required_psi = Math.round(P_req_psi);
        r.hyd_speed_power_mpm = +speed_power_mpm.toFixed(2);
        r.hyd_speed_flow_mpm = +speed_flow_mpm.toFixed(2);
        r.hyd_speed_available_mpm = +speed_avail_mpm.toFixed(2);
        r.hyd_hp_used_at_available = +hp_used_at_available.toFixed(2);
        r.hyd_elec_input_hp_used = +((h_emotor_eff > 0 ? r.hyd_hp_used_at_available / h_emotor_eff : 0)).toFixed(2);
        r.hyd_drum_rpm_flow = Number.isFinite(rpm_flow_drum)
          ? +Math.max(0, rpm_flow_drum).toFixed(1)
          : 0;
        r.hyd_drum_rpm_power = Number.isFinite(rpm_power_drum)
          ? +Math.max(0, rpm_power_drum).toFixed(1)
          : null;
        r.hyd_drum_rpm_available = Number.isFinite(rpm_available_drum)
          ? +Math.max(0, rpm_available_drum).toFixed(1)
          : 0;
      } else {
        r.hyd_drum_torque_maxP_Nm = 0;
        r.hyd_avail_tension_kgf = 0;
        r.hyd_P_required_psi = 0;
        r.hyd_speed_power_mpm = 0;
        r.hyd_speed_flow_mpm = 0;
        r.hyd_speed_available_mpm = 0;
        r.hyd_hp_used_at_available = 0;
        r.hyd_elec_input_hp_used = 0;
        r.hyd_drum_rpm_flow = 0;
        r.hyd_drum_rpm_power = 0;
        r.hyd_drum_rpm_available = 0;
      }
    }

    // ---- Drum visualization ----
    lastDrumState = { rows, summary, cfg, meta };
    renderDrumVisualization(rows, summary, cfg, meta);

    // ---- Aggregate into per-layer tables ----
    lastElLayer = electricEnabled ? rowsToElectricLayer(rows, payload_kg, cable_w_kgpm, gr1, gr2, motors) : [];
    lastHyLayer = hydraulicEnabled ? rowsToHydraulicLayer(rows) : [];
    lastElWraps = electricEnabled ? projectElectricWraps(rows) : [];
    lastHyWraps = hydraulicEnabled ? projectHydraulicWraps(rows) : [];

    const scenarioActive = getActiveScenario();
    lastDepthProfileContext = buildDepthProfileContext({
      scenario: scenarioActive,
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
      hydraulic: {
        h_strings,
        h_emotor_hp,
        h_emotor_eff,
        h_emotor_rpm,
        h_pump_cc,
        h_max_psi,
        h_hmot_cc,
        h_hmot_rpm_cap,
        torque_per_hmotor_maxP,
        torque_at_drum_maxP_factor,
        q_tot_gpm,
        rpm_flow_per_motor: rpm_flow_per_motor_available
      }
    });

    // ---- Render tables ----
    renderElectricTables(
      lastElLayer,
      lastElWraps,
      q('tbody_el_layer'),
      q('tbody_el_wraps'),
      gearbox_max_torque_Nm
    );
    renderHydraulicTables(lastHyLayer, lastHyWraps, q('tbody_hy_layer'), q('tbody_hy_wraps'));

    renderInputSummary();
    renderLatexFragments(document.body);

    updateCsvButtonStates();

    // ---- Draw plots ----
    redrawPlots();
  } catch (e) {
    console.error(e);
    if (errBox) errBox.textContent = 'ERROR: ' + (e && e.message ? e.message : e);
    clearMinimumSystemHp();
    lastElLayer = lastElWraps = lastHyLayer = lastHyWraps = [];
    lastDrumState = null;
    lastDepthProfileContext = null;
    clearDrumVisualization();
    clearPlots();
    updateCsvButtonStates();
    renderInputSummary();
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
      speedMax: Number.isFinite(speedMaxVal) ? speedMaxVal : undefined
    });
    drawWaveHeightContours(waveSvgHeight, {
      ...baseWaveOpts,
      Tmin: Number.isFinite(heightTminVal) ? heightTminVal : 4,
      Tmax: Number.isFinite(heightTmaxVal) ? heightTmaxVal : 20,
      Hmin: Number.isFinite(HminVal) ? HminVal : undefined,
      Hmax: Number.isFinite(HmaxVal) ? HmaxVal : 6
    });
  }

  // Depth profiles (optional - skip if controls/SVGs absent)
  const depthSpeedSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_svg'));
  const depthSpeedPowerSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_power_svg'));
  const depthTensionSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_tension_svg'));
  const depthXminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmin'));
  const depthXmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmax'));
  const depthSpeedYminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymin'));
  const depthSpeedYmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymax'));
  const depthXminPowerEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmin_power'));
  const depthXmaxPowerEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmax_power'));
  const depthSpeedYminPowerEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymin_power'));
  const depthSpeedYmaxPowerEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymax_power'));
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
    /** @type {SpeedProfileSegments[]} */
    let powerSpeedProfiles = [];
    if (Number.isFinite(payloadVal)) {
      speedPrimaryLabel = formatPayloadLabel(payloadVal);
      if (lastDepthProfileContext && lastDepthProfileContext.scenario === activeScenario) {
        const payloadSteps = buildPayloadValues(payloadVal);
        const accentColor = readAccentColor();
        const payloadColorMap = new Map();
        let extraColorIdx = 0;
        payloadSteps.forEach(p => {
          const isPrimary = Math.abs(p - payloadVal) <= 1e-6;
          const color = isPrimary
            ? accentColor
            : EXTRA_SPEED_PROFILE_COLORS[extraColorIdx++ % EXTRA_SPEED_PROFILE_COLORS.length];
          payloadColorMap.set(p, color);
        });

        if (activeScenario === 'hydraulic') {
          const segments = computeDepthSpeedSegmentsForPayload(payloadVal, lastDepthProfileContext, { mode: 'flow' });
          if (segments.length) {
            const color = payloadColorMap.get(payloadVal) || accentColor;
            flowSpeedProfiles = [{
              label: `Flow limit — ${formatPayloadInlineLabel(payloadVal)}`,
              inlineLabel: formatPayloadInlineLabel(payloadVal),
              inlineLabelColor: color,
              color,
              strokeWidth: 3.2,
              legendStrokeWidth: 3.2,
              strokeDasharray: '6 4',
              legendStrokeDasharray: '6 4',
              segments
            }];
          }
        }

        powerSpeedProfiles = payloadSteps
          .map((p, idx) => {
            const segments = computeDepthSpeedSegmentsForPayload(p, lastDepthProfileContext, { mode: 'power' });
            if (!segments.length) return null;
            const color = accentColor;
            const isPrimary = Math.abs(p - payloadVal) <= 1e-6;
            const strokeDasharray = (idx % 2 === 1) ? '6 4' : null;
            return {
              label: formatPayloadLabel(p),
              inlineLabel: formatPayloadInlineLabel(p),
              inlineLabelColor: color,
              color,
              strokeWidth: isPrimary ? 4 : 2.4,
              legendStrokeWidth: isPrimary ? 4 : 2.4,
              strokeDasharray,
              legendStrokeDasharray: strokeDasharray,
              segments
            };
          })
          .filter(Boolean);
      }
    }
    const depthXminVal = parseInput(depthXminEl);
    const depthXmaxVal = parseInput(depthXmaxEl);
    const depthSpeedMinVal = parseInput(depthSpeedYminEl);
    const depthSpeedMaxVal = parseInput(depthSpeedYmaxEl);
    const depthXminPowerVal = parseInput(depthXminPowerEl);
    const depthXmaxPowerVal = parseInput(depthXmaxPowerEl);
    const depthSpeedMinPowerVal = parseInput(depthSpeedYminPowerEl);
    const depthSpeedMaxPowerVal = parseInput(depthSpeedYmaxPowerEl);
    const depthXminTensionVal = parseInput(depthXminTensionEl);
    const depthXmaxTensionVal = parseInput(depthXmaxTensionEl);
    const depthTensionMinVal = parseInput(depthTensionYminEl);
    const depthTensionMaxVal = parseInput(depthTensionYmaxEl);
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

    if (depthSpeedPowerSvg) {
      if (powerSpeedProfiles.length) {
        drawStandaloneSpeedProfiles(depthSpeedPowerSvg, {
          segments: [],
          extraProfiles: powerSpeedProfiles,
          depthMin: Number.isFinite(depthXminPowerVal) ? Math.max(0, depthXminPowerVal) : undefined,
          depthMax: Number.isFinite(depthXmaxPowerVal) ? Math.max(0, depthXmaxPowerVal) : undefined,
          speedMin: Number.isFinite(depthSpeedMinPowerVal) ? Math.max(0, depthSpeedMinPowerVal) : undefined,
          speedMax: Number.isFinite(depthSpeedMaxPowerVal) ? Math.max(0, depthSpeedMaxPowerVal) : undefined,
          ratedSpeedMs: null,
          primaryLabel: null,
          accentColor: readAccentColor(),
          showLegend: false
        });
      } else {
        while (depthSpeedPowerSvg.firstChild) depthSpeedPowerSvg.removeChild(depthSpeedPowerSvg.firstChild);
      }
    }
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
    q('depth_speed_power_svg'),
    q('depth_tension_svg'),
    q('hyd_rpm_torque_svg')
  ];
  svgs.forEach(svg => { if (!svg) return; while (svg.firstChild) svg.removeChild(svg.firstChild); });
}
