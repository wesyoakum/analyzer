# Deployment topology

- Static assets are served directly from `src/`:
  - `/` -> `src/index.html`
  - `/src/*` -> files under `src/`
- API traffic is reverse-proxied to the Node process started by `npm start` (`server/index.js`) on `PORT`.
- `/api/reports/pdf` is explicitly configured to allow `POST` (and `OPTIONS` for CORS preflight), then forwarded to Node.
- All `/api/*` requests bypass static handling and are always passed to Node.

## Deployment smoke checks

- Run the full live wiring audit (nginx config + upstream process + smoke checks):
  ```bash
  ./deploy/verify-runtime-wiring.sh
  ```
  - The script fails fast if nginx is not installed, if Node is not listening on the configured upstream port, or if either API route is not properly wired through nginx.

- Confirm API health responds from Node:
  ```bash
  curl -si http://localhost/api/health
  ```
  - Expect: HTTP `200` with `Content-Type: application/json` and body `{"ok":true,"service":"analyzer-api"}`.

- Confirm PDF endpoint reaches Node (not proxied HTML fallback):
  ```bash
  curl -si -X POST http://localhost/api/reports/pdf \
    -H 'Content-Type: application/json' \
    -d '{}'
  ```
  - Expect: HTTP `400` with JSON error from Node, **not** `200` HTML.
