import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PDFDocument } from 'pdf-lib';
import { buildComputationModel } from '../src/js/analysis-data.mjs';
import { renderReportHtml } from '../src/js/report-renderer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.resolve(__dirname, '..', 'src');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PRESET_STORE = path.join(DATA_DIR, 'presets.json');
const LOCK_FILE = path.join(DATA_DIR, 'presets.lock');
const PROJECT_STORE = path.join(DATA_DIR, 'projects.json');
const PROJECT_LOCK_FILE = path.join(DATA_DIR, 'projects.lock');
const execFileAsync = promisify(execFile);

async function readLatestCommitTimestamp() {
  const repoRoot = path.resolve(__dirname, '..');
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI'], {
      cwd: repoRoot,
    });

    const isoTimestamp = stdout.trim();
    if (isoTimestamp) {
      return isoTimestamp;
    }
  } catch {
    // Fall through to non-git based timestamp providers.
  }

  if (process.env.LATEST_COMMIT_AT) {
    const envTimestamp = new Date(process.env.LATEST_COMMIT_AT);
    if (!Number.isNaN(envTimestamp.getTime())) {
      return envTimestamp.toISOString();
    }
  }

  if (process.env.SOURCE_DATE_EPOCH) {
    const epochSeconds = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(epochSeconds)) {
      return new Date(epochSeconds * 1000).toISOString();
    }
  }

  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageStats = await fs.stat(packageJsonPath);
  return packageStats.mtime.toISOString();
}

async function readLatestCommitHash() {
  const repoRoot = path.resolve(__dirname, '..');

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
    });

    const hash = stdout.trim();
    if (hash) {
      return hash;
    }
  } catch {
    // Fall through to non-git based version sources.
  }

  if (process.env.LATEST_COMMIT_HASH && process.env.LATEST_COMMIT_HASH.trim()) {
    return process.env.LATEST_COMMIT_HASH.trim();
  }

  if (process.env.SOURCE_VERSION && process.env.SOURCE_VERSION.trim()) {
    return process.env.SOURCE_VERSION.trim().slice(0, 12);
  }

  return 'unknown';
}

function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(STATIC_ROOT));

function sendError(res, statusCode, message, details) {
  res.status(statusCode).json({
    error: { message, ...(details ? { details } : {}) },
  });
}

function validatePresetPayload(payload) {
  const errors = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.push('Preset body must be a JSON object.');
    return { valid: false, errors };
  }

  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    errors.push('Preset "name" must be a non-empty string.');
  }

  if (payload.description !== undefined && typeof payload.description !== 'string') {
    errors.push('Preset "description" must be a string when provided.');
  }

  if (payload.data === undefined) {
    errors.push('Preset "data" field is required.');
  } else if (typeof payload.data !== 'object' || payload.data === null || Array.isArray(payload.data)) {
    errors.push('Preset "data" must be an object.');
  }

  if (payload.metadata !== undefined && (typeof payload.metadata !== 'object' || payload.metadata === null || Array.isArray(payload.metadata))) {
    errors.push('Preset "metadata" must be an object when provided.');
  }

  if (payload.id !== undefined && typeof payload.id !== 'string') {
    errors.push('Preset "id" must be a string when provided.');
  }

  return { valid: errors.length === 0, errors };
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PRESET_STORE);
  } catch (err) {
    await fs.writeFile(PRESET_STORE, '[]', 'utf8');
  }
}

async function ensureJsonStore(filePath) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(filePath);
  } catch (err) {
    await fs.writeFile(filePath, '[]', 'utf8');
  }
}

async function withFileLock(fn) {
  await ensureStore();
  let lockHandle;
  while (true) {
    try {
      lockHandle = await fs.open(LOCK_FILE, 'wx');
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        throw err;
      }
    }
  }

  try {
    return await fn();
  } finally {
    try {
      await lockHandle?.close();
    } catch (err) {
      console.error('Failed to close lock handle', err);
    }
    try {
      await fs.unlink(LOCK_FILE);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to remove lock file', err);
      }
    }
  }
}

