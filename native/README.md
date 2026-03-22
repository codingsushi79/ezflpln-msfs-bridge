# MSFS addon DLL (optional)

The **EZ Flight Plan Bridge** desktop app can download this DLL from GitHub into your **MSFS Community** folder (see the app’s “MSFS addon” section).

## Layout in this repo

| Path | Purpose |
|------|---------|
| `native/EzflplnBridge.dll` | **64-bit Windows PE DLL** (commit this file so raw GitHub download works). |
| `native/src/EzflplnBridge.c` | Source: `DllMain` + exported `EzflplnBridge_GetVersion()`. |

The app downloads from:

`https://raw.githubusercontent.com/codingsushi79/ezflpln-msfs-bridge/main/native/EzflplnBridge.dll`

## Install location on disk

The app writes:

`<Your Community folder>/ezflpln-msfs-bridge/EzflplnBridge.dll`

Typical **Community** paths:

- **Microsoft Store:** `%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community`
- **Steam:** `...\Steam\steamapps\common\MicrosoftFlightSimulator\Community`

## Building the DLL

**macOS (Homebrew MinGW, cross-compile):**

```bash
chmod +x native/build-mingw.sh
./native/build-mingw.sh
```

**Windows:** run `native\build-windows.bat` (MinGW `gcc` on PATH) or compile `native\src\EzflplnBridge.c` with MSVC as a **x64** DLL named `EzflplnBridge.dll` in `native\`.

The bridge still uses **node-simconnect** in the desktop app for live position; extend this DLL for in-sim integration as needed.
