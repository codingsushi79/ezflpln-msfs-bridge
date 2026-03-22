import * as readline from "node:readline/promises";
import {
  getBaseUrl,
  getIntervalMs,
  isDemoOrbitFromEnv,
  redeemCodeAndSave,
  resolveTokenFromEnvOrFile,
  startPositionLoop,
} from "./bridge.js";
import { getLiveSimPosition, startSimConnectSession } from "./simconnect.js";

async function promptForCode(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (
      await rl.question(
        "Bridge link code (6 characters from the website, signed in): ",
      )
    ).trim();
  } finally {
    rl.close();
  }
}

async function resolveToken(): Promise<string> {
  const existing = await resolveTokenFromEnvOrFile();
  if (existing) {
    console.error("Using EZFLPLN_TOKEN or saved token file.");
    return existing;
  }
  console.error(
    "No token — open the website signed in, generate a bridge code, and enter it.",
  );
  const code = await promptForCode();
  return redeemCodeAndSave(getBaseUrl(), code);
}

async function main(): Promise<void> {
  const baseUrl = getBaseUrl();
  const token = await resolveToken();
  const intervalMs = getIntervalMs();
  const demo = isDemoOrbitFromEnv();
  let simStop: (() => void) | undefined;
  if (!demo) {
    try {
      simStop = await startSimConnectSession((m) => console.error(m));
    } catch (e) {
      console.error("SimConnect:", e);
    }
  }
  console.error(
    `ezflpln-msfs-bridge → ${baseUrl}/api/plane-position every ${intervalMs}ms` +
      (demo ? " (DEMO_ORBIT)" : " (SimConnect when available on Windows)"),
  );
  const stopLoop = startPositionLoop(
    baseUrl,
    token,
    intervalMs,
    demo,
    (e) => {
      console.error("position post failed:", e);
    },
    demo ? undefined : getLiveSimPosition,
  );
  const cleanup = () => {
    stopLoop();
    simStop?.();
    process.exit(0);
  };
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
