// ===== spec-sheet-export.mjs — ABB Smart Winch Spec Sheet CSV export =====
//
// Generates a CSV with all fields from the ABB Smart Winch (+N5800)
// Specification Sheet (rev 2e) that can be derived from the analyzer state.

import { q, read } from './utils.mjs';

const MM_PER_IN = 25.4;
const KGF_TO_LBF = 2.20462;
const MPM_TO_FPM = 3.28084;
const W_PER_HP = 745.7;

function safeRead(id) {
  try { return read(id); } catch { return null; }
}

function fmt(v, decimals = 2) {
  if (v == null || !Number.isFinite(v)) return '';
  return (+v.toFixed(decimals)).toString();
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(section, field, value, units) {
  return [section, field, csvEscape(value), units || ''].join(',');
}

/**
 * Build spec sheet CSV rows from the current analyzer state.
 * @param {object|null} model - The last computed model from buildComputationModel()
 */
export function buildSpecSheetCSV(model) {
  const projectName = q('project_name')?.value || '';
  const systemType = q('system_type_select')?.value || '';
  const winchType = q('winch_type_select')?.value || '';

  // Drum
  const coreDiaIn = safeRead('core_in');
  const flangeDiaIn = safeRead('flange_dia_in');
  const ftfIn = safeRead('ftf_in');
  const cableDiaMm = safeRead('c_mm');
  const efficiency = safeRead('system_efficiency');

  // Load
  const ratedSwlKgf = safeRead('rated_swl_kgf');
  const ratedSpeedMpm = safeRead('rated_speed_mpm');
  const payloadKg = safeRead('payload_kg');

  // Drive
  const motors = safeRead('motors');
  const motorHp = safeRead('motor_hp');
  const motorMaxRpm = safeRead('motor_max_rpm');
  const motorTmax = safeRead('motor_tmax');
  const gr1 = safeRead('gr1');
  const gr2 = safeRead('gr2');
  const gearboxMaxTorque = safeRead('gearbox_max_torque_Nm');

  // Computed
  const totalLayers = model?.summary?.total_layers ?? null;

  // Light load (10% of rated)
  const lightLoadKgf = ratedSwlKgf != null ? ratedSwlKgf * 0.1 : null;

  // Max speed at light load from model
  let maxSpeedAtLightLoad = null;
  if (model?.rows?.length && model.electricEnabled) {
    maxSpeedAtLightLoad = model.rows[model.rows.length - 1]?.el_speed_available_mpm ?? null;
  } else if (model?.rows?.length && model.hydraulicEnabled) {
    maxSpeedAtLightLoad = model.rows[model.rows.length - 1]?.hyd_speed_available_mpm ?? null;
  }

  // Motor kW
  const motorKw = motorHp != null ? motorHp * W_PER_HP / 1000 : null;

  // Hydraulic
  const hStrings = safeRead('h_pump_strings');
  const hEmotorHp = safeRead('h_emotor_hp');
  const hEmotorRpm = safeRead('h_emotor_rpm');
  const hPumpCc = safeRead('h_pump_cc');
  const hMaxPsi = safeRead('h_max_psi');
  const hHmotCc = safeRead('h_hmot_cc');

  const today = new Date().toISOString().slice(0, 10);

  const rows = [
    'Section,Field,Value,Units',

    csvRow('Header', 'Customer Reference', projectName, ''),
    csvRow('Header', 'Date', today, ''),
    csvRow('Header', 'System Type', systemType, ''),
    csvRow('Header', 'Winch Type', winchType, ''),

    '',
    csvRow('3. Drum Data', 'Bare Drum Dia', fmt(coreDiaIn != null ? coreDiaIn * MM_PER_IN : null, 1), 'mm'),
    csvRow('3. Drum Data', 'Bare Drum Dia', fmt(coreDiaIn, 2), 'in'),
    csvRow('3. Drum Data', 'Drum Length (flange-to-flange)', fmt(ftfIn != null ? ftfIn * MM_PER_IN : null, 1), 'mm'),
    csvRow('3. Drum Data', 'Drum Length (flange-to-flange)', fmt(ftfIn, 2), 'in'),
    csvRow('3. Drum Data', 'Bare Drum Inner Dia', '', 'mm / in'),
    csvRow('3. Drum Data', 'Rope Dia', fmt(cableDiaMm, 1), 'mm'),
    csvRow('3. Drum Data', 'Rope Dia', fmt(cableDiaMm != null ? cableDiaMm / MM_PER_IN : null, 3), 'in'),
    csvRow('3. Drum Data', 'System Efficiency', fmt(efficiency != null ? efficiency * 100 : null, 0), '%'),

    '',
    csvRow('4a. Gearbox', 'Gearbox Ratio (GR1)', fmt(gr1, 3), 'ratio'),
    csvRow('4a. Gearbox', 'Gearbox Max Torque', fmt(gearboxMaxTorque, 0), 'N-m'),
    csvRow('4a. Gearbox', 'Gearbox Location', '', 'Motor Shaft / Drum Shaft'),
    csvRow('4a. Gearbox', 'Can we change this ratio', '', 'Yes / No'),

    '',
    csvRow('4b. External Gearing', 'Gearing Ratio (GR2)', fmt(gr2, 3), 'ratio'),
    csvRow('4b. External Gearing', 'Small Gear Teeth', '', 'teeth'),
    csvRow('4b. External Gearing', 'Large Gear Teeth', '', 'teeth'),
    csvRow('4b. External Gearing', 'Large Gear Dia', '', 'mm / in'),
    csvRow('4b. External Gearing', 'Large Gear Width', '', 'mm / in'),
    csvRow('4b. External Gearing', 'External Gearing Location', '', 'Motor Shaft / Drum Shaft'),
    csvRow('4b. External Gearing', 'Can we change this ratio', '', 'Yes / No'),

    '',
    csvRow('5. Load Specs', 'Specification Layer', 'Layer 0 (Bare Drum)', ''),
    csvRow('5. Load Specs', 'Rated Load', fmt(ratedSwlKgf, 0), 'kg'),
    csvRow('5. Load Specs', 'Rated Load', fmt(ratedSwlKgf != null ? ratedSwlKgf * KGF_TO_LBF : null, 0), 'lbs'),
    csvRow('5. Load Specs', 'Max Continuous Speed at Rated Load', fmt(ratedSpeedMpm, 1), 'mpm'),
    csvRow('5. Load Specs', 'Max Continuous Speed at Rated Load', fmt(ratedSpeedMpm != null ? ratedSpeedMpm * MPM_TO_FPM : null, 1), 'fpm'),
    csvRow('5. Load Specs', 'Light Load (est. 10% of rated)', fmt(lightLoadKgf, 0), 'kg'),
    csvRow('5. Load Specs', 'Light Load (est. 10% of rated)', fmt(lightLoadKgf != null ? lightLoadKgf * KGF_TO_LBF : null, 0), 'lbs'),
    csvRow('5. Load Specs', 'Max Control Speed at Light Load', fmt(maxSpeedAtLightLoad, 1), 'mpm'),
    csvRow('5. Load Specs', 'Max Control Speed at Light Load', fmt(maxSpeedAtLightLoad != null ? maxSpeedAtLightLoad * MPM_TO_FPM : null, 1), 'fpm'),
    csvRow('5. Load Specs', 'Maximum or Final Layer', fmt(totalLayers, 0), ''),

    '',
    csvRow('6. Motor Size', 'Total Motors', fmt(motors, 0), ''),
    csvRow('6. Motor Size', 'kW Rated Per Motor', fmt(motorKw, 1), 'kW'),
    csvRow('6. Motor Size', 'HP Rated Per Motor', fmt(motorHp, 1), 'HP'),
    csvRow('6. Motor Size', 'RPM Rated', fmt(motorMaxRpm, 0), 'rpm'),
    csvRow('6. Motor Size', 'Volts Rated', '', 'V'),
    csvRow('6. Motor Size', 'Hz Rated', '', 'Hz'),
    csvRow('6. Motor Size', 'Motor Max Torque', fmt(motorTmax, 0), 'N-m'),

    '',
    csvRow('2. General', 'Supply Voltage & Hz', '', ''),
    csvRow('2. General', 'Ambient Temp - Drive Cabinet', '', 'C'),
    csvRow('2. General', 'Ambient Temp - Motor Location', '', 'C'),
    csvRow('2. General', 'Marine Regulations', '', ''),

    '',
    csvRow('7. Options', 'Motor used as brake', '', 'Yes / No'),
    csvRow('7. Options', 'Auto Haul & Payout', '', 'Yes / No'),
    csvRow('7. Options', 'AHC (Active Heave Compensation)', '', 'Yes / No'),

    '',
    csvRow('8. Encoder', 'Encoder Mount Location', '', 'Motor Shaft / Drum Shaft'),
    csvRow('8. Encoder', 'Clutch Used', '', 'Yes / No'),
    csvRow('8. Encoder', 'Spooling Symmetry', '', '1-10'),
    csvRow('8. Encoder', 'External Measure Device', '', 'Yes / No'),

    '',
    csvRow('9. Comments', 'Drive Type', systemType === 'electric' ? 'Electric' : systemType === 'hydraulic' ? 'Hydraulic' : systemType, ''),
    csvRow('9. Comments', 'Total Gear Ratio (GR1 x GR2)', fmt(gr1 && gr2 ? gr1 * gr2 : null, 2), 'ratio'),
    csvRow('9. Comments', 'Operating Depth', fmt(safeRead('depth_m'), 0), 'm'),
    csvRow('9. Comments', 'Payload in Water', fmt(payloadKg, 0), 'kg'),
    csvRow('9. Comments', 'Cable Weight in Water', fmt(safeRead('c_w_kgpm'), 2), 'kg/m'),
    csvRow('9. Comments', 'Minimum Breaking Load', fmt(safeRead('mbl_kgf'), 0), 'kgf'),
    csvRow('9. Comments', 'Safety Factor', fmt(safeRead('safety_factor'), 1), ''),
  ];

  // Add hydraulic details if enabled
  if (model?.hydraulicEnabled) {
    rows.push('');
    rows.push(csvRow('9. Hydraulic Details', 'Pump Strings', fmt(hStrings, 0), ''));
    rows.push(csvRow('9. Hydraulic Details', 'Electric Motor HP (per string)', fmt(hEmotorHp, 0), 'HP'));
    rows.push(csvRow('9. Hydraulic Details', 'Electric Motor RPM', fmt(hEmotorRpm, 0), 'rpm'));
    rows.push(csvRow('9. Hydraulic Details', 'Pump Displacement', fmt(hPumpCc, 0), 'cc/rev'));
    rows.push(csvRow('9. Hydraulic Details', 'Max System Pressure', fmt(hMaxPsi, 0), 'psi'));
    rows.push(csvRow('9. Hydraulic Details', 'Hydraulic Motor Displacement', fmt(hHmotCc, 0), 'cc/rev'));
  }

  return rows.join('\n');
}

/**
 * Download spec sheet as CSV file.
 */
export function downloadSpecSheetCSV(model) {
  const csv = buildSpecSheetCSV(model);
  const projectName = q('project_name')?.value || 'winch';
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${safeName}_ABB_SpecSheet_${today}.csv`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
