// ===== main.mjs — app bootstrap, compute, render, plots =====

import {
  q, read,
  G, W_PER_HP, PSI_TO_PA, CC_PER_GAL, M_PER_IN,
  tension_kgf, elec_available_tension_kgf,
  gpm_from_cc_rev_and_rpm, rpm_from_gpm_and_disp,
  psi_from_torque_and_disp_Nm_cc, torque_per_motor_from_pressure_Pa,
  line_speed_mpm_from_motor_rpm, hp_from_psi_and_gpm
} from './utils.mjs';

import { setupInputPersistence } from './persist-inputs.mjs';

import { calcLayers } from './layer-engine.mjs';

import {
  rowsToElectricLayer, projectElectricWraps, renderElectricTables
} from './electric.mjs';

import {
  rowsToHydraulicLayer, projectHydraulicWraps, renderHydraulicTables
} from './hydraulic.mjs';

import { drawWaveContours, drawWaveHeightContours } from './plots/wave-contours.mjs';
import { drawDepthProfiles } from './plots/depth-profiles.mjs';
import { setupComponentSelectors } from './component-selectors.mjs';
import { renderDrumVisualization, clearDrumVisualization } from './drum-visual.mjs';

// ---- App state for plots/tables ----
let lastElLayer = [], lastElWraps = [];
let lastHyLayer = [], lastHyWraps = [];

const DRIVE_MODE_CHECKBOX = {
  electric: 'drive_electric_enabled',
  hydraulic: 'drive_hydraulic_enabled'
};

// ---- Wire up events once DOM is ready ----
document.addEventListener('DOMContentLoaded', () => {
  setupInputPersistence();

  setupComponentSelectors();

  setupDriveModeControls();

  setupPlotResizeToggles();

  setupAutoRecompute();

  updateBuildIndicator();

  document.querySelectorAll('.param-label').forEach(label => {
    const code = label.dataset.code;
    if (code) {
      label.setAttribute('title', code);
    }
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      document.getElementById(b.dataset.target).classList.add('active');
    });
  });

  // Wave plot controls
  q('wave_redraw').addEventListener('click', () => redrawPlots());
  q('wave_scenario').addEventListener('change', () => redrawPlots());
  ['wave_tmin', 'wave_tmax', 'wave_vmax', 'wave_hmax'].forEach(id => q(id).addEventListener('change', () => redrawPlots()));

  // Depth plot controls
  q('depth_redraw').addEventListener('click', () => redrawPlots());
  q('depth_scenario').addEventListener('change', () => redrawPlots());

  // Initial compute
  computeAll();
});

function updateBuildIndicator() {
  const indicator = /** @type {HTMLElement|null} */ (document.getElementById('build-info'));
  if (!indicator) return;

  const lastModified = new Date(document.lastModified);
  if (Number.isNaN(lastModified.getTime())) {
    indicator.textContent = `Updated ${document.lastModified}`;
    return;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  });

  indicator.textContent = `Updated ${formatter.format(lastModified)} UTC`;
}

