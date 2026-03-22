/**
 * Wire format for POST /api/plane-position (must stay in sync with
 * ezflpln/src/lib/bridge-plane-report.ts).
 */
export const PLANE_REPORT_SCHEMA_VERSION = 1 as const;

export type PlaneReportV1 = {
  schemaVersion: typeof PLANE_REPORT_SCHEMA_VERSION;
  lat: number;
  lng: number;
  /** True heading of aircraft nose, degrees true [0, 360). */
  headingTrueDeg?: number;
  /** True track over ground (optional; bridge does not send). */
  trackTrueDeg?: number;
  /** Altitude MSL, feet. */
  altitudeFt?: number;
  /** Ground speed, knots. */
  groundSpeedKt?: number;
};

/** In-memory sample before serialization (SimConnect / demo / fallback). */
export type PlaneSample = {
  lat: number;
  lng: number;
  headingTrueDeg?: number;
  altitudeFt?: number;
  groundSpeedKt?: number;
};

export function serializePlaneReportV1(sample: PlaneSample): PlaneReportV1 {
  const r: PlaneReportV1 = {
    schemaVersion: PLANE_REPORT_SCHEMA_VERSION,
    lat: sample.lat,
    lng: sample.lng,
  };
  if (sample.headingTrueDeg !== undefined) {
    r.headingTrueDeg = sample.headingTrueDeg;
  }
  if (sample.altitudeFt !== undefined) {
    r.altitudeFt = sample.altitudeFt;
  }
  if (sample.groundSpeedKt !== undefined) {
    r.groundSpeedKt = sample.groundSpeedKt;
  }
  return r;
}
