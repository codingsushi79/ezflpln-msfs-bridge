type EzflApi = {
  getState: () => Promise<{
    baseUrl: string;
    running: boolean;
    demoOrbit: boolean;
    hasToken: boolean;
    intervalMs: number;
  }>;
  pair: (
    baseUrl: string,
    code: string,
  ) => Promise<{ ok: boolean; error?: string }>;
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

declare global {
  interface Window {
    ezflpln: EzflApi;
  }
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function appendLog(line: string): void {
  const log = $("log") as HTMLPreElement;
  const t = new Date().toLocaleTimeString();
  log.textContent += `[${t}] ${line}\n`;
  log.scrollTop = log.scrollHeight;
}

async function init(): Promise<void> {
  const api = window.ezflpln;
  const baseUrlEl = $("baseUrl") as HTMLInputElement;
  const codeEl = $("code") as HTMLInputElement;
  const demoEl = $("demoOrbit") as HTMLInputElement;
  const btnPair = $("btnPair") as HTMLButtonElement;
  const btnStart = $("btnStart") as HTMLButtonElement;
  const btnStop = $("btnStop") as HTMLButtonElement;
  const statusEl = $("status");
  const openSite = $("openSite") as HTMLButtonElement;
  const msfsPathEl = $("msfsPath") as HTMLInputElement;
  const btnBrowseMsfs = $("btnBrowseMsfs") as HTMLButtonElement;
  const btnDownloadDll = $("btnDownloadDll") as HTMLButtonElement;
  const openRepo = $("openRepo") as HTMLButtonElement;

  const savedPath = await api.getMsfsPath();
  if (savedPath) msfsPathEl.value = savedPath;

  msfsPathEl.addEventListener("blur", () => {
    void api.setMsfsPath(msfsPathEl.value);
  });

  btnBrowseMsfs.addEventListener("click", async () => {
    const p = await api.browseMsfsFolder();
    if (p) msfsPathEl.value = p;
  });

  btnDownloadDll.addEventListener("click", async () => {
    await api.setMsfsPath(msfsPathEl.value);
    btnDownloadDll.disabled = true;
    try {
      const r = await api.downloadAddonDll();
      if (r.ok && r.savedPath) {
        appendLog(`DLL saved: ${r.savedPath}`);
        statusEl.textContent = "Addon DLL installed";
      } else {
        appendLog(r.error ?? "Download failed");
        statusEl.textContent = r.error ?? "Download failed";
      }
    } finally {
      btnDownloadDll.disabled = false;
    }
  });

  openRepo.addEventListener("click", async () => {
    const info = await api.getAddonInfo();
    await api.openExternal(info.repoUrl);
  });

  const state = await api.getState();
  baseUrlEl.value = state.baseUrl;
  demoEl.checked = state.demoOrbit;
  if (state.running) {
    btnStart.disabled = true;
    btnStop.disabled = false;
    statusEl.textContent = "Sending position…";
  }
  if (state.hasToken) {
    appendLog("Saved token found — you can start or link again.");
  }

  api.onLog((line) => appendLog(line));

  codeEl.addEventListener("input", () => {
    codeEl.value = codeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  openSite.addEventListener("click", () => {
    const u = baseUrlEl.value.trim() || "http://localhost:3000";
    void api.openExternal(u.replace(/\/$/, ""));
  });

  btnPair.addEventListener("click", async () => {
    btnPair.disabled = true;
    try {
      const base = baseUrlEl.value.trim();
      const code = codeEl.value.trim();
      if (!base) {
        appendLog("Enter your ezflpln URL first.");
        return;
      }
      if (code.length < 6) {
        appendLog("Enter the 6-character code from the website.");
        return;
      }
      const r = await api.pair(base, code);
      if (r.ok) statusEl.textContent = "Linked — ready to send";
      else statusEl.textContent = r.error ?? "Pair failed";
    } finally {
      btnPair.disabled = false;
    }
  });

  btnStart.addEventListener("click", async () => {
    btnStart.disabled = true;
    try {
      const base = baseUrlEl.value.trim();
      if (!base) {
        appendLog("Enter your ezflpln URL.");
        btnStart.disabled = false;
        return;
      }
      const r = await api.start(base, demoEl.checked);
      if (r.ok) {
        statusEl.textContent = "Sending position…";
        btnStop.disabled = false;
      } else {
        statusEl.textContent = r.error ?? "Start failed";
        appendLog(r.error ?? "Start failed");
        btnStart.disabled = false;
      }
    } catch {
      btnStart.disabled = false;
    }
  });

  btnStop.addEventListener("click", async () => {
    await api.stop();
    statusEl.textContent = "Stopped";
    btnStop.disabled = true;
    btnStart.disabled = false;
  });
}

void init();
