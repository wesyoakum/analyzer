import {
  G, M_PER_IN,
  tension_kgf,
} from './utils.mjs';
import {
  formatDecimal,
  formatInches,
  formatInteger,
  formatKgf,
  formatMeters,
  formatMotorTorque,
  formatRpm,
  formatSpeed
} from './table-formatters.mjs';
import { fromInternalForGroup, getGroupLabel } from './units.mjs';

// Unit conversion helpers for output values
const cv = (group, v) => fromInternalForGroup(group, v);
const fmtIn  = (v) => formatInches(cv('length_in', v));
const fmtM   = (v) => formatMeters(cv('length_m', v));
const fmtKgf = (v) => formatKgf(cv('force_kgf', v));
const fmtSpd = (v) => formatSpeed(cv('speed_mpm', v));
const fmtTrq = (v) => formatMotorTorque(cv('torque_Nm', v));
// kN·m column: same conversion factor, applied to value already /1000
const fmtKnm = (v) => formatInteger(cv('torque_Nm', v));

/**
 * Convert per-wrap rows into per-layer rows for the Electric table.
 * - Pre/post values: taken from first/last wrap of each layer.
 * - Start-of-layer motor rpm, line speed, and available tension: taken from the FIRST wrap of each layer.
 * - Max tension/torque fields computed at the layer start (pre-wrap).
 *
 * @param {Array<Object>} rows
 * @param {number} payload_kg
 * @param {number} cable_w_kgpm
 * @param {number} gr1
 * @param {number} gr2
 * @param {number} motors
 * @returns {Array<Object>} sorted by layer_no ascending
 */
export function rowsToElectricLayer(rows, payload_kg, cable_w_kgpm, gr1, gr2, motors) {
  const byLayer = new Map();

  // First pass: collect pre/post geometry/depth
  for (const r of rows) {
    const total = r.total_cable_len_m;
    const pre_on = r.pre_spooled_len_m;
    const pre_dep = +(total - pre_on).toFixed(3);
    const post_on = r.spooled_len_m;
    const post_dep = +(total - post_on).toFixed(3);

    if (!byLayer.has(r.layer_no)) {
      byLayer.set(r.layer_no, {
        layer_no: r.layer_no,
        layer_dia_in: r.layer_dia_in,
        pre_on_drum_m: pre_on,
        pre_deployed_m: pre_dep,
        post_on_drum_m: post_on,
        post_deployed_m: post_dep,
        motor_rpm_at_start: null,
        line_speed_at_start_mpm: null,
        tension_theoretical_start_kgf: null,
        tension_required_start_kgf: null,
        tension_required_end_kgf: null,
        avail_tension_kgf: null
      });
    } else {
      const L = byLayer.get(r.layer_no);
      L.post_on_drum_m = post_on;
      L.post_deployed_m = post_dep;
    }
  }

  // Second pass: stash start-of-layer dynamic values from the first wrap in that layer
  for (const r of rows) {
    const L = byLayer.get(r.layer_no);
    if (L && L.motor_rpm_at_start === null) {
      L.motor_rpm_at_start = r.motor_rpm ?? '';
      L.line_speed_at_start_mpm = r.line_speed_mpm ?? '';
      L.tension_theoretical_start_kgf = r.tension_theoretical_kgf ?? null;
      L.tension_required_start_kgf = +tension_kgf(L.pre_deployed_m, payload_kg, cable_w_kgpm).toFixed(1);
      L.avail_tension_kgf = r.avail_tension_kgf ?? null;
    }
  }

  // Third pass: find max acceleration torque per layer
  const maxAccelByLayer = new Map();
  for (const r of rows) {
    const val = r.accel_torque_drum_Nm || 0;
    const cur = maxAccelByLayer.get(r.layer_no) || 0;
    if (val > cur) maxAccelByLayer.set(r.layer_no, val);
  }

  // Final: compute max tension/torque values at the layer start (pre-wrap)
  const out = [];
  const denom = (gr1 || 1) * (gr2 || 1) * (motors || 1);

  for (const L of [...byLayer.values()].sort((a, b) => a.layer_no - b.layer_no)) {
    const maxTheo_kgf = tension_kgf(L.pre_deployed_m, payload_kg, cable_w_kgpm);
    const maxReq_kgf = maxTheo_kgf;
    const endReq_kgf = tension_kgf(L.post_deployed_m, payload_kg, cable_w_kgpm);
    const radius_m = (L.layer_dia_in * M_PER_IN) / 2;
    const maxDrumT_Nm = +(maxReq_kgf * G * radius_m).toFixed(1);
    const motorsSafe = Math.max(motors || 1, 1);
    const gr2Safe = Math.max(gr2 || 1, 1e-9);
    const maxGbT_Nm = +(maxDrumT_Nm / (motorsSafe * gr2Safe)).toFixed(1);
    const maxMotorNm = +(maxGbT_Nm / (gr1 || 1)).toFixed(1);

    out.push({
      ...L,
      max_tension_theoretical_kgf: maxTheo_kgf,
      max_tension_required_kgf: maxReq_kgf,
      tension_required_end_kgf: +endReq_kgf.toFixed(1),
      max_drum_torque_Nm: maxDrumT_Nm,
      max_gearbox_torque_Nm: maxGbT_Nm,
      max_torque_Nm: maxDrumT_Nm,
      tau_req_drum_kNm: +(maxDrumT_Nm / 1000).toFixed(1),
      max_motor_torque_Nm: maxMotorNm,
      max_accel_torque_drum_Nm: maxAccelByLayer.get(L.layer_no) || 0
    });
  }
  return out;
}

