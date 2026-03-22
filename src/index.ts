/**
 * Sends periodic position updates to ezflpln (`POST /api/plane-position`) with
 * `Authorization: Bearer <token>` after signing in (saved token, env, or prompt).
 *
 * Set `EZFLPLN_URL` to your Next origin, e.g. http://localhost:3000
 *
 * For real MSFS data, replace `getSamplePosition()` with SimConnect output.
 */

import fs from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import * as readline from "node:readline/promises";

const BASE =
  process.env.EZFLPLN_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const INTERVAL_MS = Number(process.env.POSITION_INTERVAL_MS ?? 800);
const DEMO_ORBIT =
  process.env.DEMO_ORBIT === "1" || process.env.DEMO_ORBIT === "true";

const TOKEN_PATH =
  process.env.EZFLPLN_TOKEN_FILE ??
  path.join(homedir(), ".ezflpln", "token");

type Payload = {
  lat: number;
  lng: number;
  heading?: number;
  altitudeFt?: number;
};

function getDemoOrbit(t: number): Payload {
  const centerLat = 37.6213;
  const centerLng = -122.379;
  const nm = 0.02;
  const rad = (t / 8000) * Math.PI * 2;
  const lat = centerLat + nm * Math.cos(rad);
  const lng =
    centerLng +
    (nm * Math.sin(rad)) / Math.cos((centerLat * Math.PI) / 180);
  const heading = ((rad * 180) / Math.PI + 90) % 360;
  return { lat, lng, heading, altitudeFt: 3500 };
}

function getSamplePosition(): Payload {
  if (DEMO_ORBIT) return getDemoOrbit(Date.now());
  return {
    lat: 47.4502,
    lng: -122.3088,
    heading: 270,
    altitudeFt: 0,
  };
}

async function bridgeLogin(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const email = (await rl.question("ezflpln account email: ")).trim();
    const password = await rl.question("Password: ");
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        client: "bridge",
      }),
    });
    const data = (await res.json()) as { error?: string; token?: string };
    if (!res.ok || !data.token) {
      throw new Error(data.error ?? `Login failed (${res.status})`);
    }
    await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
    await fs.writeFile(TOKEN_PATH, data.token, { mode: 0o600 });
    console.error(`Saved bridge token to ${TOKEN_PATH}`);
    return data.token;
  } finally {
    rl.close();
  }
}

async function resolveToken(): Promise<string> {
  const fromEnv = process.env.EZFLPLN_TOKEN?.trim();
  if (fromEnv) {
    console.error("Using EZFLPLN_TOKEN from environment.");
    return fromEnv;
  }
  try {
    const saved = (await fs.readFile(TOKEN_PATH, "utf8")).trim();
    if (saved) {
      console.error(`Using saved token from ${TOKEN_PATH}`);
      return saved;
    }
  } catch {
    /* none */
  }
  console.error(
    "No EZFLPLN_TOKEN or saved token — sign in with your ezflpln account (same as the website).",
  );
  return bridgeLogin();
}

async function postPosition(token: string, body: Payload): Promise<void> {
  const res = await fetch(`${BASE}/api/plane-position`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${res.status} ${text}`);
  }
}

async function main(): Promise<void> {
  const token = await resolveToken();
  console.error(
    `ezflpln-msfs-bridge → ${BASE}/api/plane-position every ${INTERVAL_MS}ms` +
      (DEMO_ORBIT ? " (DEMO_ORBIT)" : ""),
  );
  const tick = async () => {
    try {
      await postPosition(token, getSamplePosition());
    } catch (e) {
      console.error("position post failed:", e);
    }
  };
  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
