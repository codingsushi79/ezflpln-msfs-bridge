import type { RecvSimObjectData } from "node-simconnect";
import {
  norm360,
  payloadWithHeading,
  type Payload,
} from "./bridge.js";

/** SimConnect GROUND VELOCITY is feet per second; convert to knots. */
const FPS_TO_KT = 0.592483801;

/** Added to raw true heading from SimConnect before POST (degrees). */
const HEADING_OFFSET_DEG = 14;

let latest: Payload | null = null;

/** Latest user aircraft position from SimConnect, if connected. */
export function getLiveSimPosition(): Payload | null {
  return latest;
}

/**
 * Connect to Microsoft Flight Simulator via SimConnect and stream user aircraft
 * position. Windows + MSFS only. Safe no-op on other platforms.
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

  const DEF_POS = 1;
  const REQ_POS = 1;

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
    // INT32 + readInt32 — MSFS packs heading as 32-bit; using FLOAT64 misaligns
    // the buffer so the next reads can pick up longitude bits → bogus ~289°
    // near Boston (-71° lon). Matches node-simconnect simulationVariablesRead sample.
    handle.addToDataDefinition(
      DEF_POS,
      "PLANE HEADING DEGREES TRUE",
      "Degrees",
      SimConnectDataType.INT32,
    );
    handle.addToDataDefinition(
      DEF_POS,
      "GROUND VELOCITY",
      "feet per second",
      SimConnectDataType.FLOAT64,
    );

    handle.requestDataOnSimObject(
      REQ_POS,
      DEF_POS,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SECOND,
    );

    const onData = (recv: RecvSimObjectData) => {
      if (recv.requestID !== REQ_POS) return;
      try {
        const pos = readLatLonAlt(recv.data);
        const headingRaw = recv.data.readInt32();
        const fps = recv.data.readFloat64();
        let heading: number | undefined = Number.isFinite(headingRaw)
          ? ((headingRaw % 360) + 360) % 360
          : undefined;
        if (heading !== undefined) {
          const lonH = ((pos.longitude % 360) + 360) % 360;
          if (Math.abs(heading - lonH) < 0.75) {
            heading = undefined;
          } else {
            heading = norm360(heading + HEADING_OFFSET_DEG);
          }
        }
        const speedKt = Number.isFinite(fps) ? fps * FPS_TO_KT : undefined;
        latest = payloadWithHeading({
          lat: pos.latitude,
          lng: pos.longitude,
          heading,
          altitudeFt: pos.altitude,
          speedKt,
        });
      } catch {
        /* ignore malformed packets */
      }
    };

    const onEnd = () => {
      latest = null;
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
      latest = null;
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    onLog(
      `SimConnect: not connected (${msg}). Start MSFS, then start sending again.`,
    );
    return () => {};
  }
}
