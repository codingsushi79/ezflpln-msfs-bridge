import fs from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type Payload = {
  lat: number;
  lng: number;
  /**
   * True track over ground (degrees true): direction the aircraft is moving,
   * not nose heading. Preferred for the map chevron.
   */
  trackTrueDeg?: number;
  /**
   * Legacy alias: same numeric value as `trackTrueDeg` when sent by this
   * bridge (older clients may only read `heading`).
   */
  heading?: number;
  /** Height / altitude MSL in feet (from sim). */
  altitudeFt?: number;
  /** Ground speed in knots. */
  speedKt?: number;
};

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Normalize lat/lng payload and duplicate track onto `heading` for legacy clients. */
export function payloadWithTrack(
  base: Omit<Payload, "trackTrueDeg" | "heading"> & {
    trackTrueDeg?: number;
    heading?: number;
  },
): Payload {
  const track =
    base.trackTrueDeg !== undefined && Number.isFinite(base.trackTrueDeg)
      ? norm360(base.trackTrueDeg)
      : base.heading !== undefined && Number.isFinite(base.heading)
        ? norm360(base.heading)
        : undefined;
  const { trackTrueDeg: _t, heading: _h, ...rest } = base;
  if (track === undefined) return rest as Payload;
  return {
    ...rest,
    trackTrueDeg: track,
    heading: track,
  };
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

function getDemoOrbit(t: number): Payload {
  const centerLat = 37.6213;
  const centerLng = -122.379;
  const nm = 0.02;
  const rad = (t / 8000) * Math.PI * 2;
  const lat = centerLat + nm * Math.cos(rad);
  const lng =
    centerLng +
    (nm * Math.sin(rad)) / Math.cos((centerLat * Math.PI) / 180);
  const trackTrueDeg = norm360((rad * 180) / Math.PI + 90);
  return payloadWithTrack({
    lat,
    lng,
    trackTrueDeg,
    altitudeFt: 3500,
    speedKt: 185,
  });
}

export function getSamplePosition(opts?: {
  demoOrbit?: boolean;
  getLivePosition?: () => Payload | null;
}): Payload {
  const demo = opts?.demoOrbit ?? isDemoOrbitFromEnv();
  if (demo) return getDemoOrbit(Date.now());
  const live = opts?.getLivePosition?.();
  if (
    live &&
    Number.isFinite(live.lat) &&
    Number.isFinite(live.lng)
  ) {
    return payloadWithTrack(live);
  }
  return payloadWithTrack({
    lat: 47.4502,
    lng: -122.3088,
    trackTrueDeg: 270,
    altitudeFt: 0,
    speedKt: 0,
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
  body: Payload,
): Promise<void> {
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
  getLivePosition?: () => Payload | null,
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
