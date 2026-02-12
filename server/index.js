import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.resolve(__dirname, '..', 'src');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PRESET_STORE = path.join(DATA_DIR, 'presets.json');
const LOCK_FILE = path.join(DATA_DIR, 'presets.lock');
const PROJECT_STORE = path.join(DATA_DIR, 'projects.json');
const PROJECT_LOCK_FILE = path.join(DATA_DIR, 'projects.lock');

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
