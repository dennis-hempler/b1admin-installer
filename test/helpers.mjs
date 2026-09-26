import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1admin-check-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Runs an installer script as the operator would, but offline and isolated:
// - The environment is rebuilt from scratch because the scripts' getArg() falls
//   back to env vars (REGION, ENVIRONMENT, OUTPUT, AWS_PROFILE, ...), so a
//   developer's shell would otherwise leak into the result.
// - `gh` and `aws` are stubbed to fail, so nothing can reach GitHub or AWS even
//   on a machine where both are installed and logged in.
export function runScript(t, script, args = [], { cwd = rootDir } = {}) {
  const binDir = makeTempDir(t);
  for (const tool of ["gh", "aws"]) {
    const stub = path.join(binDir, tool);
    fs.writeFileSync(stub, `#!/bin/sh\necho "${tool} is stubbed out by npm run check" >&2\nexit 1\n`);
    fs.chmodSync(stub, 0o755);
  }

  const result = spawnSync(process.execPath, [path.join(rootDir, "scripts", script), ...args], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      HOME: makeTempDir(t),
    },
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  return result;
}

export function parseJsonOutput(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Expected JSON on stdout.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
}