function setupPlotResizeToggles() {
  const toggles = document.querySelectorAll('[data-plot-toggle]');
  toggles.forEach(btn => {
    const col = btn.closest('.plot-column');
    if (!col) return;
    const initialExpanded = col.classList.contains('is-expanded');
    btn.textContent = initialExpanded ? '[-]' : '[+]';
    btn.setAttribute('aria-expanded', initialExpanded ? 'true' : 'false');
    btn.addEventListener('click', () => {
      const expanded = col.classList.toggle('is-expanded');
      btn.textContent = expanded ? '[-]' : '[+]';
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  });
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

function setupDriveModeControls() {
  const toggles = [
    { mode: 'electric', el: /** @type {HTMLInputElement|null} */ (document.getElementById(DRIVE_MODE_CHECKBOX.electric)) },
    { mode: 'hydraulic', el: /** @type {HTMLInputElement|null} */ (document.getElementById(DRIVE_MODE_CHECKBOX.hydraulic)) }
  ];

  const enforceAtLeastOne = (changedEl) => {
    const enabled = toggles.filter(t => t.el && t.el.checked);
    if (enabled.length === 0 && changedEl) {
      changedEl.checked = true;
    }
  };

  toggles.forEach(({ el }) => {
    if (!el) return;
    el.addEventListener('change', () => {
      enforceAtLeastOne(el);
      syncDriveModeVisibility();
    });
  });

  if (toggles.every(t => !t.el || !t.el.checked)) {
    const fallback = toggles.find(t => t.el);
    if (fallback && fallback.el) {
      fallback.el.checked = true;
    }
  }

  syncDriveModeVisibility();
}

function driveModeEnabled(mode) {
  const id = DRIVE_MODE_CHECKBOX[mode];
  if (!id) return true;
  const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
  if (!el) return true;
  return el.checked;
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
  updateScenarioOptions('depth_scenario', electricEnabled, hydraulicEnabled);
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
  const errBox = q('err');
  const status = /** @type {HTMLElement|null} */ (document.getElementById('status'));
  errBox.textContent = '';
  if (status) status.textContent = 'computing…';

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
      flange_to_flange_in: read('ftf_in'),
      lebus_thk_in: read('lebus_in'),
      packing_factor: read('pack'),
      wraps_per_layer_override
    };
    const payload_kg = read('payload_kg');
    const cable_w_kgpm = read('c_w_kgpm');

    // Shared drivetrain
    const gr1 = read('gr1');
    const gr2 = read('gr2');
    const motors = read('motors');
    const denom_mech = (gr1 || 1) * (gr2 || 1) * (motors || 1);

    const electricEnabled = driveModeEnabled('electric');
    const hydraulicEnabled = driveModeEnabled('hydraulic');

    // Electric inputs
    const motor_max_rpm = read('motor_max_rpm');
    const motor_hp = read('motor_hp');
    const motor_tmax = read('motor_tmax');
    const P_per_motor_W = (Number.isFinite(motor_hp) ? motor_hp : 0) * W_PER_HP;

    // Hydraulic inputs
    const h_strings = read('h_pump_strings');
    const h_emotor_hp = read('h_emotor_hp');
    const h_emotor_eff = read('h_emotor_eff'); // electro-hydraulic efficiency
    const h_emotor_rpm = read('h_emotor_rpm');
    const h_pump_cc = read('h_pump_cc');
    const h_max_psi = read('h_max_psi');
    const h_hmot_cc = read('h_hmot_cc');
    const h_hmot_rpm_cap = read('h_hmot_rpm_max');

    // Usable hydraulic hp & flow from pump strings
    const hp_str_usable = h_emotor_hp * h_emotor_eff;
    const hp_tot_usable = hp_str_usable * h_strings;
    const q_str_gpm = gpm_from_cc_rev_and_rpm(h_pump_cc, h_emotor_rpm);
    const q_tot_gpm = q_str_gpm * h_strings;

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
      wrapsNoteEl.textContent = `Leave blank or set to 0 to use calculated wraps (always truncated to .0/.5). Auto-calculated wraps per layer: ${display}.`;
    }

    // Per-wrap calculations (electric + hydraulic)
    for (const r of rows) {
      // Base tension and torque at drum
      r.tension_kgf = tension_kgf(r.deployed_len_m, payload_kg, cable_w_kgpm);
      const tension_N = r.tension_kgf * G;
      const radius_m = (r.layer_dia_in * M_PER_IN) / 2;
      r.torque_Nm = +(tension_N * radius_m).toFixed(1);

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

        // Pressure required for current torque (per motor)
        const drum_T = tension_N * radius_m;
        const torque_per_hmotor = drum_T / (Math.max(gr1, 1e-9) * Math.max(gr2, 1e-9) * Math.max(motors, 1));
        let P_req_psi = psi_from_torque_and_disp_Nm_cc(torque_per_hmotor, h_hmot_cc);
        if (!Number.isFinite(P_req_psi) || P_req_psi < 0) P_req_psi = 0;

        // Flow-limited speed
        const rpm_flow_per_motor = Math.min(
          h_hmot_rpm_cap || Infinity,
          rpm_from_gpm_and_disp(q_tot_gpm / Math.max(motors, 1), h_hmot_cc)
        );
        const speed_flow_mpm = line_speed_mpm_from_motor_rpm(rpm_flow_per_motor, gr1, gr2, r.layer_dia_in);

        // Power-limited speed (cap pressure at max if P_req exceeds max)
        const P_power_psi = (P_req_psi > 0) ? Math.min(P_req_psi, h_max_psi) : 0;
        let speed_power_mpm = 0, hp_used_at_available = 0, speed_avail_mpm = 0;

        if (P_power_psi > 0) {
          const gpm_power_max = (hp_tot_usable * 1714) / P_power_psi;
          const rpm_power_per_motor = Math.min(
            h_hmot_rpm_cap || Infinity,
            rpm_from_gpm_and_disp(gpm_power_max / Math.max(motors, 1), h_hmot_cc)
          );
          speed_power_mpm = line_speed_mpm_from_motor_rpm(rpm_power_per_motor, gr1, gr2, r.layer_dia_in);
          speed_avail_mpm = Math.min(speed_power_mpm, speed_flow_mpm);

          // Power used at the actual available speed
          const D_m = r.layer_dia_in * M_PER_IN;
          const drum_rpm_needed = speed_avail_mpm / (Math.PI * D_m);
          const motor_rpm_needed = drum_rpm_needed * (Math.max(gr1, 1) * Math.max(gr2, 1));
          const gpm_per_motor_needed = (motor_rpm_needed * h_hmot_cc) / CC_PER_GAL;
          const gpm_total_needed = Math.max(motors, 1) * gpm_per_motor_needed;
          const gpm_used = Math.min(gpm_total_needed, q_tot_gpm);
          hp_used_at_available = hp_from_psi_and_gpm(P_power_psi, gpm_used);
          if (hp_used_at_available > hp_tot_usable) hp_used_at_available = hp_tot_usable;
        } else {
          speed_power_mpm = speed_flow_mpm;
          speed_avail_mpm = speed_flow_mpm;
          hp_used_at_available = 0;
        }

        r.hyd_P_required_psi = Math.round(P_req_psi);
        r.hyd_speed_power_mpm = +speed_power_mpm.toFixed(2);
        r.hyd_speed_flow_mpm = +speed_flow_mpm.toFixed(2);
        r.hyd_speed_available_mpm = +speed_avail_mpm.toFixed(2);
        r.hyd_hp_used_at_available = +hp_used_at_available.toFixed(2);
        r.hyd_elec_input_hp_used = +((h_emotor_eff > 0 ? r.hyd_hp_used_at_available / h_emotor_eff : 0)).toFixed(2);
      } else {
        r.hyd_drum_torque_maxP_Nm = 0;
        r.hyd_avail_tension_kgf = 0;
        r.hyd_P_required_psi = 0;
        r.hyd_speed_power_mpm = 0;
        r.hyd_speed_flow_mpm = 0;
        r.hyd_speed_available_mpm = 0;
        r.hyd_hp_used_at_available = 0;
        r.hyd_elec_input_hp_used = 0;
      }
    }

    // ---- Drum visualization ----
    renderDrumVisualization(rows, summary, cfg, meta);

    // ---- Aggregate into per-layer tables ----
    lastElLayer = electricEnabled ? rowsToElectricLayer(rows, payload_kg, cable_w_kgpm, gr1, gr2, motors) : [];
    lastHyLayer = hydraulicEnabled ? rowsToHydraulicLayer(rows) : [];
    lastElWraps = electricEnabled ? projectElectricWraps(rows) : [];
    lastHyWraps = hydraulicEnabled ? projectHydraulicWraps(rows) : [];

    // ---- Render tables ----
    renderElectricTables(lastElLayer, lastElWraps, q('tbody_el_layer'), q('tbody_el_wraps'));
    renderHydraulicTables(lastHyLayer, lastHyWraps, q('tbody_hy_layer'), q('tbody_hy_wraps'));

    // ---- Update status ----
    if (status) status.textContent = 'results updated';

    // ---- Draw plots ----
    redrawPlots();
  } catch (e) {
    console.error(e);
    q('err').textContent = 'ERROR: ' + (e && e.message ? e.message : e);
    if (status) status.textContent = 'error';
    lastElLayer = lastElWraps = lastHyLayer = lastHyWraps = [];
    clearDrumVisualization();
    clearPlots();
  }
}

