# ezflpln MSFS bridge

Sends live latitude, longitude, and optional heading/altitude to [ezflpln](../ezflpln) at `POST /api/plane-position` with **`Authorization: Bearer <token>`**. The token comes from signing in with the **same account** as the website; the map only shows **your** position when you are signed in in the browser.

## Windows standalone (.exe)

You do **not** need Node.js installed. Use a single-file build:

1. Build it (macOS/Linux/Windows): `npm install` then `npm run build:exe`. The executable is **`release/ezflpln-msfs-bridge.exe`** (~40 MB; embeds Node 18 via [pkg](https://github.com/vercel/pkg)).
2. Copy that `.exe` anywhere on a Windows PC, run it from **Command Prompt** or double-click (a console window opens).
3. First run asks for **email and password** (same as the website) unless you set **`EZFLPLN_TOKEN`**. The token is saved under **`%USERPROFILE%\.ezflpln\token`**.

Demo orbit (KSFO) without the sim — in Command Prompt:

```bat
set DEMO_ORBIT=1
ezflpln-msfs-bridge.exe
```

Point at a non-default ezflpln origin if needed:

```bat
set EZFLPLN_URL=https://your-site.example
ezflpln-msfs-bridge.exe
```

Publish the file from `release/` as a download (for example attach it to a GitHub Release).

## Run (Node.js / dev)

1. In ezflpln: create an account, sign in, and import an OFP (so the map is visible).
2. Start the app: `cd ../ezflpln && npm run dev` (needs `SESSION_SECRET` in `.env.local`).
3. Start the bridge — first run will prompt for **email and password** (same as the site), then save a token under `~/.ezflpln/token`:

```bash
cd ezflpln-msfs-bridge
npm install
npm run build
EZFLPLN_URL=http://localhost:3000 npm run demo
```

On **Windows** (Command Prompt), set the URL then run the demo:

```bat
set EZFLPLN_URL=http://localhost:3000
npm run demo
```

`npm run demo` uses a circular **demo orbit** near KSFO so you can verify the map without the sim. `DEMO_ORBIT` is set via `cross-env`, so the demo command works the same in cmd.exe, PowerShell, and Unix shells. After `npm run build`, use `npm start` (or `npm run demo:build` for the demo orbit with the compiled output).

Alternatively set **`EZFLPLN_TOKEN`** to skip the prompt (copy from env after first login, or use the value stored in `~/.ezflpln/token`).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `EZFLPLN_URL` | `http://localhost:3000` | Origin of the ezflpln app (no trailing slash) |
| `EZFLPLN_TOKEN` | — | Bridge bearer token (skips login prompt if set) |
| `EZFLPLN_TOKEN_FILE` | `~/.ezflpln/token` | Where the bridge reads/saves the token |
| `POSITION_INTERVAL_MS` | `800` | How often to POST |
| `DEMO_ORBIT` | off | Set to `1` or `true` for the demo orbit |

## Real Microsoft Flight Simulator

This repo does **not** bundle SimConnect or a WASM module. To drive real position:

1. Use **SimConnect** (C++/C#) or a community bridge that exposes lat/lon/heading.
2. From that process, call the same JSON **POST** with header `Authorization: Bearer <token>` (see `postPosition()` in `src/index.ts`).

Payload shape:

```json
{ "lat": 37.62, "lng": -122.38, "heading": 145, "altitudeFt": 4200 }
```

Include the bearer token from `EZFLPLN_TOKEN` or `~/.ezflpln/token` on every request.

`heading` is true degrees (0–360, clockwise from north) for the map icon rotation.
