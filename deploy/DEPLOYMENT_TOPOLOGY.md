# Deployment topology

- Static assets are served directly from `src/`:
  - `/` -> `src/index.html`
  - `/src/*` -> files under `src/`
- API traffic is reverse-proxied to the Node process started by `npm start` (`server/index.js`) on `PORT`.
- All `/api/*` requests bypass static handling and are always passed to Node.

## Deployment smoke checks

- Run the full live wiring audit (nginx config + upstream process + smoke checks):
  ```bash
  ./deploy/verify-runtime-wiring.sh
  ```
  - The script fails fast if nginx is not installed, if Node is not listening on the configured upstream port, or if the health route is not properly wired through nginx.

- Confirm API health responds from Node:
  ```bash
  curl -si http://localhost/api/health
  ```
  - Expect: HTTP `200` with `Content-Type: application/json` and body `{"ok":true,"service":"analyzer-api"}`.