async function readPresets() {
  await ensureStore();
  const raw = await fs.readFile(PRESET_STORE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Preset store is not an array');
    }
    return parsed;
  } catch (err) {
    throw new Error(`Unable to parse presets file: ${err.message}`);
  }
}

async function readProjects() {
  await ensureJsonStore(PROJECT_STORE);
  const raw = await fs.readFile(PROJECT_STORE, 'utf8');
  try {
    const parsed = JSON.parse(raw);

    // Accept both an array and a single project object so manually uploaded
    // project exports continue to work without additional editing.
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.projects)) {
        return parsed.projects;
      }

      if (typeof parsed.id === 'string' && typeof parsed.name === 'string' && parsed.state && typeof parsed.state === 'object' && !Array.isArray(parsed.state)) {
        return [parsed];
      }
    }

    throw new Error('Project store is not an array');
  } catch (err) {
    throw new Error(`Unable to parse projects file: ${err.message}`);
  }
}

async function writePresets(presets) {
  const tmpPath = `${PRESET_STORE}.tmp`;
  const serialized = JSON.stringify(presets, null, 2);
  await fs.writeFile(tmpPath, serialized, 'utf8');
  await fs.rename(tmpPath, PRESET_STORE);
}

async function writeProjects(projects) {
  const tmpPath = `${PROJECT_STORE}.tmp`;
  const serialized = JSON.stringify(projects, null, 2);
  await fs.writeFile(tmpPath, serialized, 'utf8');
  await fs.rename(tmpPath, PROJECT_STORE);
}

function validateProjectPayload(payload) {
  const errors = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.push('Project body must be a JSON object.');
    return { valid: false, errors };
  }

  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    errors.push('Project "name" must be a non-empty string.');
  }

  if (payload.description !== undefined && typeof payload.description !== 'string') {
    errors.push('Project "description" must be a string when provided.');
  }

  if (payload.state === undefined) {
    errors.push('Project "state" field is required.');
  } else if (typeof payload.state !== 'object' || payload.state === null || Array.isArray(payload.state)) {
    errors.push('Project "state" must be an object.');
  }

  if (payload.id !== undefined && typeof payload.id !== 'string') {
    errors.push('Project "id" must be a string when provided.');
  }

  return { valid: errors.length === 0, errors };
}

const REQUIRED_REPORT_STATE_NUMERIC_FIELDS = [
  'c_mm',
  'depth_m',
  'dead_m',
  'core_in',
  'flange_dia_in',
  'ftf_in',
  'lebus_in',
  'pack',
  'payload_kg',
  'c_w_kgpm',
  'gr1',
  'gr2',
  'motors',
  'motor_max_rpm',
  'motor_hp',
  'motor_eff',
  'motor_tmax',
  'gearbox_max_torque_Nm',
  'h_pump_strings',
  'h_emotor_hp',
  'h_emotor_eff',
  'h_emotor_rpm',
  'h_pump_cc',
  'h_max_psi',
  'h_hmot_cc',
  'h_hmot_rpm_max',
];

function stateNumber(state, key) {
  const raw = state[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    return parsed;
  }
  return Number.NaN;
}

function normalizeSystemType(rawSystemType) {
  return rawSystemType === 'hydraulic' ? 'hydraulic' : 'electric';
}

function validateReportStatePayload(payload) {
  const errors = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.push('Report body must be a JSON object containing the saved project state fields.');
    return { valid: false, errors };
  }

  REQUIRED_REPORT_STATE_NUMERIC_FIELDS.forEach((fieldName) => {
    if (payload[fieldName] === undefined) {
      errors.push(`Report state field "${fieldName}" is required.`);
      return;
    }

    if (!Number.isFinite(stateNumber(payload, fieldName))) {
      errors.push(`Report state field "${fieldName}" must be a finite number.`);
    }
  });

  if (payload.wraps_override !== undefined && payload.wraps_override !== '' && !Number.isFinite(stateNumber(payload, 'wraps_override'))) {
    errors.push('Report state field "wraps_override" must be a finite number when provided.');
  }

  if (payload.project_name !== undefined && typeof payload.project_name !== 'string') {
    errors.push('Report state field "project_name" must be a string when provided.');
  }

  if (payload.system_type_select !== undefined && payload.system_type_select !== 'electric' && payload.system_type_select !== 'hydraulic') {
    errors.push('Report state field "system_type_select" must be either "electric" or "hydraulic" when provided.');
  }

  return { valid: errors.length === 0, errors };
}

