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
  if (v == null || !Number.isFinite(v)) return '—';
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function selectText(id) {
  const el = q(id);
  if (!el) return '—';
  if (el.tagName === 'SELECT') {
    const opt = el.options[el.selectedIndex];
    return opt ? opt.textContent.trim() : el.value;
  }
  return el.value || '—';
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
  const hr = '─'.repeat(50);

  lines.push('C-LARS Winch Analysis Report');
  lines.push(projectName);
  lines.push(today);
  lines.push('');
  lines.push(hr);
  lines.push('SYSTEM');
  lines.push(hr);
  lines.push(`System Type: ${systemLabel}`);
  lines.push(`Winch Type: ${winchLabel}`);
  lines.push(`Active Heave Compensation: ${ahcEnabled ? 'Yes' : 'No'}`);

  // Design
  const swl = safeRead('rated_swl_kgf');
  const speed = safeRead('rated_speed_mpm');
  const eff = safeRead('system_efficiency');

  lines.push('');
  lines.push(hr);
  lines.push('DESIGN');
  lines.push(hr);
  lines.push(`Safe Working Load: ${fmt(swl)} kgf (${fmt(swl != null ? swl * KGF_TO_LBF : null)} lbs)`);
  lines.push(`Rated Line Speed: ${fmt(speed)} m/min`);
  lines.push(`System Efficiency: ${fmt(eff != null ? eff * 100 : null)}%`);

  // Cable
  const cableMm = safeRead('c_mm');
  const cableLen = safeRead('cable_len_m');
  const depth = safeRead('depth_m');
  const dead = safeRead('dead_m');
  const cableW = safeRead('c_w_kgpm');
  const mbl = safeRead('mbl_kgf');
  const sf = safeRead('safety_factor');

  lines.push('');
  lines.push(hr);
  lines.push('CABLE');
  lines.push(hr);
  const cableSelect = selectText('cable_select');
  if (cableSelect && cableSelect !== 'Custom (manual input)' && cableSelect !== '—') {
    lines.push(`Cable: ${cableSelect}`);
  }
  lines.push(`Cable Diameter: ${fmt(cableMm, 1)} mm`);
  lines.push(`Cable Length: ${fmt(cableLen)} m`);
  lines.push(`Max Operating Depth: ${fmt(depth)} m`);
  lines.push(`Dead End Length: ${fmt(dead)} m`);
  lines.push(`Cable Weight in Water: ${fmt(cableW, 2)} kg/m`);
  lines.push(`Minimum Breaking Load: ${fmt(mbl)} kgf`);
  lines.push(`Safety Factor: ${fmt(sf, 1)}`);

  // Drum
  const coreIn = safeRead('core_in');
  const flangeIn = safeRead('flange_dia_in');
  const ftfIn = safeRead('ftf_in');
  const lebusIn = safeRead('lebus_in');
  const pack = safeRead('pack');
  const wrapsOverride = safeRead('wraps_override');

  lines.push('');
  lines.push(hr);
  lines.push('DRUM');
  lines.push(hr);
  const drumSelect = selectText('drum_select');
  if (drumSelect && drumSelect !== 'Custom (manual input)' && drumSelect !== '—') {
    lines.push(`Drum: ${drumSelect}`);
  }
  lines.push(`Core Diameter: ${fmt(coreIn, 2)} in (${fmt(coreIn != null ? coreIn * MM_PER_IN : null, 1)} mm)`);
  lines.push(`Flange Diameter: ${fmt(flangeIn, 2)} in (${fmt(flangeIn != null ? flangeIn * MM_PER_IN : null, 1)} mm)`);
  lines.push(`Flange-to-Flange Width: ${fmt(ftfIn, 2)} in (${fmt(ftfIn != null ? ftfIn * MM_PER_IN : null, 1)} mm)`);
  lines.push(`Lebus Liner Thickness: ${fmt(lebusIn, 3)} in`);
  lines.push(`Packing Factor: ${fmt(pack, 3)}`);
  if (Number.isFinite(wrapsOverride) && wrapsOverride > 0) {
    lines.push(`Wraps per Layer: ${fmt(wrapsOverride, 1)} (override)`);
  } else {
    lines.push(`Wraps per Layer: auto`);
  }

  // Computed drum results
  if (model?.summary) {
    const s = model.summary;
    lines.push(`Total Layers: ${s.total_layers ?? '—'}`);
    lines.push(`Full Drum Diameter: ${fmt(s.full_drum_dia_in, 2)} in`);
    lines.push(`Total Cable Length: ${fmt(s.total_cable_len_m)} m`);
  }

  // Payload
  const payloadAir = safeRead('payload_air_kg');
  const payloadWater = safeRead('payload_kg');

  lines.push('');
  lines.push(hr);
  lines.push('PAYLOAD');
  lines.push(hr);
  const payloadSelect = selectText('payload_select');
  if (payloadSelect && payloadSelect !== 'Custom (manual input)' && payloadSelect !== '—') {
    lines.push(`Payload: ${payloadSelect}`);
  }
  if (Number.isFinite(payloadAir) && payloadAir > 0) {
    lines.push(`Payload in Air: ${fmt(payloadAir)} kg`);
  }
  lines.push(`Payload in Water: ${fmt(payloadWater)} kg`);

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
  lines.push(hr);
  lines.push('DRIVETRAIN');
  lines.push(hr);
  lines.push(`Number of Drive Motors: ${fmt(motors)}`);
  const gearboxSelect = selectText('gearbox_select');
  if (gearboxSelect && gearboxSelect !== 'Custom (manual input)' && gearboxSelect !== '—') {
    lines.push(`Gearbox: ${gearboxSelect}`);
  }
  lines.push(`Gear Ratio 1 (Gearbox): ${fmt(gr1, 3)}`);
  lines.push(`Gear Ratio 2 (External): ${fmt(gr2, 3)}`);
  lines.push(`Total Gear Ratio: ${fmt(grTotal, 2)}`);
  if (Number.isFinite(gbTorque) && gbTorque > 0) {
    lines.push(`Gearbox Max Torque Rating: ${fmt(gbTorque)} N·m`);
  }

  // Electric inputs
  if (systemType === 'electric') {
    const motorEff = safeRead('motor_eff');
    const motorHp = safeRead('motor_hp');
    const motorRpm = safeRead('motor_max_rpm');
    const motorTmax = safeRead('motor_tmax');
    const motorKw = Number.isFinite(motorHp) ? motorHp * W_PER_HP / 1000 : null;

    lines.push('');
    lines.push(hr);
    lines.push('ELECTRIC DRIVE');
    lines.push(hr);
    lines.push(`Electro-Mechanical Efficiency: ${fmt(motorEff != null ? motorEff * 100 : null)}%`);
    const motorSelect = selectText('electric_motor_select');
    if (motorSelect && motorSelect !== 'Custom (manual input)' && motorSelect !== '—') {
      lines.push(`Motor: ${motorSelect}`);
    }
    lines.push(`Motor Rated Power: ${fmt(motorHp, 1)} HP (${fmt(motorKw, 1)} kW)`);
    lines.push(`Motor Maximum Speed: ${fmt(motorRpm)} RPM`);
    lines.push(`Motor Max Torque Rating: ${fmt(motorTmax)} N·m`);
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
    lines.push(hr);
    lines.push('HYDRAULIC DRIVE');
    lines.push(hr);
    lines.push(`Electro-Hydro-Mechanical Efficiency: ${fmt(hEff != null ? hEff * 100 : null)}%`);
    const hMotSelect = selectText('hydraulic_motor_select');
    if (hMotSelect && hMotSelect !== 'Custom (manual input)' && hMotSelect !== '—') {
      lines.push(`Hydraulic Motor: ${hMotSelect}`);
    }
    lines.push(`Hydraulic Motor Displacement: ${fmt(hMotCc)} cc/rev`);
    lines.push(`Hydraulic Motor Max Speed: ${fmt(hMotRpm)} RPM`);

    lines.push('');
    lines.push('  HPU:');
    lines.push(`    Pump Strings: ${fmt(hStrings)}`);
    const hpuMotorSelect = selectText('hpu_motor_select');
    if (hpuMotorSelect && hpuMotorSelect !== 'Custom (manual input)' && hpuMotorSelect !== '—') {
      lines.push(`    HPU Motor: ${hpuMotorSelect}`);
    }
    lines.push(`    Electric Motor Power: ${fmt(hEmotorHp)} HP per string`);
    lines.push(`    Electric Motor Speed: ${fmt(hEmotorRpm)} RPM`);
    const pumpSelect = selectText('hydraulic_pump_select');
    if (pumpSelect && pumpSelect !== 'Custom (manual input)' && pumpSelect !== '—') {
      lines.push(`    Pump: ${pumpSelect}`);
    }
    if (Number.isFinite(hPumpCc) && hPumpCc > 0) {
      lines.push(`    Pump Displacement: ${fmt(hPumpCc)} cc/rev`);
    }
    lines.push(`    Max System Pressure: ${fmt(hMaxPsi)} psi`);
  }

  lines.push('');
  lines.push(hr);
  lines.push(`Generated by C-LARS Winch Analyzer`);
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
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${safeName}_Analysis_${today}.txt`;

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
