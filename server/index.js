import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
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
    if (!Array.isArray(parsed)) {
      throw new Error('Project store is not an array');
    }
    return parsed;
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

app.post('/api/presets', async (req, res, next) => {
  const payload = req.body;
  const { valid, errors } = validatePresetPayload(payload);
  if (!valid) {
    return sendError(res, 400, 'Invalid preset payload.', errors);
  }

  const description =
    typeof payload.description === 'string' && payload.description.trim().length > 0
      ? payload.description.trim()
      : undefined;

  const timestamp = new Date().toISOString();
  const presetToSave = {
    id: payload.id && typeof payload.id === 'string' ? payload.id : generateId(),
    name: payload.name.trim(),
    ...(description ? { description } : {}),
    data: payload.data,
    ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
    updatedAt: timestamp,
  };

  try {
    const result = await withFileLock(async () => {
      const presets = await readPresets();
      const existingIndex = presets.findIndex((item) => item.id === presetToSave.id);
      if (existingIndex >= 0) {
        const existingPreset = presets[existingIndex];
        const mergedPreset = {
          ...existingPreset,
          ...presetToSave,
          createdAt: existingPreset.createdAt ?? timestamp,
        };
        presets[existingIndex] = mergedPreset;
        await writePresets(presets);
        return { preset: mergedPreset, isNew: false };
      }

      const presetToInsert = { ...presetToSave, createdAt: timestamp };
      presets.push(presetToInsert);
      await writePresets(presets);
      return { preset: presetToInsert, isNew: true };
    });

    const status = result.isNew ? 201 : 200;
    res.status(status).json({ preset: result.preset });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/presets/:id', async (req, res, next) => {
  const presetId = req.params.id;
  try {
    const removed = await withFileLock(async () => {
      const presets = await readPresets();
      const index = presets.findIndex((item) => item.id === presetId);
      if (index === -1) {
        return false;
      }
      presets.splice(index, 1);
      await writePresets(presets);
      return true;
    });

    if (!removed) {
      return sendError(res, 404, 'Preset not found.');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
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
