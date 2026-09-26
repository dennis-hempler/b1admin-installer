import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { makeTempDir, parseJsonOutput, runScript } from "./helpers.mjs";

const staging = "infrastructure/environments/staging";

test("validate-aws-deploy: bootstrap mode accepts the staging starter", (t) => {
  const result = runScript(t, "validate-aws-deploy.mjs", [
    "--mode=bootstrap",
    `--parameters-file=${staging}/bootstrap-parameters.json`,
    "--output=json",
  ]);
  const report = parseJsonOutput(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.ok, true);
  assert.equal(report.checkAws, false);
  assert.equal(report.environmentName, "staging");
  assert.deepEqual(report.errors, []);
});

test("validate-aws-deploy: split-stack mode derives the backend artifact key", (t) => {
  const result = runScript(t, "validate-aws-deploy.mjs", [
    "--mode=split-stack",
    `--backend-parameters-file=${staging}/backend-parameters.json`,
    `--frontend-parameters-file=${staging}/frontend-parameters.json`,
    "--output=json",
  ]);
  const report = parseJsonOutput(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.ok, true);
  assert.equal(report.resolved.artifactKey, "b1admin/staging/backend/api.zip");
});

for (const badName of ["Bad_Bucket", "ab", "192.168.1.1", "bucket..name", "bucket-.name", "-bucket"]) {
  test(`validate-aws-deploy: rejects the S3 bucket name "${badName}"`, (t) => {
    const result = runScript(t, "validate-aws-deploy.mjs", [
      "--mode=bootstrap",
      `--parameters-file=${staging}/bootstrap-parameters.json`,
      `--template-bucket-name=${badName}`,
      "--output=json",
    ]);
    const report = parseJsonOutput(result);
    assert.equal(result.status, 1);
    assert.equal(report.ok, false);
    assert.ok(report.errors.includes("TemplateBucketName must be a valid S3 bucket name when provided explicitly."), report.errors.join("\n"));
  });
}

test("validate-aws-deploy: reports a parameters file it cannot read", (t) => {
  const result = runScript(t, "validate-aws-deploy.mjs", [
    "--mode=bootstrap",
    `--parameters-file=${path.join(makeTempDir(t), "missing.json")}`,
    "--output=json",
  ]);
  const report = parseJsonOutput(result);
  assert.equal(result.status, 1);
  assert.ok(report.errors.some((error) => error.startsWith("Parameters file could not be loaded:")), report.errors.join("\n"));
});

test("validate-aws-deploy: reports a parameters file that is not JSON", (t) => {
  const file = path.join(makeTempDir(t), "broken.json");
  fs.writeFileSync(file, "{ not json");
  const result = runScript(t, "validate-aws-deploy.mjs", ["--mode=bootstrap", `--parameters-file=${file}`, "--output=json"]);
  assert.equal(result.status, 1);
  assert.ok(parseJsonOutput(result).errors.some((error) => error.startsWith("Parameters file could not be loaded:")));
});

test("validate-aws-deploy: refuses the removed full-stack mode", (t) => {
  const result = runScript(t, "validate-aws-deploy.mjs", ["--mode=full-stack"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /full-stack deployment mode has been removed/);
});