function buildModelFromProjectState(state) {
  const wrapsOverrideValue = stateNumber(state, 'wraps_override');
  const wraps_per_layer_override = Number.isFinite(wrapsOverrideValue) && wrapsOverrideValue > 0
    ? wrapsOverrideValue
    : undefined;
  const systemType = normalizeSystemType(state.system_type_select);

  return buildComputationModel({
    cable_dia_mm: stateNumber(state, 'c_mm'),
    operating_depth_m: stateNumber(state, 'depth_m'),
    dead_end_m: stateNumber(state, 'dead_m'),
    core_dia_in: stateNumber(state, 'core_in'),
    flange_dia_in: stateNumber(state, 'flange_dia_in'),
    flange_to_flange_in: stateNumber(state, 'ftf_in'),
    lebus_thk_in: stateNumber(state, 'lebus_in'),
    packing_factor: stateNumber(state, 'pack'),
    wraps_per_layer_override,
    payload_kg: stateNumber(state, 'payload_kg'),
    cable_w_kgpm: stateNumber(state, 'c_w_kgpm'),
    gr1: stateNumber(state, 'gr1'),
    gr2: stateNumber(state, 'gr2'),
    motors: stateNumber(state, 'motors'),
    electricEnabled: systemType === 'electric',
    hydraulicEnabled: systemType === 'hydraulic',
    motor_max_rpm: stateNumber(state, 'motor_max_rpm'),
    motor_hp: stateNumber(state, 'motor_hp'),
    motor_eff: stateNumber(state, 'motor_eff'),
    motor_tmax: stateNumber(state, 'motor_tmax'),
    gearbox_max_torque_Nm: stateNumber(state, 'gearbox_max_torque_Nm'),
    h_strings: stateNumber(state, 'h_pump_strings'),
    h_emotor_hp: stateNumber(state, 'h_emotor_hp'),
    h_emotor_eff: stateNumber(state, 'h_emotor_eff'),
    h_emotor_rpm: stateNumber(state, 'h_emotor_rpm'),
    h_pump_cc: stateNumber(state, 'h_pump_cc'),
    h_max_psi: stateNumber(state, 'h_max_psi'),
    h_hmot_cc: stateNumber(state, 'h_hmot_cc'),
    h_hmot_rpm_cap: stateNumber(state, 'h_hmot_rpm_max'),
  });
}


async function withProjectFileLock(fn) {
  await ensureJsonStore(PROJECT_STORE);
  let lockHandle;
  while (true) {
    try {
      lockHandle = await fs.open(PROJECT_LOCK_FILE, 'wx');
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        throw err;
      }
    }
  }

  try {
    return await fn();
  } finally {
    try {
      await lockHandle?.close();
    } catch (err) {
      console.error('Failed to close project lock handle', err);
    }
    try {
      await fs.unlink(PROJECT_LOCK_FILE);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to remove project lock file', err);
      }
    }
  }
}

app.get('/api/presets', async (req, res, next) => {
  try {
    const presets = await readPresets();
    res.json({ presets });
  } catch (err) {
    next(err);
  }
});

app.get('/api/presets/:id', async (req, res, next) => {
  try {
    const presets = await readPresets();
    const preset = presets.find((item) => item.id === req.params.id);
    if (!preset) {
      return sendError(res, 404, 'Preset not found.');
    }
    res.json({ preset });
  } catch (err) {
    next(err);
  }
});

app.post('/api/presets', async (req, res) => {
  return sendError(res, 405, 'Presets are hard-coded and read-only.');
});

