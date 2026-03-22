import fs from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  type PlaneReportV1,
  type PlaneSample,
  serializePlaneReportV1,
} from "./plane-report.js";

export type { PlaneSample } from "./plane-report.js";

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Normalize optional nose heading; drops invalid values.
 */
export function normalizeSample(
  base: Omit<PlaneSample, "headingTrueDeg"> & {
    headingTrueDeg?: number;
  },
): PlaneSample {
  const h =
    base.headingTrueDeg !== undefined && Number.isFinite(base.headingTrueDeg)
      ? norm360(base.headingTrueDeg)
      : undefined;
  const { headingTrueDeg: _h, ...rest } = base;
  if (h === undefined) return rest as PlaneSample;
  return { ...rest, headingTrueDeg: h };
}

export const TOKEN_PATH =
  process.env.EZFLPLN_TOKEN_FILE ??
  path.join(homedir(), ".ezflpln", "token");

/** Remove saved bridge token (user must pair again). */
export async function clearSavedToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_PATH);
  } catch {
    /* missing or unreadable */
  }
}

export function getBaseUrl(): string {
  return (
    process.env.EZFLPLN_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  );
}

export function getIntervalMs(): number {
  return Number(process.env.POSITION_INTERVAL_MS ?? 800);
}

export function isDemoOrbitFromEnv(): boolean {
  return (
    process.env.DEMO_ORBIT === "1" || process.env.DEMO_ORBIT === "true"
  );
}

function getDemoOrbit(t: number): PlaneSample {
  const centerLat = 37.6213;
  const centerLng = -122.379;
  const nm = 0.02;
  const rad = (t / 8000) * Math.PI * 2;
  const lat = centerLat + nm * Math.cos(rad);
  const lng =
    centerLng +
    (nm * Math.sin(rad)) / Math.cos((centerLat * Math.PI) / 180);
  const headingTrueDeg = norm360((rad * 180) / Math.PI + 90);
  return normalizeSample({
    lat,
    lng,
    headingTrueDeg,
    altitudeFt: 3500,
    groundSpeedKt: 185,
  });
}

export function getSamplePosition(opts?: {
  demoOrbit?: boolean;
  getLivePosition?: () => PlaneSample | null;
}): PlaneSample {
  const demo = opts?.demoOrbit ?? isDemoOrbitFromEnv();
  if (demo) return getDemoOrbit(Date.now());
  const live = opts?.getLivePosition?.();
  if (
    live &&
    Number.isFinite(live.lat) &&
    Number.isFinite(live.lng)
  ) {
    return normalizeSample(live);
  }
  return normalizeSample({
    lat: 47.4502,
    lng: -122.3088,
    headingTrueDeg: 270,
    altitudeFt: 0,
    groundSpeedKt: 0,
  });
}

export async function redeemCodeAndSave(
  baseUrl: string,
  rawCode: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/bridge/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: rawCode }),
  });
  const data = (await res.json()) as { error?: string; token?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.error ?? `Pairing failed (${res.status})`);
  }
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, data.token, { mode: 0o600 });
  return data.token;
}

export async function resolveTokenFromEnvOrFile(): Promise<string | null> {
  const fromEnv = process.env.EZFLPLN_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const saved = (await fs.readFile(TOKEN_PATH, "utf8")).trim();
    if (saved) return saved;
  } catch {
    /* none */
  }
  return null;
}

export async function postPosition(
  baseUrl: string,
  token: string,
  sample: PlaneSample,
): Promise<void> {
  const body: PlaneReportV1 = serializePlaneReportV1(sample);
  const res = await fetch(`${baseUrl}/api/plane-position`, {
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

export function startPositionLoop(
  baseUrl: string,
  token: string,
  intervalMs: number,
  demoOrbit: boolean,
  onError: (e: Error) => void,
  getLivePosition?: () => PlaneSample | null,
): () => void {
  const tick = async () => {
    try {
      await postPosition(
        baseUrl,
        token,
        getSamplePosition({ demoOrbit, getLivePosition }),
      );
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