// ---- Plot redraw helper (uses decoupled plotting modules) ----
function redrawPlots() {
    // Wave contours (optional - skip if controls/SVGs absent)
  const waveScenarioEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('wave_scenario'));
  const waveTminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmin'));
  const waveTmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmax'));
  const waveVmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_vmax'));
  const waveHmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_hmax'));
  const waveSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg'));
  const waveSvgHeight = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg_height'));

  if (waveScenarioEl && waveTminEl && waveTmaxEl && waveHmaxEl && waveSvg && waveSvgHeight) {
    const parseInput = (el) => parseFloat((el.value || '').replace(',', '.'));
    const waveOpts = {
      scenario: waveScenarioEl.value || 'electric',
      Tmin: parseInput(waveTminEl) || 4,
      Tmax: parseInput(waveTmaxEl) || 20,
      speedMax: waveVmaxEl ? parseInput(waveVmaxEl) : undefined,
      Hmax: parseInput(waveHmaxEl) || 6,
      elLayers: lastElLayer,
      hyLayers: lastHyLayer
    };
    drawWaveContours(waveSvg, waveOpts);
    drawWaveHeightContours(waveSvgHeight, waveOpts);
  }

  // Depth profiles (optional - skip if controls/SVGs absent)
  const depthScenarioEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('depth_scenario'));
  const depthSpeedSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_svg'));
  const depthTensionSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_tension_svg'));

  if (depthScenarioEl && depthSpeedSvg && depthTensionSvg) {
    drawDepthProfiles(depthSpeedSvg, depthTensionSvg, {
      scenario: depthScenarioEl.value || 'electric',       // 'electric' | 'hydraulic'
      elWraps: lastElWraps,
      hyWraps: lastHyWraps,
      payload_kg: read('payload_kg'),
      cable_w_kgpm: read('c_w_kgpm'),
      dead_end_m: read('dead_m')    });
  }
}

function clearPlots() {
  const svgs = [q('wave_svg'), q('wave_svg_height'), q('depth_speed_svg'), q('depth_tension_svg')];
  svgs.forEach(svg => { if (!svg) return; while (svg.firstChild) svg.removeChild(svg.firstChild); });
}
