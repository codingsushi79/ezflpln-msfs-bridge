import type { RecvSimObjectData } from "node-simconnect";
import { payloadWithTrack, type Payload } from "./bridge.js";

/** SimConnect GROUND VELOCITY is feet per second; convert to knots. */
const FPS_TO_KT = 0.592483801;

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
    handle.addToDataDefinition(
      DEF_POS,
      "GPS GROUND TRUE TRACK",
      "degrees",
      SimConnectDataType.FLOAT64,
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
        const trackRaw = recv.data.readFloat64();
        const fps = recv.data.readFloat64();
        const trackTrueDeg = Number.isFinite(trackRaw)
          ? ((trackRaw % 360) + 360) % 360
          : undefined;
        const speedKt = Number.isFinite(fps) ? fps * FPS_TO_KT : undefined;
        latest = payloadWithTrack({
          lat: pos.latitude,
          lng: pos.longitude,
          trackTrueDeg,
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
