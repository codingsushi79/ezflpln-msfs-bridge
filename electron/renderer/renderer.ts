type EzflState = {
  baseUrl: string;
  running: boolean;
  demoOrbit: boolean;
  hasToken: boolean;
  intervalMs: number;
  msfsDataPath: string;
  defaultMsfsRoaming: string | null;
};

type EzflApi = {
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

function applyLinkedUi(
  hasToken: boolean,
  linkedStatus: HTMLElement,
  btnClear: HTMLButtonElement,
  codeEl: HTMLInputElement,
): void {
  if (hasToken) {
    linkedStatus.textContent =
      "Linked on this PC — your token is saved. You do not need a new code unless you clear login.";
    linkedStatus.classList.remove("muted");
    linkedStatus.classList.add("ok");
    btnClear.hidden = false;
    codeEl.placeholder = "Optional — new code only if you cleared login";
  } else {
    linkedStatus.textContent =
      "Not linked yet — enter a bridge code from the website once.";
    linkedStatus.classList.add("muted");
    linkedStatus.classList.remove("ok");
    btnClear.hidden = true;
    codeEl.placeholder = "6 characters";
  }
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
  const btnDefaultMsfs = $("btnDefaultMsfs") as HTMLButtonElement;
  const btnDownloadDll = $("btnDownloadDll") as HTMLButtonElement;
  const openRepo = $("openRepo") as HTMLButtonElement;
  const linkedStatus = $("linkedStatus");
  const btnClearLogin = $("btnClearLogin") as HTMLButtonElement;
  const btnSteam2020 = $("btnSteam2020") as HTMLButtonElement;
  const btnSteam2024 = $("btnSteam2024") as HTMLButtonElement;

  const state = await api.getState();
  baseUrlEl.value = state.baseUrl;
  demoEl.checked = state.demoOrbit;
  msfsPathEl.value = state.msfsDataPath;
  applyLinkedUi(state.hasToken, linkedStatus, btnClearLogin, codeEl);

  if (state.running) {
    btnStart.disabled = true;
    btnStop.disabled = false;
    statusEl.textContent = "Sending position…";
  }
  if (state.hasToken) {
    appendLog("Saved token on this PC — Start sending without pairing again.");
  }

  api.onLog((line) => appendLog(line));

  msfsPathEl.addEventListener("blur", () => {
    void api.setMsfsPath(msfsPathEl.value);
  });

  btnBrowseMsfs.addEventListener("click", async () => {
    const p = await api.browseMsfsFolder();
    if (p) msfsPathEl.value = p;
  });

  btnDefaultMsfs.addEventListener("click", async () => {
    const r = await api.useDefaultMsfsPath();
    if (r.ok && r.path) {
      msfsPathEl.value = r.path;
      appendLog(`MSFS folder set to default: ${r.path}`);
    } else {
      appendLog(r.error ?? "Could not set default folder.");
    }
  });

  btnDownloadDll.addEventListener("click", async () => {
    await api.setMsfsPath(msfsPathEl.value);
    btnDownloadDll.disabled = true;
    btnDownloadDll.textContent = "Downloading…";
    btnDownloadDll.classList.remove("btn-dll--ok", "btn-dll--err");
    try {
      const r = await api.downloadAddonDll();
      if (r.ok && r.savedPath) {
        appendLog(`DLL saved: ${r.savedPath}`);
        btnDownloadDll.textContent = "DLL installed";
        btnDownloadDll.classList.remove("btn-dll--err");
        btnDownloadDll.classList.add("btn-dll--ok");
      } else {
        const msg = r.error ?? "Download failed";
        appendLog(msg);
        const short =
          msg.length > 52 ? `${msg.slice(0, 49)}…` : msg;
        btnDownloadDll.textContent = short;
        btnDownloadDll.classList.remove("btn-dll--ok");
        btnDownloadDll.classList.add("btn-dll--err");
      }
    } finally {
      btnDownloadDll.disabled = false;
    }
  });

  openRepo.addEventListener("click", async () => {
    const info = await api.getAddonInfo();
    await api.openExternal(info.repoUrl);
  });

  btnClearLogin.addEventListener("click", async () => {
    await api.clearSavedLogin();
    const s = await api.getState();
    applyLinkedUi(s.hasToken, linkedStatus, btnClearLogin, codeEl);
    statusEl.textContent = "Login cleared";
  });

  btnSteam2020.addEventListener("click", () => {
    void api.launchMsfsSteam("2020");
  });
  btnSteam2024.addEventListener("click", () => {
    void api.launchMsfsSteam("2024");
  });

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
      if (r.ok) {
        statusEl.textContent = "Linked — ready to send";
        const s = await api.getState();
        applyLinkedUi(s.hasToken, linkedStatus, btnClearLogin, codeEl);
      } else {
        statusEl.textContent = r.error ?? "Pair failed";
      }
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
