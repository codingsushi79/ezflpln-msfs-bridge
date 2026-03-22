import path from "node:path";

/**
 * Default MSFS data folder on Windows:
 * C:\Users\<username>\AppData\Roaming\Microsoft Flight Simulator
 */
export function getDefaultMsfsRoamingPath(): string | null {
  if (process.platform !== "win32") return null;
  const appdata = process.env.APPDATA?.trim();
  if (!appdata) return null;
  return path.join(appdata, "Microsoft Flight Simulator");
}

/** Steam `rungameid` values (desktop client). */
export const STEAM_APP_MSFS_2020 = "1250410";
export const STEAM_APP_MSFS_2024 = "2537590";
