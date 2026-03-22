import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist-electron");
const rendererOut = path.join(dist, "renderer");

fs.mkdirSync(rendererOut, { recursive: true });

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

run(
  "npx esbuild electron/main.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/main.cjs",
);
run(
  "npx esbuild electron/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs",
);
run(
  "npx esbuild electron/renderer/renderer.ts --bundle --platform=browser --format=iife --target=es2020 --outfile=dist-electron/renderer/renderer.js",
);

for (const f of ["index.html", "renderer.css"]) {
  fs.copyFileSync(
    path.join(root, "electron", "renderer", f),
    path.join(rendererOut, f),
  );
}

console.error("electron bundle → dist-electron/");
