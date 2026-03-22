# MSFS addon DLL (optional)

The **EZ Flight Plan Bridge** desktop app can download this DLL from GitHub into your **MSFS Community** folder (see the app’s “MSFS addon” section).

## Layout in this repo

| Path | Purpose |
|------|---------|
| `native/EzflplnBridge.dll` | Built native module (you build and commit, or attach to Releases). |

The app downloads from:

`https://raw.githubusercontent.com/codingsushi79/ezflpln-msfs-bridge/main/native/EzflplnBridge.dll`

Until that file exists on `main`, the in-app downloader will return **404** — build the DLL, add it here, push, then use **Download addon DLL from GitHub** again.

## Install location on disk

The app writes:

`<Your Community folder>/ezflpln-msfs-bridge/EzflplnBridge.dll`

Typical **Community** paths:

- **Microsoft Store:** `%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community`
- **Steam:** `...\Steam\steamapps\common\MicrosoftFlightSimulator\Community`

## Building the DLL

Implement your WASM / SimConnect / gauge logic in a Visual Studio **C++ DLL** project targeting **x64**, output name **`EzflplnBridge.dll`**, then copy it to `native/` in this repo before publishing.

This repository does not yet ship a prebuilt DLL; the bridge still uses **node-simconnect** from the desktop process for live position when demo mode is off on Windows.
