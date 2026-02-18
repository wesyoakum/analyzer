# Deployment topology

- Static assets are served directly from `src/`:
  - `/` -> `src/index.html`
  - `/src/*` -> files under `src/`
- API traffic is reverse-proxied to the Node process started by `npm start` (`server/index.js`) on `PORT`.
- `/api/reports/pdf` is explicitly configured to allow `POST` (and `OPTIONS` for CORS preflight), then forwarded to Node.
- All `/api/*` requests bypass static handling and are always passed to Node.
