const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'configs.json');
const STATIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readConfigs() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

async function writeConfigs(configs) {
  await ensureDataDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

async function handleApi(req, res, urlObj) {
  const { pathname } = urlObj;
  if (req.method === 'GET' && pathname === '/api/configs') {
    const configs = await readConfigs();
    sendJson(res, 200, { configs });
    return true;
  }

  if (pathname.startsWith('/api/configs/')) {
    const name = decodeURIComponent(pathname.slice('/api/configs/'.length));
    if (!name) {
      sendError(res, 400, 'Configuration name is required');
      return true;
    }
    if (req.method === 'PUT') {
      let raw = '';
      req.on('data', chunk => {
        raw += chunk;
        if (raw.length > 1e6) {
          raw = '';
          res.writeHead(413);
          res.end();
          req.destroy();
        }
      });
      req.on('end', async () => {
        if (!raw) {
          sendError(res, 400, 'Configuration payload is required');
          return;
        }
        try {
          const body = JSON.parse(raw);
          if (!body || typeof body !== 'object') {
            sendError(res, 400, 'Configuration payload must be an object');
            return;
          }
          const configs = await readConfigs();
          configs[name] = body;
          await writeConfigs(configs);
          res.writeHead(204);
          res.end();
        } catch (err) {
          console.error(err);
          sendError(res, 400, 'Invalid JSON payload');
        }
      });
      return true;
    }
    if (req.method === 'DELETE') {
      const configs = await readConfigs();
      if (Object.prototype.hasOwnProperty.call(configs, name)) {
        delete configs[name];
        await writeConfigs(configs);
      }
      res.writeHead(204);
      res.end();
      return true;
    }
  }
  return false;
}

async function serveStatic(req, res, urlObj) {
  let pathname = urlObj.pathname;
  if (pathname === '/') {
    pathname = '/index.html';
  }
  const filePath = path.join(STATIC_DIR, pathname);
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      console.error(err);
      res.writeHead(500);
      res.end('Internal server error');
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const handled = await handleApi(req, res, urlObj);
    if (!handled) {
      await serveStatic(req, res, urlObj);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end('Internal server error');
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
