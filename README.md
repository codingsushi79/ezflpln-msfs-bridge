# ezflpln MSFS bridge

Sends live latitude, longitude, and optional heading/altitude to [ezflpln](../ezflpln) at `POST /api/plane-position` with **`Authorization: Bearer <token>`**. You link the bridge by entering a **6-character code** from the website while signed in; the map only shows **your** position for that linked session.

## Windows app (graphical UI)

The desktop build is an **Electron** app with a window (not a bare console).

1. **On a Windows machine** (or a Windows CI runner), install [Node.js](https://nodejs.org/) and run:

   ```bash
   npm install
   npm run dist:win
   ```

2. The portable executable is under **`release/`** (name like `EZ Flight Plan Bridge 0.1.0.exe`). Copy that file anywhere and double-click to run.

3. In the app: set your **ezflpln URL**, sign in on the site and **Generate bridge code**, enter the code and click **Link account**, then **Start sending**. Use **Demo orbit** to test the map without the simulator. With demo off on **Windows**, the app uses **[node-simconnect](https://www.npmjs.com/package/node-simconnect)** to read **live** lat/lon/heading/altitude from **MSFS** via SimConnect (start the sim first).

### Optional: MSFS addon DLL from GitHub

The main program can download a native **DLL** from the public repo **[codingsushi79/ezflpln-msfs-bridge](https://github.com/codingsushi79/ezflpln-msfs-bridge)** into your **Community** folder:

1. In the app, set **MSFS Community folder** (Browse or paste the path to the `Community` directory).
2. Click **Download addon DLL from GitHub**. The app fetches  
   `https://raw.githubusercontent.com/codingsushi79/ezflpln-msfs-bridge/main/native/EzflplnBridge.dll`  
   and writes  
   `<Community>/ezflpln-msfs-bridge/EzflplnBridge.dll`.

You must **build and commit** `native/EzflplnBridge.dll` (or publish it on that path) for the download to succeed; see [`native/README.md`](native/README.md). The bridge still uses **SimConnect from the desktop** for live position; the DLL is for your future in-sim / WASM integration.

**Develop / preview the UI on Mac or Linux:**

```bash
npm install
npm run electron:dev
```

**Token file:** `%USERPROFILE%\.ezflpln\token` on Windows. You can still set **`EZFLPLN_TOKEN`** to skip pairing.

## Run (headless CLI — Node.js)

1. In ezflpln: create an account, sign in, and import an OFP (so the map is visible).
2. Start the app: `cd ../ezflpln && npm run dev` (needs `SESSION_SECRET` in `.env.local`).
3. On the site, generate a **bridge code** (Connections → signed in → Generate bridge code).
4. Start the bridge — first run will prompt for that **code**, then save a token under `~/.ezflpln/token`:

```bash
cd ezflpln-msfs-bridge
npm install
npm run build
EZFLPLN_URL=http://localhost:3000 npm run demo
```

On **Windows** (Command Prompt):

```bat
set EZFLPLN_URL=http://localhost:3000
npm run demo
```

`npm run demo` uses a circular **demo orbit** near KSFO so you can verify the map without the sim. After `npm run build`, use `npm start` (or `npm run demo:build` for the demo orbit with the compiled output).

Alternatively set **`EZFLPLN_TOKEN`** to skip the prompt (same bearer token as after a successful pairing; also stored in `~/.ezflpln/token`).

## Microsoft Flight Simulator & SimConnect

**This app** uses the **[node-simconnect](https://www.npmjs.com/package/node-simconnect)** library (TypeScript, talks to MSFS over the same wire protocol as the official SDK). On **Windows**, with **demo orbit off**, it subscribes to the user aircraft **STRUCT LATLONALT** and **PLANE HEADING DEGREES TRUE** once per second and sends that to ezflpln.

**In MSFS / on your PC:**

1. **Windows + MSFS** on the same machine as the bridge (SimConnect here is local; macOS/Linux builds skip SimConnect and use a placeholder when not in demo mode).
2. **Start MSFS** (menu or in flight), then **Start sending** in the bridge. If the sim is not running yet, you will see a log message; connect again after the sim starts.
3. **Firewall:** allow **outbound** HTTPS (or HTTP to your dev server) to your `EZFLPLN_URL`.
4. **Order of operations:** start ezflpln → sign in on the web → generate a bridge code → link in the bridge → **optional:** start MSFS → **Start sending** → keep the browser signed in for the live map stream.

You do **not** need MSFS “Developer Mode” for this. You also do **not** need to install the C++ SimConnect SDK separately for this app — `node-simconnect` bundles the protocol client. If you outgrow it, you can still add a custom native tool and POST the same JSON payload yourself.

### Advanced: official SimConnect SDK (C++ / C#)

If you build your **own** SimConnect client with the **MSFS SDK**, use the SDK docs for `SimConnect_Open`, data definitions, and dispatch loops. You can POST the same JSON as this bridge or feed `getSamplePosition()` via IPC.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `EZFLPLN_URL` | `http://localhost:3000` | Origin of the ezflpln app (no trailing slash) |
| `EZFLPLN_TOKEN` | — | Bridge bearer token (skips pairing prompt if set) |
| `EZFLPLN_TOKEN_FILE` | `~/.ezflpln/token` | Where the bridge reads/saves the token |
| `POSITION_INTERVAL_MS` | `800` | How often to POST |
| `DEMO_ORBIT` | off | Set to `1` or `true` for the demo orbit (CLI) |

## Payload (for `POST /api/plane-position`)

```json
{ "lat": 37.62, "lng": -122.38, "heading": 145, "altitudeFt": 4200 }
```

Include the bearer token from `EZFLPLN_TOKEN` or `~/.ezflpln/token` on every request. `heading` is true degrees (0–360, clockwise from north) for the map icon rotation.
