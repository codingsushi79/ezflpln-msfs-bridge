import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from "electron";
import {
  ADDON_INSTALL_FOLDER,
  DLL_FILENAME,
  DLL_PATH_IN_REPO,
  getDllRawUrl,
  getRepoPageUrl,
} from "../src/addon-github.js";
import {
  getIntervalMs,
  redeemCodeAndSave,
  resolveTokenFromEnvOrFile,
  startPositionLoop,
} from "../src/bridge.js";
import { getLiveSimPosition, startSimConnectSession } from "../src/simconnect.js";

type BridgeConfig = { msfsCommunityPath?: string };

function configPath(): string {
  return path.join(app.getPath("userData"), "bridge-config.json");
}

async function loadConfig(): Promise<BridgeConfig> {
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    return JSON.parse(raw) as BridgeConfig;
  } catch {
    return {};
  }
}

async function saveConfig(cfg: BridgeConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(cfg, null, 2), "utf8");
}

function isAllowedGithubDllUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.hostname !== "raw.githubusercontent.com") {
      return false;
    }
    const p = u.pathname.replace(/\\/g, "/");
    return (
      p.includes("/codingsushi79/ezflpln-msfs-bridge/") &&
      p.endsWith(`/${DLL_PATH_IN_REPO}`)
    );
  } catch {
    return false;
  }
}

function resourcePath(...segments: string[]): string {
  return path.join(app.getAppPath(), ...segments);
}

let mainWindow: BrowserWindow | null = null;
let stopLoop: (() => void) | null = null;
let simCleanup: (() => void) | null = null;
let running = false;

function sendLog(line: string): void {
  mainWindow?.webContents.send("ezfl:log", line);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 780,
    minWidth: 400,
    minHeight: 640,
    show: false,
    title: "EZ Flight Plan Bridge",
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: resourcePath("dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(
    resourcePath("dist-electron", "renderer", "index.html"),
  );
  mainWindow.once("ready-to-show", () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("ezfl:get-state", async () => {
  const hasToken = Boolean(await resolveTokenFromEnvOrFile());
  return {
    baseUrl: process.env.EZFLPLN_URL?.replace(/\/$/, "") ?? "http://localhost:3000",
    running,
    demoOrbit:
      process.env.DEMO_ORBIT === "1" || process.env.DEMO_ORBIT === "true",
    hasToken,
    intervalMs: getIntervalMs(),
  };
});

ipcMain.handle(
  "ezfl:pair",
  async (_, args: { baseUrl: string; code: string }) => {
    try {
      const base = args.baseUrl.replace(/\/$/, "").trim();
      await redeemCodeAndSave(base, args.code.trim());
      process.env.EZFLPLN_URL = base;
      sendLog("Linked — token saved. You can start sending.");
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sendLog(`Pair failed: ${msg}`);
      return { ok: false, error: msg };
    }
  },
);

ipcMain.handle(
  "ezfl:start",
  async (_, args: { baseUrl: string; demoOrbit: boolean }) => {
    if (running) return { ok: false, error: "Already running." };
    const baseUrl = args.baseUrl.replace(/\/$/, "").trim();
    process.env.EZFLPLN_URL = baseUrl;
    process.env.DEMO_ORBIT = args.demoOrbit ? "1" : "0";
    const token = await resolveTokenFromEnvOrFile();
    if (!token) {
      return {
        ok: false,
        error: "No token — link with a code from the website first.",
      };
    }
    const intervalMs = getIntervalMs();
    if (args.demoOrbit) {
      simCleanup?.();
      simCleanup = null;
    } else {
      simCleanup = await startSimConnectSession(sendLog);
    }
    stopLoop = startPositionLoop(
      baseUrl,
      token,
      intervalMs,
      args.demoOrbit,
      (err) => {
        sendLog(`Error: ${err.message}`);
      },
      args.demoOrbit ? undefined : getLiveSimPosition,
    );
    running = true;
    sendLog(
      `Sending → ${baseUrl}/api/plane-position every ${intervalMs} ms` +
        (args.demoOrbit ? " (demo orbit)" : " (SimConnect live when connected)"),
    );
    return { ok: true };
  },
);

ipcMain.handle("ezfl:stop", async () => {
  if (stopLoop) {
    stopLoop();
    stopLoop = null;
  }
  if (simCleanup) {
    simCleanup();
    simCleanup = null;
  }
  running = false;
  sendLog("Stopped.");
});

ipcMain.handle("ezfl:open-external", async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle("ezfl:get-msfs-path", async () => {
  const c = await loadConfig();
  return c.msfsCommunityPath ?? null;
});

ipcMain.handle("ezfl:set-msfs-path", async (_, dir: string) => {
  const c = await loadConfig();
  c.msfsCommunityPath = dir.trim();
  await saveConfig(c);
});

ipcMain.handle("ezfl:browse-msfs-folder", async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const r = await dialog.showOpenDialog(win ?? undefined, {
    properties: ["openDirectory"],
    title: "Select MSFS Community folder",
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  await saveConfig({ ...(await loadConfig()), msfsCommunityPath: p });
  return p;
});

ipcMain.handle(
  "ezfl:download-addon-dll",
  async (_, args?: { branch?: string }) => {
    const branch = args?.branch ?? "main";
    const url = getDllRawUrl(branch);
    if (!isAllowedGithubDllUrl(url)) {
      return { ok: false, error: "Invalid download URL configuration." };
    }
    const c = await loadConfig();
    const root = c.msfsCommunityPath?.trim();
    if (!root) {
      return {
        ok: false,
        error: "Set your MSFS Community folder first (Browse or paste path).",
      };
    }
    if (!existsSync(root)) {
      return { ok: false, error: "That folder does not exist." };
    }
    const destDir = path.join(root, ADDON_INSTALL_FOLDER);
    const destFile = path.join(destDir, DLL_FILENAME);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return {
          ok: false,
          error: `Download failed (HTTP ${res.status}). Push ${DLL_FILENAME} to ${branch} at ${DLL_PATH_IN_REPO} in the repo.`,
        };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 256) {
        return {
          ok: false,
          error: "Downloaded file is too small to be a valid DLL.",
        };
      }
      await fs.mkdir(destDir, { recursive: true });
      await fs.writeFile(destFile, buf);
      sendLog(`Addon DLL installed: ${destFile}`);
      return { ok: true, savedPath: destFile };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  },
);

ipcMain.handle("ezfl:get-addon-info", async () => ({
  repoUrl: getRepoPageUrl(),
  dllUrl: getDllRawUrl(),
  installFolder: ADDON_INSTALL_FOLDER,
  dllFile: DLL_FILENAME,
}));
