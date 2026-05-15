import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDir = join(root, "apps/mobile");
const hbuilderCli = process.env.HBUILDERX_CLI || "/Applications/HBuilderX.app/Contents/MacOS/cli";

function run(args) {
  const result = spawnSync(hbuilderCli, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("");
  if (output.trim()) {
    process.stdout.write(output);
    if (!output.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`HBuilderX CLI failed: ${args.join(" ")}`);
  }
}

run(["open"]);
run(["project", "open", "--path", mobileDir]);

run([
  "pack",
  "--project",
  mobileDir,
  "--platform",
  "android",
  "--safemode",
  "true",
  "--iscustom",
  "false",
  "--sourceMap",
  "false",
  "--isconfusion",
  "false",
  "--splashads",
  "false",
  "--rpads",
  "false",
  "--unimpads",
  "false",
  "--android.packagename",
  "com.ncubobo.keywordmemory",
  "--android.androidpacktype",
  "3",
  "--android.channels",
  "google",
]);