app.delete('/api/presets/:id', async (req, res) => {
  return sendError(res, 405, 'Presets are hard-coded and read-only.');
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const projects = await readProjects();
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

app.get('/api/build-info', async (req, res, next) => {
  try {
    const [latestCommitAt, latestCommitHash] = await Promise.all([
      readLatestCommitTimestamp(),
      readLatestCommitHash(),
    ]);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    res.json({ latestCommitAt, latestCommitHash });
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'analyzer-api' });
});

app.get('/api/projects/:id', async (req, res, next) => {
  try {
    const projects = await readProjects();
    const project = projects.find((item) => item.id === req.params.id);
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

app.post('/api/projects', async (req, res, next) => {
  const payload = req.body;
  const { valid, errors } = validateProjectPayload(payload);
  if (!valid) {
    return sendError(res, 400, 'Invalid project payload.', errors);
  }

  const description =
    typeof payload.description === 'string' && payload.description.trim().length > 0
      ? payload.description.trim()
      : undefined;

  const timestamp = new Date().toISOString();
  const projectToSave = {
    id: payload.id && typeof payload.id === 'string' ? payload.id : generateId(),
    name: payload.name.trim(),
    ...(description ? { description } : {}),
    state: payload.state,
    updatedAt: timestamp,
  };

  try {
    const result = await withProjectFileLock(async () => {
      const projects = await readProjects();
      const existingIndex = projects.findIndex((item) => item.id === projectToSave.id);
      if (existingIndex >= 0) {
        const existingProject = projects[existingIndex];
        const mergedProject = {
          ...existingProject,
          ...projectToSave,
          createdAt: existingProject.createdAt ?? timestamp,
        };
        projects[existingIndex] = mergedProject;
        await writeProjects(projects);
        return { project: mergedProject, isNew: false };
      }

      const projectToInsert = { ...projectToSave, createdAt: timestamp };
      projects.push(projectToInsert);
      await writeProjects(projects);
      return { project: projectToInsert, isNew: true };
    });

    const status = result.isNew ? 201 : 200;
    res.status(status).json({ project: result.project });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/projects/:id', async (req, res, next) => {
  const projectId = req.params.id;
  try {
    const removed = await withProjectFileLock(async () => {
      const projects = await readProjects();
      const index = projects.findIndex((item) => item.id === projectId);
      if (index === -1) {
        return false;
      }
      projects.splice(index, 1);
      await writeProjects(projects);
      return true;
    });

    if (!removed) {
      return sendError(res, 404, 'Project not found.');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.post('/api/reports/html', async (req, res, next) => {
  const statePayload = req.body;
  const { valid, errors } = validateReportStatePayload(statePayload);
  if (!valid) {
    return sendError(res, 400, 'Invalid report payload.', errors);
  }

  try {
    const model = buildModelFromProjectState(statePayload);
    const generatedAt = new Date();
    const versionHash = await readLatestCommitHash();
    const reportTitle = `${String(statePayload.project_name || 'Untitled project').trim() || 'Untitled project'} - Winch Analyzer Report`;
    const html = renderReportHtml({ ...model, inputState: statePayload }, { generatedAt });

    res.json({
      html,
      metadata: {
        reportTitle,
        generatedAt: generatedAt.toISOString(),
        versionHash,
      },
    });
  } catch (err) {
    next(err);
  }
});


// ---- ABB Spec Sheet PDF generation ----

const SPEC_SHEET_TEMPLATE = path.join(DATA_DIR, 'abb-spec-sheet-template.pdf');
const MM_PER_IN = 25.4;
const KGF_TO_LBF = 2.20462;
const MPM_TO_FPM = 3.28084;
const SS_W_PER_HP = 745.7;

function ssFmt(v, decimals = 2) {
  if (v == null || !Number.isFinite(v)) return '';
  return (+v.toFixed(decimals)).toString();
}

function ssDual(inches) {
  if (!Number.isFinite(inches)) return '';
  return `${ssFmt(inches * MM_PER_IN, 1)} mm / ${ssFmt(inches, 2)} in`;
}

function ssForce(kgf) {
  if (!Number.isFinite(kgf)) return '';
  return `${ssFmt(kgf, 0)} kg / ${ssFmt(kgf * KGF_TO_LBF, 0)} lbs`;
}

function ssSpeed(mpm) {
  if (!Number.isFinite(mpm)) return '';
  return `${ssFmt(mpm, 1)} mpm / ${ssFmt(mpm * MPM_TO_FPM, 1)} fpm`;
}

app.post('/api/spec-sheet/pdf', async (req, res, next) => {
  const state = req.body;
  if (!state || typeof state !== 'object') {
    return sendError(res, 400, 'Request body must be a JSON object with analyzer state.');
  }

  try {
    // Build computation model from state
    const model = buildModelFromProjectState(state);

    const coreDiaIn = stateNumber(state, 'core_in');
    const ftfIn = stateNumber(state, 'ftf_in');
    const cableMm = stateNumber(state, 'c_mm');
    const efficiency = stateNumber(state, 'system_efficiency');
    const ratedSwlKgf = stateNumber(state, 'rated_swl_kgf');
    const ratedSpeedMpm = stateNumber(state, 'rated_speed_mpm');
    const motors = stateNumber(state, 'motors');
    const motorHp = stateNumber(state, 'motor_hp');
    const motorMaxRpm = stateNumber(state, 'motor_max_rpm');
    const gr1 = stateNumber(state, 'gr1');
    const gr2 = stateNumber(state, 'gr2');
    const totalLayers = model?.summary?.total_layers;
    const lightLoadKgf = Number.isFinite(ratedSwlKgf) ? ratedSwlKgf * 0.1 : NaN;
    const motorKw = Number.isFinite(motorHp) ? motorHp * SS_W_PER_HP / 1000 : NaN;

    // Max speed at light load from model rows
    let maxSpeedAtLightLoad = NaN;
    if (model?.rows?.length) {
      const lastRow = model.rows[model.rows.length - 1];
      if (model.electricEnabled) {
        maxSpeedAtLightLoad = lastRow?.el_speed_available_mpm ?? NaN;
      } else if (model.hydraulicEnabled) {
        maxSpeedAtLightLoad = lastRow?.hyd_speed_available_mpm ?? NaN;
      }
    }

    // Load template PDF
    const templateBytes = await fs.readFile(SPEC_SHEET_TEMPLATE);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const setText = (fieldName, value) => {
      try {
        const field = form.getTextField(fieldName);
        if (field && value) field.setText(String(value));
      } catch { /* field not found — skip */ }
    };

    const setCheck = (fieldName, checked) => {
      try {
        const field = form.getCheckBox(fieldName);
        if (field && checked) field.check();
      } catch { /* field not found — skip */ }
    };

    const projectName = typeof state.project_name === 'string' ? state.project_name : '';
    const today = new Date().toISOString().slice(0, 10);

    // Header
    setText('Customer Reference', projectName);
    setText('Dated', today);

    // Section 1 — Application checkboxes
    setCheck('Check Box LARS', true);

    // Section 3 — Drum Data
    setText('Bare Drum Dia mm  in', ssDual(coreDiaIn));
    setText('Drum Length mm  in', ssDual(ftfIn));
    setText('Rope Dia mm  in', Number.isFinite(cableMm)
      ? `${ssFmt(cableMm, 1)} mm / ${ssFmt(cableMm / MM_PER_IN, 3)} in`
      : '');
    setText('System Efficiency  Usually 90 or over', Number.isFinite(efficiency)
      ? `${ssFmt(efficiency * 100, 0)}%`
      : '');

    // Section 4a — Gearbox
    setText('Gearbox Ratio ratio', ssFmt(gr1, 3));

    // Section 4b — External Gearing (GR2 as ratio)
    // No dedicated ratio field — put in Small Gear Teeth with a note
    if (Number.isFinite(gr2) && gr2 > 0) {
      setText('Small Gear Teeth teeth For gearing ratio calculations', `Ratio: ${ssFmt(gr2, 3)}`);
    }

    // Section 5 — Load Specs
    setCheck('Check Box - Layer 0', true);
    setText('Rated Load kg  lbs', ssForce(ratedSwlKgf));
    setText('Maximum Continuous Speed at Rated Load mpm  fpm', ssSpeed(ratedSpeedMpm));
    setText('Light Load kg  lbs Usually light load is 10 to 30 of the rated load', ssForce(lightLoadKgf));
    setText('Maximum Control Speed at Light Load mpm  fpm', ssSpeed(maxSpeedAtLightLoad));
    setText('Maximum or Final Layer to be Wound', Number.isFinite(totalLayers) ? String(totalLayers) : '');

    // Section 6 — Motor Size
    setText('No. Motors', Number.isFinite(motors) ? ssFmt(motors, 0) : '');
    setText('Motor Power', Number.isFinite(motorKw)
      ? `${ssFmt(motorKw, 1)} kW / ${ssFmt(motorHp, 1)} HP`
      : '');
    setText('Motor RPM', Number.isFinite(motorMaxRpm) ? ssFmt(motorMaxRpm, 0) : '');

    // Section 9 — Comments
    const systemType = state.system_type_select === 'hydraulic' ? 'Hydraulic' : 'Electric';
    const winchType = state.winch_type_select === 'traction' ? 'Traction' : 'Conventional';
    const depth = stateNumber(state, 'depth_m');
    const payload = stateNumber(state, 'payload_kg');
    const cableW = stateNumber(state, 'c_w_kgpm');
    const mbl = stateNumber(state, 'mbl_kgf');
    const sf = stateNumber(state, 'safety_factor');
    const grTotal = (Number.isFinite(gr1) && Number.isFinite(gr2)) ? gr1 * gr2 : NaN;

    const commentLines = [
      `Generated by C-LARS Winch Analyzer on ${today}`,
      '',
      `Drive Type: ${systemType}`,
      `Winch Type: ${winchType}`,
      `Total Gear Ratio (GR1 x GR2): ${ssFmt(grTotal, 2)}`,
      `Operating Depth: ${ssFmt(depth, 0)} m`,
      `Payload in Water: ${ssFmt(payload, 0)} kg`,
      `Cable Weight in Water: ${ssFmt(cableW, 2)} kg/m`,
      `Min. Breaking Load: ${ssFmt(mbl, 0)} kgf`,
      `Safety Factor: ${ssFmt(sf, 1)}`,
    ];

    if (model?.hydraulicEnabled) {
      const hStrings = stateNumber(state, 'h_pump_strings');
      const hHp = stateNumber(state, 'h_emotor_hp');
      const hRpm = stateNumber(state, 'h_emotor_rpm');
      const hPump = stateNumber(state, 'h_pump_cc');
      const hPsi = stateNumber(state, 'h_max_psi');
      const hMot = stateNumber(state, 'h_hmot_cc');
      commentLines.push(
        '',
        'Hydraulic System:',
        `  Pump Strings: ${ssFmt(hStrings, 0)}`,
        `  E-Motor: ${ssFmt(hHp, 0)} HP @ ${ssFmt(hRpm, 0)} RPM`,
        `  Pump: ${ssFmt(hPump, 0)} cc/rev`,
        `  Max Pressure: ${ssFmt(hPsi, 0)} psi`,
        `  Hyd Motor: ${ssFmt(hMot, 0)} cc/rev`,
      );
    }

    setText('9 Comments  Notes Supply drawing or sketch of winch mechanics  dimensions separately if requiredRow1',
      commentLines.join('\n'));

    // Flatten form so fields show as printed text
    form.flatten();

    const pdfBytes = await pdfDoc.save();
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${(projectName || 'winch').replace(/[^a-zA-Z0-9_-]/g, '_')}_ABB_SpecSheet_${today}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    next(err);
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    return res.sendFile(path.join(STATIC_ROOT, 'index.html'));
  }
  return sendError(res, 404, 'Not found.');
});

app.use((err, req, res, next) => {
  console.error(err);
  sendError(res, 500, 'Internal server error.');
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