/**
 * Pick the Electric fields needed for the Wraps table (kept small for DOM render).
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
export function projectElectricWraps(rows) {
  return rows.map(r => ({
    wrap_no: r.wrap_no,
    layer_no: r.layer_no,
    layer_dia_in: r.layer_dia_in,
    wrap_len_in: r.wrap_len_in,
    pre_spooled_len_m: r.pre_spooled_len_m,
    spooled_len_m: r.spooled_len_m,
    deployed_len_m: r.deployed_len_m,
    total_cable_len_m: r.total_cable_len_m,
    tension_required_kgf: r.tension_kgf,
    tension_theoretical_kgf: r.tension_theoretical_kgf,
    tau_req_drum_kNm: +(r.torque_Nm / 1000).toFixed(1),
    gearbox_torque_Nm: r.gearbox_torque_Nm,
    motor_torque_Nm: r.motor_torque_Nm,
    motor_rpm: r.motor_rpm,
    vP: r.el_speed_power_mpm,
    vGB: r.el_speed_gearbox_mpm,
    vavail: r.el_speed_available_mpm,
    line_speed_mpm: r.line_speed_mpm,
    avail_tension_kgf: r.avail_tension_kgf,
    accel_torque_drum_Nm: r.accel_torque_drum_Nm || 0
  }));
}

/**
 * Render Electric layer + wraps tables (tbody elements provided by caller).
 * @param {Array<Object>} elLayers
 * @param {Array<Object>} elWraps
 * @param {HTMLElement} tbodyLayer
 * @param {HTMLElement} tbodyWraps
 */
