import { contextBridge, ipcRenderer } from "electron";

export type EzflState = {
  baseUrl: string;
  running: boolean;
  demoOrbit: boolean;
  hasToken: boolean;
  intervalMs: number;
  msfsDataPath: string;
  defaultMsfsRoaming: string | null;
};

export type EzflApi = {
  getState: () => Promise<EzflState>;
  pair: (baseUrl: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  clearSavedLogin: () => Promise<{ ok: boolean }>;
  start: (
    baseUrl: string,
    demoOrbit: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  stop: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  onLog: (fn: (line: string) => void) => () => void;
  getMsfsPath: () => Promise<string | null>;
  setMsfsPath: (dir: string) => Promise<void>;
  useDefaultMsfsPath: () => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
  }>;
  browseMsfsFolder: () => Promise<string | null>;
  downloadAddonDll: () => Promise<{
    ok: boolean;
    error?: string;
    savedPath?: string;
  }>;
  getAddonInfo: () => Promise<{
    repoUrl: string;
    dllUrl: string;
    installFolder: string;
    dllFile: string;
  }>;
  launchMsfsSteam: (edition: "2020" | "2024") => Promise<{ ok: boolean }>;
};

const api: EzflApi = {
  getState: () => ipcRenderer.invoke("ezfl:get-state"),
  pair: (baseUrl, code) => ipcRenderer.invoke("ezfl:pair", { baseUrl, code }),
  clearSavedLogin: () => ipcRenderer.invoke("ezfl:clear-saved-login"),
  start: (baseUrl, demoOrbit) =>
    ipcRenderer.invoke("ezfl:start", { baseUrl, demoOrbit }),
  stop: () => ipcRenderer.invoke("ezfl:stop"),
  openExternal: (url) => ipcRenderer.invoke("ezfl:open-external", url),
  onLog: (fn) => {
    const handler = (_: unknown, line: string) => fn(line);
    ipcRenderer.on("ezfl:log", handler);
    return () => ipcRenderer.removeListener("ezfl:log", handler);
  },
  getMsfsPath: () => ipcRenderer.invoke("ezfl:get-msfs-path"),
  setMsfsPath: (dir) => ipcRenderer.invoke("ezfl:set-msfs-path", dir),
  useDefaultMsfsPath: () => ipcRenderer.invoke("ezfl:use-default-msfs-path"),
  browseMsfsFolder: () => ipcRenderer.invoke("ezfl:browse-msfs-folder"),
  downloadAddonDll: () => ipcRenderer.invoke("ezfl:download-addon-dll"),
  getAddonInfo: () => ipcRenderer.invoke("ezfl:get-addon-info"),
  launchMsfsSteam: (edition) =>
    ipcRenderer.invoke("ezfl:launch-msfs-steam", edition),
};

contextBridge.exposeInMainWorld("ezflpln", api);
