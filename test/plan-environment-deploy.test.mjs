import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseJsonOutput, rootDir, runScript } from "./helpers.mjs";

// plan-environment-deploy only prints a plan; it never deploys. With gh and aws
// stubbed out it runs fully offline, so the plan it builds from the starter
// files in this repo can be checked exactly.
const testedRefs = JSON.parse(fs.readFileSync(path.join(rootDir, "tested-source-refs.json"), "utf8"));

for (const environment of ["staging", "prod"]) {
  test(`plan-environment-deploy: builds the ${environment} plan from the starter files`, (t) => {
    const plan = parseJsonOutput(runScript(t, "plan-environment-deploy.mjs", [`--environment=${environment}`, "--output=json"]));
    assert.equal(plan.environment, environment);
    assert.equal(plan.region, "us-east-1");
    assert.deepEqual(plan.stackNames, {
      bootstrap: `b1admin-${environment}-bootstrap`,
      backend: `b1admin-${environment}-backend`,
      frontend: `b1admin-${environment}-frontend`,
    });
    assert.equal(plan.workflowInputs.environment, environment);
    assert.equal(plan.workflowInputs.b1admin_ref, testedRefs.b1admin.ref);
    assert.equal(plan.workflowInputs.api_ref, testedRefs.api.ref);
  });
}

test("plan-environment-deploy: the unfilled starter is blocked on its replace-me values", (t) => {
  const result = runScript(t, "plan-environment-deploy.mjs", ["--environment=staging", "--output=json"]);
  const plan = parseJsonOutput(result);
  assert.equal(result.status, 1);
  assert.equal(plan.ok, false);
  const bootstrapBlocker = plan.blockers.find((blocker) => blocker.file?.endsWith("staging/bootstrap-parameters.json"));
  assert.ok(bootstrapBlocker, JSON.stringify(plan.blockers, null, 2));
  assert.deepEqual(bootstrapBlocker.keys, ["TemplateBucketName", "ArtifactBucketName"]);
});

test("plan-environment-deploy: passes explicit refs through to the workflow inputs", (t) => {
  const plan = parseJsonOutput(runScript(t, "plan-environment-deploy.mjs", [
    "--environment=staging",
    "--b1admin-ref=v1.2.3",
    "--api-ref=v4.5.6",
    "--region=eu-west-1",
    "--output=json",
  ]));
  assert.equal(plan.workflowInputs.b1admin_ref, "v1.2.3");
  assert.equal(plan.workflowInputs.api_ref, "v4.5.6");
  assert.equal(plan.workflowInputs.aws_region, "eu-west-1");
});

test("plan-environment-deploy: rejects an unknown environment", (t) => {
  const result = runScript(t, "plan-environment-deploy.mjs", ["--environment=nope", "--output=json"]);
  assert.equal(result.status, 1);
  assert.deepEqual(parseJsonOutput(result), { ok: false, environment: "nope", errors: ['Unknown environment starter "nope".'] });
});