export function renderElectricTables(
  elLayers,
  elWraps,
  tbodyLayer,
  tbodyWraps,
  gearboxMaxTorqueNm,
  motorTmaxNm,
  summaryEl,
  ratedSwlKgf,
  fullDrumDiaIn,
  driveMotorCount,
  totalGearRatio,
  gr2 = null
) {
  const hasGearboxMax = Number.isFinite(gearboxMaxTorqueNm) && gearboxMaxTorqueNm > 0;
  const hasMotorMax = Number.isFinite(motorTmaxNm) && motorTmaxNm > 0;
  const formatCableOnDrumRange = (minValue, maxValue) => `${fmtM(minValue)}-${fmtM(maxValue)}`;
  const formatDepthRange = (maxValue, minValue) => `${fmtM(maxValue)}-${fmtM(minValue)}`;
  const torqueCell = (value) => {
    const text = fmtTrq(value);
    const exceeds = hasGearboxMax && Number.isFinite(value) && value > gearboxMaxTorqueNm;
    const attrs = exceeds ? ' class="is-exceeded" title="Exceeds gearbox max torque"' : '';
    return `<td${attrs}>${text}</td>`;
  };

  // Layer table
  tbodyLayer.innerHTML = '';
  for (const r of elLayers) {
    const tr = document.createElement('tr');
    const cells = [
      `<td>${formatInteger(r.layer_no)}</td>`,
      `<td>${fmtIn(r.layer_dia_in)}</td>`,
      `<td>${formatCableOnDrumRange(r.pre_on_drum_m, r.post_on_drum_m)}</td>`,
      `<td>${formatDepthRange(r.pre_deployed_m, r.post_deployed_m)}</td>`,
      torqueCell(r.max_gearbox_torque_Nm),
      `<td>${fmtSpd(r.line_speed_at_start_mpm ?? '')}</td>`,
      `<td>${fmtKgf(r.tension_required_start_kgf)}-${fmtKgf(r.tension_required_end_kgf)}</td>`,
      `<td>${fmtKgf(r.avail_tension_kgf)}</td>`,
      `<td>${r.max_accel_torque_drum_Nm ? fmtTrq(r.max_accel_torque_drum_Nm) : '–'}</td>`
    ];
    tr.innerHTML = cells.join('');
    tbodyLayer.appendChild(tr);
  }

  // Wraps table
  tbodyWraps.innerHTML = '';
  for (const r of elWraps) {
    const tr = document.createElement('tr');
    const cells = [
      `<td>${formatInteger(r.wrap_no)}</td>`,
      `<td>${formatInteger(r.layer_no)}</td>`,
      `<td>${fmtIn(r.layer_dia_in)}</td>`,
      `<td>${fmtIn(r.wrap_len_in)}</td>`,
      `<td>${fmtM(r.pre_spooled_len_m)}</td>`,
      `<td>${fmtM(r.spooled_len_m)}</td>`,
      `<td>${fmtM(r.deployed_len_m)}</td>`,
      `<td>${fmtKgf(r.tension_required_kgf ?? '')}</td>`,
      `<td>${fmtKnm(r.tau_req_drum_kNm)}</td>`,
      torqueCell(r.gearbox_torque_Nm),
      `<td>${fmtTrq(r.motor_torque_Nm)}</td>`,
      `<td>${formatRpm(r.motor_rpm)}</td>`,
      `<td>${fmtSpd(r.line_speed_mpm)}</td>`,
      `<td>${fmtKgf(r.avail_tension_kgf)}</td>`
    ];
    tr.innerHTML = cells.join('');
    tbodyWraps.appendChild(tr);
  }

  const swlSafe = Number.isFinite(ratedSwlKgf) ? Math.max(0, ratedSwlKgf) : 0;
  const drumDiaM = Number.isFinite(fullDrumDiaIn) ? Math.max(0, fullDrumDiaIn) * M_PER_IN : 0;
  const driveMotorsSafe = Number.isFinite(driveMotorCount) && driveMotorCount > 0 ? driveMotorCount : 0;
  const totalGearRatioSafe = Number.isFinite(totalGearRatio) && totalGearRatio > 0 ? totalGearRatio : 0;

  // Factory acceptance test: SWL × 1.25 at full drum
  const tauFatDrumNm = swlSafe * 1.25 * G * (drumDiaM / 2);
  // Actual peak drum torque from operating layers
  const tauOpsDrumNm = elLayers.reduce((max, L) =>
    Number.isFinite(L.max_drum_torque_Nm) ? Math.max(max, L.max_drum_torque_Nm) : max, 0);
  // Worst case of the two
  const tauMaxDrumNm = Math.max(tauFatDrumNm, tauOpsDrumNm);
  // Torque path: gearbox = drum / (N_motors × GR2), motor = gearbox / GR1
  const gr2Safe = Number.isFinite(gr2) && gr2 > 0 ? gr2 : 0;
  const tauMaxGbNm = (driveMotorsSafe > 0 && gr2Safe > 0)
    ? tauMaxDrumNm / (driveMotorsSafe * gr2Safe)
    : 0;
  const gr1Safe = (totalGearRatioSafe > 0 && gr2Safe > 0) ? totalGearRatioSafe / gr2Safe : 0;
  const tauMaxMtrNm = gr1Safe > 0
    ? tauMaxGbNm / gr1Safe
    : 0;
  const tau_allow_max_gb = hasGearboxMax ? gearboxMaxTorqueNm : null;
  const tau_allow_max_mtr = hasMotorMax ? motorTmaxNm : null;
  const gearboxCheckPassed = Number.isFinite(tau_allow_max_gb) && tau_allow_max_gb >= tauMaxGbNm;
  const motorCheckPassed = Number.isFinite(tau_allow_max_mtr) && tau_allow_max_mtr >= tauMaxMtrNm;
  const gearboxCheckText = hasGearboxMax
    ? (gearboxCheckPassed ? 'OK' : 'Exceeded')
    : '–';
  const motorCheckText = hasMotorMax
    ? (motorCheckPassed ? 'OK' : 'Exceeded')
    : '–';

  if (summaryEl) {
    const tU = getGroupLabel('torque_Nm');
    summaryEl.innerHTML = [
      `<strong>τ<sub>max,drum</sub></strong>: ${fmtTrq(tauMaxDrumNm)} ${tU}`,
      '',
      `<strong>τ<sub>max,gb</sub></strong>: ${fmtTrq(tauMaxGbNm)} ${tU}`,
      `<strong>τ<sub>gb,rated</sub></strong>: ${hasGearboxMax ? `${fmtTrq(gearboxMaxTorqueNm)} ${tU}` : '–'}`,
      `<strong>Check</strong>: ${gearboxCheckText}`,
      '',
      `<strong>τ<sub>max,m</sub></strong>: ${fmtTrq(tauMaxMtrNm)} ${tU}`,
      `<strong>τ<sub>m,rated</sub></strong>: ${hasMotorMax ? `${fmtTrq(motorTmaxNm)} ${tU}` : '–'}`,
      `<strong>Check</strong>: ${motorCheckText}`
    ].join('<br>');
  }

  return {
    gearboxCheckFailed: hasGearboxMax && !gearboxCheckPassed,
    motorCheckFailed: hasMotorMax && !motorCheckPassed
  };
}
