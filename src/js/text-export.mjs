// ===== text-export.mjs — Plain-text summary export of analyzer inputs =====

import { q, read } from './utils.mjs';
import { fromInternal, fromInternalForGroup, getGroupLabel, FIELD_UNITS } from './units.mjs';

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

/** Read a field's value converted to its current display unit, return { val, label }. */
function fieldDisplay(id, decimals = 0) {
  const raw = safeRead(id);
  if (!Number.isFinite(raw)) return { val: null, label: '' };
  const groupName = FIELD_UNITS[id];
  if (!groupName) return { val: fmt(raw, decimals), label: '' };
  const converted = fromInternal(id, raw);
  const unitLabel = getGroupLabel(groupName);
  return { val: fmt(converted, decimals), label: unitLabel };
}

/**
 * Build a plain-text summary of all analyzer inputs.
 * @param {object|null} model - The last computed model
 */
export function buildTextSummaryLines(model) {
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
  lines.push('');
  const swlBdD = fieldDisplay('swl_bd_kgf');
  pushIf(lines, 'SWL at Bare Drum', swlBdD.val ? `${swlBdD.val} ${swlBdD.label}` : null);
  const swlFdD = fieldDisplay('swl_fd_kgf');
  pushIf(lines, 'SWL at Full Drum', swlFdD.val ? `${swlFdD.val} ${swlFdD.label}` : null);
  const speedD = fieldDisplay('rated_speed_mpm');
  pushIf(lines, 'Rated Line Speed', speedD.val ? `${speedD.val} ${speedD.label}` : null);

  // Cable
  lines.push('');
  const cablePreset = selectText('cable_select');
  pushIf(lines, 'Cable', cablePreset);
  const cableDia = fieldDisplay('c_mm', 1);
  pushIf(lines, 'Cable Diameter', cableDia.val ? `${cableDia.val} ${cableDia.label}` : null);
  const cableLen = fieldDisplay('cable_len_m');
  pushIf(lines, 'Cable Length', cableLen.val ? `${cableLen.val} ${cableLen.label}` : null);
  const depthD = fieldDisplay('depth_m');
  pushIf(lines, 'Max Operating Depth', depthD.val ? `${depthD.val} ${depthD.label}` : null);
  const deadD = fieldDisplay('dead_m');
  pushIf(lines, 'Dead End Length', deadD.val ? `${deadD.val} ${deadD.label}` : null);
  const cableW = fieldDisplay('c_w_kgpm', 2);
  pushIf(lines, 'Cable Weight in Water', cableW.val ? `${cableW.val} ${cableW.label}` : null);
  const mblD = fieldDisplay('mbl_kgf');
  pushIf(lines, 'Minimum Breaking Load', mblD.val ? `${mblD.val} ${mblD.label}` : null);

  // Drum
  const pack = safeRead('pack');
  const wrapsOverride = safeRead('wraps_override');
  const calcWraps = model?.meta?.wraps_per_layer_calc;
  const usedWraps = model?.meta?.wraps_per_layer_used;

  lines.push('');
  const drumPreset = selectText('drum_select');
  pushIf(lines, 'Drum', drumPreset);
  const coreD = fieldDisplay('core_in', 2);
  pushIf(lines, 'Core Diameter', coreD.val ? `${coreD.val} ${coreD.label}` : null);
  const flangeD = fieldDisplay('flange_dia_in', 2);
  pushIf(lines, 'Flange Diameter', flangeD.val ? `${flangeD.val} ${flangeD.label}` : null);
  const ftfD = fieldDisplay('ftf_in', 2);
  pushIf(lines, 'Flange-to-Flange Width', ftfD.val ? `${ftfD.val} ${ftfD.label}` : null);
  const lebusD = fieldDisplay('lebus_in', 3);
  pushIf(lines, 'Lebus Liner Thickness', lebusD.val ? `${lebusD.val} ${lebusD.label}` : null);
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
    if (Number.isFinite(s.full_drum_dia_in)) {
      const diaVal = fromInternalForGroup('length_in', s.full_drum_dia_in);
      pushIf(lines, 'Full Drum Diameter', `${fmt(diaVal, 2)} ${getGroupLabel('length_in')}`);
    }
    if (Number.isFinite(s.total_cable_len_m)) {
      const lenVal = fromInternalForGroup('length_m', s.total_cable_len_m);
      pushIf(lines, 'Total Cable Length', `${fmt(lenVal)} ${getGroupLabel('length_m')}`);
    }
  }

  // Payload
  lines.push('');
  const payloadPreset = selectText('payload_select');
  pushIf(lines, 'Payload', payloadPreset);
  const payloadAirD = fieldDisplay('payload_air_kg');
  const payloadAirRaw = safeRead('payload_air_kg');
  if (Number.isFinite(payloadAirRaw) && payloadAirRaw > 0) {
    pushIf(lines, 'Payload in Air', `${payloadAirD.val} ${payloadAirD.label}`);
  }
  const payloadWaterD = fieldDisplay('payload_kg');
  pushIf(lines, 'Payload in Water', payloadWaterD.val ? `${payloadWaterD.val} ${payloadWaterD.label}` : null);

  // Payload breakdown (only if filled)
  const massLabel = getGroupLabel('mass_kg');
  const breakdownFields = [
    ['tms_air_kg', 'TMS in Air'], ['vehicle_air_kg', 'Vehicle in Air'], ['additional_air_kg', 'Additional in Air'],
    ['tms_water_kg', 'TMS in Water'], ['vehicle_water_kg', 'Vehicle in Water'], ['additional_water_kg', 'Additional in Water'],
  ];
  const hasBreakdown = breakdownFields.some(([id]) => {
    const v = safeRead(id);
    return Number.isFinite(v) && v > 0;
  });

  if (hasBreakdown) {
    lines.push('');
    lines.push('  Payload Breakdown:');
    for (const [id, label] of breakdownFields) {
      const d = fieldDisplay(id);
      const raw = safeRead(id);
      if (Number.isFinite(raw) && raw > 0) lines.push(`    ${label}: ${d.val} ${d.label}`);
    }
  }

  // Drivetrain
  const motors = safeRead('motors');
  const gr1 = safeRead('gr1');
  const gr2 = safeRead('gr2');
  const grTotal = (Number.isFinite(gr1) && Number.isFinite(gr2)) ? gr1 * gr2 : null;

  lines.push('');
  pushIf(lines, 'Number of Drive Motors', fmt(motors));
  const gearboxPreset = selectText('gearbox_select');
  pushIf(lines, 'Gearbox', gearboxPreset);
  pushIf(lines, 'Gear Ratio 1 (Gearbox)', fmt(gr1, 3));
  pushIf(lines, 'Gear Ratio 2 (External)', fmt(gr2, 3));
  pushIf(lines, 'Total Gear Ratio', fmt(grTotal, 2));
  const gbTorqueD = fieldDisplay('gearbox_max_torque_Nm');
  const gbTorqueRaw = safeRead('gearbox_max_torque_Nm');
  if (Number.isFinite(gbTorqueRaw) && gbTorqueRaw > 0) {
    pushIf(lines, 'Gearbox Max Torque Rating', `${gbTorqueD.val} ${gbTorqueD.label}`);
  }

  // Electric inputs
  if (systemType === 'electric') {
    const motorEff = safeRead('motor_eff');

    lines.push('');
    pushIf(lines, 'System Efficiency (Electric)', motorEff != null ? `${fmt(motorEff * 100)}%` : null);
    const motorPreset = selectText('electric_motor_select');
    pushIf(lines, 'Motor', motorPreset);
    const motorPwrD = fieldDisplay('motor_hp', 1);
    pushIf(lines, 'Motor Rated Power', motorPwrD.val ? `${motorPwrD.val} ${motorPwrD.label}` : null);
    const motorRpm = safeRead('motor_max_rpm');
    pushIf(lines, 'Motor Maximum Speed', fmt(motorRpm) ? `${fmt(motorRpm)} RPM` : null);
    const motorTmaxD = fieldDisplay('motor_tmax');
    pushIf(lines, 'Motor Max Torque Rating', motorTmaxD.val ? `${motorTmaxD.val} ${motorTmaxD.label}` : null);
  }

  // Hydraulic inputs
  if (systemType === 'hydraulic') {
    const hEff = safeRead('h_emotor_eff');
    const hMotCcRaw = safeRead('h_hmot_cc');
    const hMotCcMinRaw = safeRead('h_hmot_cc_min');
    const hMotRpm = safeRead('h_hmot_rpm_max');
    const hStrings = safeRead('h_pump_strings');
    const hEmotorRpm = safeRead('h_emotor_rpm');

    lines.push('');
    pushIf(lines, 'System Efficiency (Hydraulic)', hEff != null ? `${fmt(hEff * 100)}%` : null);
    const hMotPreset = selectText('hydraulic_motor_select');
    pushIf(lines, 'Hydraulic Motor', hMotPreset);
    const hMotD = fieldDisplay('h_hmot_cc');
    const hMotMinD = fieldDisplay('h_hmot_cc_min');
    const isVariable = Number.isFinite(hMotCcMinRaw) && hMotCcMinRaw > 0 && hMotCcMinRaw < hMotCcRaw;
    pushIf(lines, 'Motor Displacement (Max)', hMotD.val ? `${hMotD.val} ${hMotD.label}` : null);
    if (isVariable) pushIf(lines, 'Motor Displacement (Min)', hMotMinD.val ? `${hMotMinD.val} ${hMotMinD.label}` : null);
    pushIf(lines, 'Hydraulic Motor Max Speed', fmt(hMotRpm) ? `${fmt(hMotRpm)} RPM` : null);

    lines.push('');
    pushIf(lines, 'Pump Strings', fmt(hStrings));
    const hpuMotorPreset = selectText('hpu_motor_select');
    pushIf(lines, 'HPU Motor', hpuMotorPreset);
    const hEmotorPwrD = fieldDisplay('h_emotor_hp');
    pushIf(lines, 'Electric Motor Power', hEmotorPwrD.val ? `${hEmotorPwrD.val} ${hEmotorPwrD.label} per string` : null);
    pushIf(lines, 'Electric Motor Speed', fmt(hEmotorRpm) ? `${fmt(hEmotorRpm)} RPM` : null);
    const pumpPreset = selectText('hydraulic_pump_select');
    pushIf(lines, 'Pump', pumpPreset);
    const hPumpD = fieldDisplay('h_pump_cc');
    const hPumpRaw = safeRead('h_pump_cc');
    if (Number.isFinite(hPumpRaw) && hPumpRaw > 0) {
      pushIf(lines, 'Pump Displacement', `${hPumpD.val} ${hPumpD.label}`);
    }
    const hPsiD = fieldDisplay('h_max_psi');
    pushIf(lines, 'Max System Pressure', hPsiD.val ? `${hPsiD.val} ${hPsiD.label}` : null);
  }

  lines.push('');

  return lines;
}

/**
 * Build a plain-text summary of all analyzer inputs (joined string).
 * @param {object|null} model - The last computed model
 */
export function buildTextSummary(model) {
  return buildTextSummaryLines(model).join('\n');
}

/**
 * Download the text summary as a .txt file.
 * @param {object|null} model - The last computed model
 */
export function downloadTextSummary(model) {
  const lines = buildTextSummaryLines(model);
  downloadLines(lines);
}

/**
 * Download selected lines as a .txt file.
 * @param {string[]} lines
 */
export function downloadLines(lines) {
  const text = lines.join('\n');
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
