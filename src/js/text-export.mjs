// ===== text-export.mjs — Plain-text summary export of analyzer inputs =====

import { q, read } from './utils.mjs';

const MM_PER_IN = 25.4;
const KGF_TO_LBF = 2.20462;
const W_PER_HP = 745.7;

function safeRead(id) {
  try { return read(id); } catch { return null; }
}

function safeVal(id) {
  try { return q(id)?.value ?? null; } catch { return null; }
}

function safeChecked(id) {
  try { return q(id)?.checked ?? false; } catch { return false; }
}

function fmt(v, decimals = 0) {
  if (v == null || !Number.isFinite(v)) return null;
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function selectText(id) {
  const el = q(id);
  if (!el) return null;
  if (el.tagName === 'SELECT') {
    const opt = el.options[el.selectedIndex];
    const text = opt ? opt.textContent.trim() : el.value;
    if (!text || text === 'Custom (manual input)' || text === '— Select —') return null;
    return text;
  }
  return el.value || null;
}

/** Push a line only if the value portion is truthy (not null/undefined/empty). */
function pushIf(lines, label, value) {
  if (value != null && value !== '' && value !== '—') {
    lines.push(`${label}: ${value}`);
  }
}

/**
 * Build a plain-text summary of all analyzer inputs.
 * @param {object|null} model - The last computed model
 */
export function buildTextSummary(model) {
  const projectName = q('project_name')?.value || 'Untitled';
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const systemType = safeVal('system_type_select');
  const winchType = safeVal('winch_type_select');
  const ahcEnabled = safeChecked('ahc_enabled');

  const systemLabel = systemType === 'hydraulic' ? 'Hydraulic' : 'Electric';
  const winchLabel = winchType === 'traction' ? 'Traction Winch' : 'Single Drum';

  const lines = [];

  lines.push('C-LARS Winch Analysis Report');
  lines.push(projectName);
  lines.push(today);
  lines.push('');
  pushIf(lines, 'System Type', systemLabel);
  pushIf(lines, 'Winch Type', winchLabel);
  lines.push(`Active Heave Compensation: ${ahcEnabled ? 'Yes' : 'No'}`);

  // Design
  const swl = safeRead('rated_swl_kgf');
  const speed = safeRead('rated_speed_mpm');
  const eff = safeRead('system_efficiency');

  lines.push('');
  const swlStr = fmt(swl);
  if (swlStr) {
    const lbs = fmt(swl * KGF_TO_LBF);
    pushIf(lines, 'Safe Working Load', `${swlStr} kgf${lbs ? ` (${lbs} lbs)` : ''}`);
  }
  pushIf(lines, 'Rated Line Speed', fmt(speed) ? `${fmt(speed)} m/min` : null);
  pushIf(lines, 'System Efficiency', eff != null ? `${fmt(eff * 100)}%` : null);

  // Cable
  const cableMm = safeRead('c_mm');
  const cableLen = safeRead('cable_len_m');
  const depth = safeRead('depth_m');
  const dead = safeRead('dead_m');
  const cableW = safeRead('c_w_kgpm');
  const mbl = safeRead('mbl_kgf');

  lines.push('');
  const cablePreset = selectText('cable_select');
  pushIf(lines, 'Cable', cablePreset);
  pushIf(lines, 'Cable Diameter', fmt(cableMm, 1) ? `${fmt(cableMm, 1)} mm` : null);
  pushIf(lines, 'Cable Length', fmt(cableLen) ? `${fmt(cableLen)} m` : null);
  pushIf(lines, 'Max Operating Depth', fmt(depth) ? `${fmt(depth)} m` : null);
  pushIf(lines, 'Dead End Length', fmt(dead) ? `${fmt(dead)} m` : null);
  pushIf(lines, 'Cable Weight in Water', fmt(cableW, 2) ? `${fmt(cableW, 2)} kg/m` : null);
  pushIf(lines, 'Minimum Breaking Load', fmt(mbl) ? `${fmt(mbl)} kgf` : null);

  // Drum
  const coreIn = safeRead('core_in');
  const flangeIn = safeRead('flange_dia_in');
  const ftfIn = safeRead('ftf_in');
  const lebusIn = safeRead('lebus_in');
  const pack = safeRead('pack');
  const wrapsOverride = safeRead('wraps_override');
  const calcWraps = model?.meta?.wraps_per_layer_calc;
  const usedWraps = model?.meta?.wraps_per_layer_used;

  lines.push('');
  const drumPreset = selectText('drum_select');
  pushIf(lines, 'Drum', drumPreset);
  pushIf(lines, 'Core Diameter', fmt(coreIn, 2) ? `${fmt(coreIn, 2)} in (${fmt(coreIn * MM_PER_IN, 1)} mm)` : null);
  pushIf(lines, 'Flange Diameter', fmt(flangeIn, 2) ? `${fmt(flangeIn, 2)} in (${fmt(flangeIn * MM_PER_IN, 1)} mm)` : null);
  pushIf(lines, 'Flange-to-Flange Width', fmt(ftfIn, 2) ? `${fmt(ftfIn, 2)} in (${fmt(ftfIn * MM_PER_IN, 1)} mm)` : null);
  pushIf(lines, 'Lebus Liner Thickness', fmt(lebusIn, 3) ? `${fmt(lebusIn, 3)} in` : null);
  pushIf(lines, 'Packing Factor', fmt(pack, 3));

  // Wraps per layer: show calculated value; if overridden, show override with calc as note
  if (Number.isFinite(wrapsOverride) && wrapsOverride > 0) {
    const note = Number.isFinite(calcWraps) ? ` (calculated: ${fmt(calcWraps, 1)})` : '';
    pushIf(lines, 'Wraps per Layer', `${fmt(wrapsOverride, 1)}${note}`);
  } else if (Number.isFinite(usedWraps)) {
    pushIf(lines, 'Wraps per Layer', fmt(usedWraps, 1));
  }

  // Computed drum results
  if (model?.summary) {
    const s = model.summary;
    pushIf(lines, 'Total Layers', s.total_layers != null ? String(s.total_layers) : null);
    pushIf(lines, 'Full Drum Diameter', fmt(s.full_drum_dia_in, 2) ? `${fmt(s.full_drum_dia_in, 2)} in` : null);
    pushIf(lines, 'Total Cable Length', fmt(s.total_cable_len_m) ? `${fmt(s.total_cable_len_m)} m` : null);
  }

  // Payload
  const payloadAir = safeRead('payload_air_kg');
  const payloadWater = safeRead('payload_kg');

  lines.push('');
  const payloadPreset = selectText('payload_select');
  pushIf(lines, 'Payload', payloadPreset);
  if (Number.isFinite(payloadAir) && payloadAir > 0) {
    pushIf(lines, 'Payload in Air', `${fmt(payloadAir)} kg`);
  }
  pushIf(lines, 'Payload in Water', fmt(payloadWater) ? `${fmt(payloadWater)} kg` : null);

  // Payload breakdown (only if filled)
  const tmsAir = safeRead('tms_air_kg');
  const vehicleAir = safeRead('vehicle_air_kg');
  const addlAir = safeRead('additional_air_kg');
  const tmsWater = safeRead('tms_water_kg');
  const vehicleWater = safeRead('vehicle_water_kg');
  const addlWater = safeRead('additional_water_kg');
  const hasBreakdown = [tmsAir, vehicleAir, addlAir, tmsWater, vehicleWater, addlWater]
    .some(v => Number.isFinite(v) && v > 0);

  if (hasBreakdown) {
    lines.push('');
    lines.push('  Payload Breakdown:');
    if (Number.isFinite(tmsAir) && tmsAir > 0) lines.push(`    TMS in Air: ${fmt(tmsAir)} kg`);
    if (Number.isFinite(vehicleAir) && vehicleAir > 0) lines.push(`    Vehicle in Air: ${fmt(vehicleAir)} kg`);
    if (Number.isFinite(addlAir) && addlAir > 0) lines.push(`    Additional in Air: ${fmt(addlAir)} kg`);
    if (Number.isFinite(tmsWater) && tmsWater > 0) lines.push(`    TMS in Water: ${fmt(tmsWater)} kg`);
    if (Number.isFinite(vehicleWater) && vehicleWater > 0) lines.push(`    Vehicle in Water: ${fmt(vehicleWater)} kg`);
    if (Number.isFinite(addlWater) && addlWater > 0) lines.push(`    Additional in Water: ${fmt(addlWater)} kg`);
  }

  // Drivetrain
  const motors = safeRead('motors');
  const gr1 = safeRead('gr1');
  const gr2 = safeRead('gr2');
  const gbTorque = safeRead('gearbox_max_torque_Nm');
  const grTotal = (Number.isFinite(gr1) && Number.isFinite(gr2)) ? gr1 * gr2 : null;

  lines.push('');
  pushIf(lines, 'Number of Drive Motors', fmt(motors));
  const gearboxPreset = selectText('gearbox_select');
  pushIf(lines, 'Gearbox', gearboxPreset);
  pushIf(lines, 'Gear Ratio 1 (Gearbox)', fmt(gr1, 3));
  pushIf(lines, 'Gear Ratio 2 (External)', fmt(gr2, 3));
  pushIf(lines, 'Total Gear Ratio', fmt(grTotal, 2));
  if (Number.isFinite(gbTorque) && gbTorque > 0) {
    pushIf(lines, 'Gearbox Max Torque Rating', `${fmt(gbTorque)} N·m`);
  }

  // Electric inputs
  if (systemType === 'electric') {
    const motorEff = safeRead('motor_eff');
    const motorHp = safeRead('motor_hp');
    const motorRpm = safeRead('motor_max_rpm');
    const motorTmax = safeRead('motor_tmax');
    const motorKw = Number.isFinite(motorHp) ? motorHp * W_PER_HP / 1000 : null;

    lines.push('');
    pushIf(lines, 'Electro-Mechanical Efficiency', motorEff != null ? `${fmt(motorEff * 100)}%` : null);
    const motorPreset = selectText('electric_motor_select');
    pushIf(lines, 'Motor', motorPreset);
    pushIf(lines, 'Motor Rated Power', fmt(motorHp, 1) ? `${fmt(motorHp, 1)} HP (${fmt(motorKw, 1)} kW)` : null);
    pushIf(lines, 'Motor Maximum Speed', fmt(motorRpm) ? `${fmt(motorRpm)} RPM` : null);
    pushIf(lines, 'Motor Max Torque Rating', fmt(motorTmax) ? `${fmt(motorTmax)} N·m` : null);
  }

  // Hydraulic inputs
  if (systemType === 'hydraulic') {
    const hEff = safeRead('h_emotor_eff');
    const hMotCc = safeRead('h_hmot_cc');
    const hMotRpm = safeRead('h_hmot_rpm_max');
    const hStrings = safeRead('h_pump_strings');
    const hEmotorHp = safeRead('h_emotor_hp');
    const hEmotorRpm = safeRead('h_emotor_rpm');
    const hPumpCc = safeRead('h_pump_cc');
    const hMaxPsi = safeRead('h_max_psi');

    lines.push('');
    pushIf(lines, 'Electro-Hydro-Mechanical Efficiency', hEff != null ? `${fmt(hEff * 100)}%` : null);
    const hMotPreset = selectText('hydraulic_motor_select');
    pushIf(lines, 'Hydraulic Motor', hMotPreset);
    pushIf(lines, 'Hydraulic Motor Displacement', fmt(hMotCc) ? `${fmt(hMotCc)} cc/rev` : null);
    pushIf(lines, 'Hydraulic Motor Max Speed', fmt(hMotRpm) ? `${fmt(hMotRpm)} RPM` : null);

    lines.push('');
    pushIf(lines, 'Pump Strings', fmt(hStrings));
    const hpuMotorPreset = selectText('hpu_motor_select');
    pushIf(lines, 'HPU Motor', hpuMotorPreset);
    pushIf(lines, 'Electric Motor Power', fmt(hEmotorHp) ? `${fmt(hEmotorHp)} HP per string` : null);
    pushIf(lines, 'Electric Motor Speed', fmt(hEmotorRpm) ? `${fmt(hEmotorRpm)} RPM` : null);
    const pumpPreset = selectText('hydraulic_pump_select');
    pushIf(lines, 'Pump', pumpPreset);
    if (Number.isFinite(hPumpCc) && hPumpCc > 0) {
      pushIf(lines, 'Pump Displacement', `${fmt(hPumpCc)} cc/rev`);
    }
    pushIf(lines, 'Max System Pressure', fmt(hMaxPsi) ? `${fmt(hMaxPsi)} psi` : null);
  }

  lines.push('');
  lines.push('Generated by C-LARS Winch Analyzer');
  lines.push('');

  return lines.join('\n');
}

/**
 * Download the text summary as a .txt file.
 * @param {object|null} model - The last computed model
 */
export function downloadTextSummary(model) {
  const text = buildTextSummary(model);
  const projectName = q('project_name')?.value || 'winch';
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  const now = new Date();
  const ts = String(now.getFullYear()).slice(2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const filename = `${safeName}_Summary_${ts}.txt`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
