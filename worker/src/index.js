// ===== Cloudflare Worker — analyzer-api =====
// Mirrors the Express server's preset/project CRUD endpoints using KV storage.
// Two KV keys: "presets" (JSON array) and "projects" (JSON array).
// KV also stores "abb-spec-sheet-template" (binary PDF) for spec sheet generation.

import { PDFDocument, PDFName, PDFBool } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function errorResponse(status, message, details) {
  const body = { error: { message, ...(details ? { details } : {}) } };
  return jsonResponse(body, status);
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function withCors(response, env) {
  const headers = corsHeaders(env);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(request, env) {
  const token = env.API_TOKEN;
  if (!token) return true; // no token configured = open access
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${token}`;
}

// ---------------------------------------------------------------------------
// KV read/write
// ---------------------------------------------------------------------------

async function readCollection(env, key) {
  const data = await env.DATA.get(key, { type: 'json' });
  return Array.isArray(data) ? data : [];
}

async function writeCollection(env, key, data) {
  await env.DATA.put(key, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Validation (ported from server/index.js)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleListPresets(env) {
  const presets = await readCollection(env, 'presets');
  return jsonResponse({ presets });
}

async function handleGetPreset(env, id) {
  const presets = await readCollection(env, 'presets');
  const preset = presets.find((item) => item.id === id);
  if (!preset) return errorResponse(404, 'Preset not found.');
  return jsonResponse({ preset });
}

async function handleCreatePreset(env, request) {
  const payload = await request.json();
  const { valid, errors } = validatePresetPayload(payload);
  if (!valid) return errorResponse(400, 'Invalid preset payload.', errors);

  const description =
    typeof payload.description === 'string' && payload.description.trim().length > 0
      ? payload.description.trim()
      : undefined;

  const timestamp = new Date().toISOString();
  const presetToSave = {
    id: payload.id && typeof payload.id === 'string' ? payload.id : crypto.randomUUID(),
    name: payload.name.trim(),
    ...(description ? { description } : {}),
    data: payload.data,
    ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
    updatedAt: timestamp,
  };

  const presets = await readCollection(env, 'presets');
  const existingIndex = presets.findIndex((item) => item.id === presetToSave.id);

  let saved;
  let isNew;

  if (existingIndex >= 0) {
    const existing = presets[existingIndex];
    saved = { ...existing, ...presetToSave, createdAt: existing.createdAt ?? timestamp };
    presets[existingIndex] = saved;
    isNew = false;
  } else {
    saved = { ...presetToSave, createdAt: timestamp };
    presets.push(saved);
    isNew = true;
  }

  await writeCollection(env, 'presets', presets);
  return jsonResponse({ preset: saved }, isNew ? 201 : 200);
}

async function handleDeletePreset(env, id) {
  const presets = await readCollection(env, 'presets');
  const index = presets.findIndex((item) => item.id === id);
  if (index === -1) return errorResponse(404, 'Preset not found.');

  presets.splice(index, 1);
  await writeCollection(env, 'presets', presets);
  return new Response(null, { status: 204 });
}

async function handleListProjects(env) {
  const projects = await readCollection(env, 'projects');
  return jsonResponse({ projects });
}

async function handleGetProject(env, id) {
  const projects = await readCollection(env, 'projects');
  const project = projects.find((item) => item.id === id);
  if (!project) return errorResponse(404, 'Project not found.');
  return jsonResponse({ project });
}

async function handleCreateProject(env, request) {
  const payload = await request.json();
  const { valid, errors } = validateProjectPayload(payload);
  if (!valid) return errorResponse(400, 'Invalid project payload.', errors);

  const description =
    typeof payload.description === 'string' && payload.description.trim().length > 0
      ? payload.description.trim()
      : undefined;

  const timestamp = new Date().toISOString();
  const projectToSave = {
    id: payload.id && typeof payload.id === 'string' ? payload.id : crypto.randomUUID(),
    name: payload.name.trim(),
    ...(description ? { description } : {}),
    state: payload.state,
    updatedAt: timestamp,
  };

  const projects = await readCollection(env, 'projects');
  const existingIndex = projects.findIndex((item) => item.id === projectToSave.id);

  let saved;
  let isNew;

  if (existingIndex >= 0) {
    const existing = projects[existingIndex];
    saved = { ...existing, ...projectToSave, createdAt: existing.createdAt ?? timestamp };
    projects[existingIndex] = saved;
    isNew = false;
  } else {
    saved = { ...projectToSave, createdAt: timestamp };
    projects.push(saved);
    isNew = true;
  }

  await writeCollection(env, 'projects', projects);
  return jsonResponse({ project: saved }, isNew ? 201 : 200);
}

async function handleDeleteProject(env, id) {
  const projects = await readCollection(env, 'projects');
  const index = projects.findIndex((item) => item.id === id);
  if (index === -1) return errorResponse(404, 'Project not found.');

  projects.splice(index, 1);
  await writeCollection(env, 'projects', projects);
  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// ABB Spec Sheet PDF
// ---------------------------------------------------------------------------

function fillSpecSheetPdf(pdfDoc, { textFields, checkBoxes }) {
  const form = pdfDoc.getForm();

  for (const [fieldName, value] of Object.entries(textFields || {})) {
    try {
      const field = form.getTextField(fieldName);
      if (field && value) field.setText(String(value));
    } catch { /* field not found — skip */ }
  }

  if (Array.isArray(checkBoxes)) {
    for (const fieldName of checkBoxes) {
      try {
        const field = form.getCheckBox(fieldName);
        if (field) field.check();
      } catch { /* field not found — skip */ }
    }
  }
}

async function handleSpecSheetPdf(env, request) {
  const { textFields, checkBoxes } = await request.json();
  if (!textFields || typeof textFields !== 'object') {
    return errorResponse(400, 'Request body must contain a "textFields" object.');
  }

  const templateBytes = await env.DATA.get('abb-spec-sheet-template', { type: 'arrayBuffer' });
  if (!templateBytes) {
    return errorResponse(500, 'PDF template not found in KV. Run seed-kv to upload it.');
  }

  const pdfDoc = await PDFDocument.load(templateBytes);
  fillSpecSheetPdf(pdfDoc, { textFields, checkBoxes });

  // Tell viewers to regenerate appearance streams for print compatibility
  const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
  if (acroForm) acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True);

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const projectName = textFields['Customer Reference'] || 'winch';
  const today = textFields['Dated'] || new Date().toISOString().slice(0, 10);
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_ABB_SpecSheet_${today}.pdf"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function matchRoute(method, pathname) {
  // /api/presets
  if (pathname === '/api/presets') {
    if (method === 'GET') return { handler: 'listPresets' };
    if (method === 'POST') return { handler: 'createPreset' };
  }

  // /api/presets/:id
  const presetMatch = pathname.match(/^\/api\/presets\/([^/]+)$/);
  if (presetMatch) {
    const id = decodeURIComponent(presetMatch[1]);
    if (method === 'GET') return { handler: 'getPreset', id };
    if (method === 'DELETE') return { handler: 'deletePreset', id };
  }

  // /api/projects
  if (pathname === '/api/projects') {
    if (method === 'GET') return { handler: 'listProjects' };
    if (method === 'POST') return { handler: 'createProject' };
  }

  // /api/projects/:id
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const id = decodeURIComponent(projectMatch[1]);
    if (method === 'GET') return { handler: 'getProject', id };
    if (method === 'DELETE') return { handler: 'deleteProject', id };
  }

  // /api/spec-sheet/pdf
  if (pathname === '/api/spec-sheet/pdf' && method === 'POST') {
    return { handler: 'specSheetPdf' };
  }

  // /api/health
  if (pathname === '/api/health' && method === 'GET') {
    return { handler: 'health' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // Auth check
    if (!isAuthorized(request, env)) {
      return withCors(errorResponse(401, 'Unauthorized.'), env);
    }

    const route = matchRoute(method, url.pathname);
    if (!route) {
      return withCors(errorResponse(404, 'Not found.'), env);
    }

    try {
      let response;

      switch (route.handler) {
        case 'health':
          response = jsonResponse({ ok: true, service: 'analyzer-api' });
          break;
        case 'listPresets':
          response = await handleListPresets(env);
          break;
        case 'getPreset':
          response = await handleGetPreset(env, route.id);
          break;
        case 'createPreset':
          response = await handleCreatePreset(env, request);
          break;
        case 'deletePreset':
          response = await handleDeletePreset(env, route.id);
          break;
        case 'listProjects':
          response = await handleListProjects(env);
          break;
        case 'getProject':
          response = await handleGetProject(env, route.id);
          break;
        case 'createProject':
          response = await handleCreateProject(env, request);
          break;
        case 'deleteProject':
          response = await handleDeleteProject(env, route.id);
          break;
        case 'specSheetPdf':
          response = await handleSpecSheetPdf(env, request);
          break;
        default:
          response = errorResponse(500, 'Unknown route handler.');
      }

      return withCors(response, env);
    } catch (err) {
      console.error('Worker error:', err);
      return withCors(errorResponse(500, 'Internal server error.'), env);
    }
  },
};
