/** Upstream repo that hosts the optional MSFS addon DLL. */
export const GITHUB_REPO_OWNER = "codingsushi79";
export const GITHUB_REPO_NAME = "ezflpln-msfs-bridge";
/** Path inside the repo to the DLL (main branch). */
export const DLL_PATH_IN_REPO = "native/EzflplnBridge.dll";
/** Subfolder created under the user-selected MSFS Community folder. */
export const ADDON_INSTALL_FOLDER = "ezflpln-msfs-bridge";
export const DLL_FILENAME = "EzflplnBridge.dll";

export function getDllRawUrl(branch = "main"): string {
  return `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${branch}/${DLL_PATH_IN_REPO}`;
}

export function getRepoPageUrl(): string {
  return `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
}
