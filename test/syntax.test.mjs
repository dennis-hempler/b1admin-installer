import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { rootDir } from "./helpers.mjs";

function listFiles(dir, extension) {
  return fs.readdirSync(dir, { recursive: true })
    .filter((name) => name.endsWith(extension))
    .map((name) => path.join(dir, name))
    .sort();
}

const nodeScripts = listFiles(path.join(rootDir, "scripts"), ".mjs");
const shellScripts = listFiles(path.join(rootDir, "infrastructure"), ".sh");

test("finds the installer scripts", () => {
  assert.ok(nodeScripts.length > 50, `only found ${nodeScripts.length} scripts`);
  assert.ok(shellScripts.length > 0, "found no shell scripts");
});

for (const file of nodeScripts) {
  test(`node --check ${path.relative(rootDir, file)}`, () => {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  });
}

for (const file of shellScripts) {
  test(`bash -n ${path.relative(rootDir, file)}`, () => {
    const result = spawnSync("bash", ["-n", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  });
}

test("every npm script points at a file that exists", () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  for (const [name, command] of Object.entries(scripts)) {
    const match = command.match(/^node (scripts\/\S+\.mjs)$/);
    if (!match) continue;
    assert.ok(fs.existsSync(path.join(rootDir, match[1])), `npm run ${name}: ${match[1]} is missing`);
  }
});
