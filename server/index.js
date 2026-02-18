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
  const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI'], {
    cwd: repoRoot,
  });

  const isoTimestamp = stdout.trim();
  if (!isoTimestamp) {
    throw new Error('Git returned an empty commit timestamp.');
  }

  return isoTimestamp;
}

async function readLatestCommitHash() {
  const repoRoot = path.resolve(__dirname, '..');
  const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
  });

  const hash = stdout.trim();
  if (!hash) {
    throw new Error('Git returned an empty commit hash.');
  }

  return hash;
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

function parseChromiumLaunchArgs() {
  const launchArgs = [];

  if (process.env.PLAYWRIGHT_DISABLE_SANDBOX === '1' || process.env.PLAYWRIGHT_DISABLE_SANDBOX === 'true') {
    launchArgs.push('--no-sandbox');
  }

  const extraArgsRaw = process.env.PLAYWRIGHT_CHROMIUM_ARGS;
  if (typeof extraArgsRaw === 'string' && extraArgsRaw.trim().length > 0) {
    const extraArgs = extraArgsRaw
      .split(',')
      .map((arg) => arg.trim())
      .filter(Boolean);
    launchArgs.push(...extraArgs);
  }

  return [...new Set(launchArgs)];
}

async function resolveReportStateFromPayload(payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { error: ['Report payload must be a JSON object.'] };
  }

  if (payload.state !== undefined) {
    return { state: payload.state };
  }

  if (payload.projectId !== undefined || payload.reportId !== undefined) {
    const projectId = String(payload.projectId ?? payload.reportId ?? '').trim();
    if (!projectId) {
      return { error: ['"projectId" or "reportId" must be a non-empty string when provided.'] };
    }

    const projects = await readProjects();
    const matchingProject = projects.find((item) => item.id === projectId);
    if (!matchingProject) {
      return { notFound: true };
    }

    return { state: matchingProject.state };
  }

  return { state: payload };
}

function quoteHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function firstForwardedHeaderValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const [firstValue] = value.split(',');
  const normalized = firstValue?.trim();
  return normalized ? normalized : null;
}

function resolveSafeRequestBaseUrl(req) {
  const forwardedProto = firstForwardedHeaderValue(req.get('x-forwarded-proto'));
  const forwardedHost = firstForwardedHeaderValue(req.get('x-forwarded-host'));

  const protocol = forwardedProto && ['http', 'https'].includes(forwardedProto.toLowerCase())
    ? forwardedProto.toLowerCase()
    : (req.protocol === 'https' ? 'https' : 'http');

  const hostCandidate = forwardedHost || req.get('host') || '';
  const host = hostCandidate.replace(/^https?:\/\//i, '').split('/')[0].trim();
  if (!host) {
    return `${protocol}://localhost`;
  }

  return `${protocol}://${host}`;
}

async function buildPdfDocumentHtml(reportBodyHtml, requestBaseUrl) {
  const assetDirectory = path.join(STATIC_ROOT, 'assets');
  const assetEntries = await fs.readdir(assetDirectory, { withFileTypes: true });
  const preloadEntries = assetEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|otf)$/i.test(name));

  const preloadTags = preloadEntries
    .map((name) => {
      const encodedName = encodeURIComponent(name).replaceAll('%2F', '/');
      const fileUrl = `/assets/${encodedName}`;
      const ext = path.extname(name).toLowerCase();
      const asValue = ['.woff', '.woff2', '.ttf', '.otf'].includes(ext) ? 'font' : 'image';
      const typeMap = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
      };
      const typeAttr = typeMap[ext] ? ` type="${typeMap[ext]}"` : '';
      const crossOriginAttr = asValue === 'font' ? ' crossorigin="anonymous"' : '';
      return `<link rel="preload" href="${quoteHtmlAttribute(fileUrl)}" as="${asValue}"${typeAttr}${crossOriginAttr}>`;
    })
    .join('\n    ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Winch Analyzer Report</title>
    <base href="${quoteHtmlAttribute(`${requestBaseUrl}/`)}">
    ${preloadTags}
    <link rel="stylesheet" href="/css/styles.css">
    <style>
      body {
        background: #fff;
        margin: 0;
        color: #111;
        font-family: Inter, "Segoe UI", Arial, sans-serif;
      }
      .report-document {
        padding: 0;
      }
      .report-document table {
        width: 100%;
        border-collapse: collapse;
      }
    </style>
  </head>
  <body>
    ${reportBodyHtml}
  </body>
</html>`;
}

function toStablePdfFilename(projectName) {
  const normalized = String(projectName || 'winch-analyzer-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${normalized || 'winch-analyzer-report'}-report.pdf`;
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
    const latestCommitAt = await readLatestCommitTimestamp();
    res.json({ latestCommitAt });
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

app.post('/api/reports/pdf', async (req, res, next) => {
  let browser;
  try {
    const resolved = await resolveReportStateFromPayload(req.body);
    if (resolved.error) {
      return sendError(res, 400, 'Invalid report payload.', resolved.error);
    }
    if (resolved.notFound) {
      return sendError(res, 404, 'Project not found for provided report identifier.');
    }

    const statePayload = resolved.state;
    const { valid, errors } = validateReportStatePayload(statePayload);
    if (!valid) {
      return sendError(res, 400, 'Invalid report payload.', errors);
    }

    const model = buildModelFromProjectState(statePayload);
    const generatedAt = new Date();
    const reportBodyHtml = renderReportHtml({ ...model, inputState: statePayload }, { generatedAt });
    const requestBaseUrl = resolveSafeRequestBaseUrl(req);
    const fullDocumentHtml = await buildPdfDocumentHtml(reportBodyHtml, requestBaseUrl);

    let playwright;
    try {
      playwright = await import('playwright');
    } catch (err) {
      throw new Error('Playwright is required for PDF generation. Install the "playwright" package and browser binaries.');
    }

    const launchArgs = parseChromiumLaunchArgs();
    browser = await playwright.chromium.launch({
      headless: true,
      ...(launchArgs.length > 0 ? { args: launchArgs } : {}),
    });
    const page = await browser.newPage();
    await page.setContent(fullDocumentHtml, { waitUntil: 'networkidle' });

    const pdfOptionsPayload = req.body?.pdfOptions ?? {};
    const pdfBuffer = await page.pdf({
      format: pdfOptionsPayload.format === 'Letter' ? 'Letter' : 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      displayHeaderFooter: Boolean(pdfOptionsPayload.headerTemplate || pdfOptionsPayload.footerTemplate),
      headerTemplate: pdfOptionsPayload.headerTemplate || '<div></div>',
      footerTemplate: pdfOptionsPayload.footerTemplate || '<div></div>',
    });

    const filename = toStablePdfFilename(statePayload.project_name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return next(err);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Failed to close PDF browser instance', closeErr);
      }
    }
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
