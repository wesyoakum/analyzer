import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const serverIndexPath = path.join(repoRoot, 'server', 'index.js');
const nginxConfigPath = path.join(repoRoot, 'deploy', 'nginx.conf');

const serverCode = await fs.readFile(serverIndexPath, 'utf8');
const nginxCode = await fs.readFile(nginxConfigPath, 'utf8');

const jsonMiddlewareSnippet = "app.use(express.json({ limit: '1mb' }));";
const healthRouteSnippet = "app.get('/api/health'";
const pdfRouteSnippet = "app.post('/api/reports/pdf'";
const notFoundMiddlewareSnippet = 'app.use((req, res, next) => {';
const errorMiddlewareSnippet = 'app.use((err, req, res, next) => {';

const jsonIndex = serverCode.indexOf(jsonMiddlewareSnippet);
const healthRouteIndex = serverCode.indexOf(healthRouteSnippet);
const pdfRouteIndex = serverCode.indexOf(pdfRouteSnippet);
const notFoundIndex = serverCode.indexOf(notFoundMiddlewareSnippet);
const errorIndex = serverCode.indexOf(errorMiddlewareSnippet);

assertCondition(jsonIndex >= 0, `Missing JSON middleware: ${jsonMiddlewareSnippet}`);
assertCondition(healthRouteIndex >= 0, `Missing health route: ${healthRouteSnippet}`);
assertCondition(pdfRouteIndex >= 0, `Missing PDF route: ${pdfRouteSnippet}`);
assertCondition(notFoundIndex >= 0, `Missing not-found middleware: ${notFoundMiddlewareSnippet}`);
assertCondition(errorIndex >= 0, `Missing error middleware: ${errorMiddlewareSnippet}`);

assertCondition(jsonIndex < healthRouteIndex, 'express.json middleware must be registered before /api/health.');
assertCondition(healthRouteIndex < notFoundIndex, '/api/health must be registered before not-found middleware.');
assertCondition(healthRouteIndex < errorIndex, '/api/health must be registered before error middleware.');

assertCondition(jsonIndex < pdfRouteIndex, 'express.json middleware must be registered before /api/reports/pdf.');
assertCondition(pdfRouteIndex < notFoundIndex, '/api/reports/pdf must be registered before not-found middleware.');
assertCondition(pdfRouteIndex < errorIndex, '/api/reports/pdf must be registered before error middleware.');

assertCondition(nginxCode.includes('location /api/ {'), 'Nginx must contain /api/ reverse proxy location.');
assertCondition(nginxCode.includes('location = /api/health {'), 'Nginx must contain explicit /api/health location.');
assertCondition(nginxCode.includes('limit_except GET HEAD OPTIONS {'), 'Nginx must allow GET/HEAD/OPTIONS for /api/health.');
assertCondition(nginxCode.includes('location = /api/reports/pdf {'), 'Nginx must contain explicit /api/reports/pdf location.');
assertCondition(nginxCode.includes('limit_except POST OPTIONS {'), 'Nginx must allow POST/OPTIONS for /api/reports/pdf.');
assertCondition(!nginxCode.includes('proxy_set_header Content-Type'), 'Nginx should not override Content-Type for proxied API requests.');
assertCondition(!nginxCode.includes('proxy_hide_header Content-Type'), 'Nginx should not hide Content-Type for proxied API requests.');

console.log('Verified /api/health and /api/reports/pdf route ordering, nginx reverse-proxy rules, JSON parser placement, and Content-Type pass-through behavior.');
