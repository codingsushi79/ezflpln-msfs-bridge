import { contextBridge, ipcRenderer } from "electron";

export type EzflApi = {
  getState: () => Promise<{
    baseUrl: string;
    running: boolean;
    demoOrbit: boolean;
    hasToken: boolean;
    intervalMs: number;
  }>;
  pair: (baseUrl: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  start: (
    baseUrl: string,
    demoOrbit: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  stop: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  onLog: (fn: (line: string) => void) => () => void;
  getMsfsPath: () => Promise<string | null>;
  setMsfsPath: (dir: string) => Promise<void>;
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
};

const api: EzflApi = {
  getState: () => ipcRenderer.invoke("ezfl:get-state"),
  pair: (baseUrl, code) => ipcRenderer.invoke("ezfl:pair", { baseUrl, code }),
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
  browseMsfsFolder: () => ipcRenderer.invoke("ezfl:browse-msfs-folder"),
  downloadAddonDll: () => ipcRenderer.invoke("ezfl:download-addon-dll"),
  getAddonInfo: () => ipcRenderer.invoke("ezfl:get-addon-info"),
};

contextBridge.exposeInMainWorld("ezflpln", api);
