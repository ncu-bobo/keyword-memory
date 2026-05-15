import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDir = join(root, "apps/mobile");
const manifestPath = join(mobileDir, "src/manifest.json");
const appBuildDir = join(mobileDir, "dist/build/app");
const macHBuilderCli = "/Applications/HBuilderX.app/Contents/MacOS/cli";

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const checks = [
  {
    label: "App-Plus resources",
    ok: await exists(appBuildDir),
    detail: appBuildDir,
  },
  {
    label: "DCloud appid",
    ok: typeof manifest.appid === "string" && !manifest.appid.includes("KEYWORDMEMORY"),
    detail: manifest.appid || "(missing)",
  },
  {
    label: "Android package name",
    ok: Boolean(manifest["app-plus"]?.distribute?.android?.packagename),
    detail: manifest["app-plus"]?.distribute?.android?.packagename || "(missing)",
  },
  {
    label: "HBuilderX CLI",
    ok: await exists(macHBuilderCli),
    detail: macHBuilderCli,
  },
];

for (const check of checks) {
  console.log(`${check.ok ? "OK " : "TODO"} ${check.label}: ${check.detail}`);
}

const ready = checks.every((check) => check.ok);

if (!ready) {
  console.log("");
  console.log("Next step: run `npm run build:mobile:app`, then package the APK with HBuilderX after assigning a DCloud appid.");
  process.exitCode = 1;
}
