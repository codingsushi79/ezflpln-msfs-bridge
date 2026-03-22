import type { RecvSimObjectData } from "node-simconnect";
import { payloadWithHeading, type Payload } from "./bridge.js";

/** SimConnect GROUND VELOCITY is feet per second; convert to knots. */
const FPS_TO_KT = 0.592483801;

const DEF_POS = 1;
const DEF_MOTION = 2;
const REQ_POS = 1;
const REQ_MOTION = 2;

/** Merged from two SimConnect packets (position vs motion) — see publish(). */
const S = {
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
  heading: undefined as number | undefined,
  altitudeFt: undefined as number | undefined,
  speedKt: undefined as number | undefined,
};

let latest: Payload | null = null;

function resetState() {
  S.lat = undefined;
  S.lng = undefined;
  S.heading = undefined;
  S.altitudeFt = undefined;
  S.speedKt = undefined;
  latest = null;
}

function publish() {
  if (!Number.isFinite(S.lat) || !Number.isFinite(S.lng)) return;
  latest = payloadWithHeading({
    lat: S.lat!,
    lng: S.lng!,
    heading: S.heading,
    altitudeFt: S.altitudeFt,
    speedKt: S.speedKt,
  });
}

/** Latest user aircraft position from SimConnect, if connected. */
export function getLiveSimPosition(): Payload | null {
  return latest;
}

/**
 * Connect to Microsoft Flight Simulator via SimConnect and stream user aircraft
 * position. Windows + MSFS only. Safe no-op on other platforms.
 *
 * We use **two** data definitions / requests: packing STRUCT LATLONALT together
 * with heading/velocity in one definition misaligns MSFS buffer layout, which
 * produced bogus heading (~289° = −lon) and bad altitude. Position is one
 * packet; PLANE HEADING + GROUND VELOCITY + PLANE ALTITUDE (MSL ft) is another.
 */
export async function startSimConnectSession(
  onLog: (msg: string) => void,
): Promise<() => void> {
  if (process.platform !== "win32") {
    onLog("SimConnect: skipped (requires Windows with MSFS).");
    return () => {};
  }

  const {
    open,
    Protocol,
    SimConnectConstants,
    SimConnectDataType,
    SimConnectPeriod,
    readLatLonAlt,
  } = await import("node-simconnect");

  try {
    const { recvOpen, handle } = await open(
      "ezflpln EZ Flight Plan Bridge",
      Protocol.KittyHawk,
    );

    onLog(`SimConnect: connected — ${recvOpen.applicationName}`);

    handle.addToDataDefinition(
      DEF_POS,
      "STRUCT LATLONALT",
      null,
      SimConnectDataType.LATLONALT,
    );

    handle.addToDataDefinition(
      DEF_MOTION,
      "PLANE HEADING DEGREES TRUE",
      "degrees",
      SimConnectDataType.FLOAT64,
    );
    handle.addToDataDefinition(
      DEF_MOTION,
      "GROUND VELOCITY",
      "feet per second",
      SimConnectDataType.FLOAT64,
    );
    handle.addToDataDefinition(
      DEF_MOTION,
      "PLANE ALTITUDE",
      "feet",
      SimConnectDataType.FLOAT64,
    );

    handle.requestDataOnSimObject(
      REQ_POS,
      DEF_POS,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SECOND,
    );
    handle.requestDataOnSimObject(
      REQ_MOTION,
      DEF_MOTION,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SECOND,
    );

    const onData = (recv: RecvSimObjectData) => {
      try {
        if (recv.requestID === REQ_POS) {
          const pos = readLatLonAlt(recv.data);
          S.lat = pos.latitude;
          S.lng = pos.longitude;
          publish();
          return;
        }
        if (recv.requestID === REQ_MOTION) {
          const headingRaw = recv.data.readFloat64();
          const fps = recv.data.readFloat64();
          const altFt = recv.data.readFloat64();
          if (Number.isFinite(headingRaw)) {
            S.heading = ((headingRaw % 360) + 360) % 360;
          }
          if (Number.isFinite(fps)) {
            S.speedKt = fps * FPS_TO_KT;
          }
          if (Number.isFinite(altFt)) {
            S.altitudeFt = altFt;
          }
          publish();
          return;
        }
      } catch {
        /* ignore malformed packets */
      }
    };

    const onEnd = () => {
      resetState();
      onLog("SimConnect: connection to simulator ended.");
    };

    handle.on("simObjectData", onData);
    handle.on("quit", onEnd);
    handle.on("close", onEnd);
    handle.on("exception", (ex: unknown) => {
      onLog(`SimConnect: ${String(ex)}`);
    });

    return () => {
      try {
        handle.close();
      } catch {
        /* ignore */
      }
      resetState();
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    onLog(
      `SimConnect: not connected (${msg}). Start MSFS, then start sending again.`,
    );
    return () => {};
  }
}
