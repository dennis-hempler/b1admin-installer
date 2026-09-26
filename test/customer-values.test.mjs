import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { makeTempDir, parseJsonOutput, rootDir, runScript } from "./helpers.mjs";

const testedRefs = JSON.parse(fs.readFileSync(path.join(rootDir, "tested-source-refs.json"), "utf8"));

const completeAnswers = [
  "--account-id=123456789012",
  "--repo=example-org/b1admin-deploy",
  "--root-domain=example.org",
  "--support-email=support@example.org",
  "--support-phone=555-0100",
  "--first-admin-email=admin@example.org",
  "--first-admin-password=abcd-efgh-jkmn",
  "--first-church-name=Example Church",
];

function runCustomerValues(t, customerFile, args = []) {
  return runScript(t, "installer-customer-values.mjs", [
    `--customer-file=${customerFile}`,
    "--interactive=false",
    "--output=json",
    ...args,
  ]);
}

test("customer-values: an empty worksheet lists every required value as missing", (t) => {
  const customerFile = path.join(makeTempDir(t), "customer-values.json");
  const result = runCustomerValues(t, customerFile, ["--write=false"]);
  const report = parseJsonOutput(result);
  assert.equal(result.status, 1);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, [
    "AWS account ID",
    "user's private repository",
    "root domain",
    "support email",
    "support phone",
    "first admin email",
    "temporary first admin password",
    "first church name",
  ]);
  assert.equal(fs.existsSync(customerFile), false, "--write=false must not create the file");
});

test("customer-values: whitespace-only answers still count as missing", (t) => {
  const customerFile = path.join(makeTempDir(t), "customer-values.json");
  const answers = completeAnswers.map((arg) => (arg.startsWith("--support-phone=") ? "--support-phone=   " : arg));
  const report = parseJsonOutput(runCustomerValues(t, customerFile, ["--write=false", ...answers]));
  assert.deepEqual(report.missing, ["support phone"]);
});

test("customer-values: complete answers are written with the tested source refs as defaults", (t) => {
  const customerFile = path.join(makeTempDir(t), "deploy", "customer-values.json");
  const result = runCustomerValues(t, customerFile, completeAnswers);
  const report = parseJsonOutput(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);

  const saved = JSON.parse(fs.readFileSync(customerFile, "utf8"));
  assert.equal(saved.accountId, "123456789012");
  assert.equal(saved.awsRegion, "us-east-1");
  assert.equal(saved.b1adminRef, testedRefs.b1admin.ref);
  assert.equal(saved.apiRef, testedRefs.api.ref);
  assert.deepEqual(Object.keys(saved.environments), ["staging", "prod"]);
});

test("customer-values: a rerun keeps earlier answers and applies new flags", (t) => {
  const customerFile = path.join(makeTempDir(t), "customer-values.json");
  runCustomerValues(t, customerFile, completeAnswers);
  const result = runCustomerValues(t, customerFile, ["--prod-frontend-domain=admin.example.org"]);
  assert.equal(result.status, 0, result.stderr);

  const saved = JSON.parse(fs.readFileSync(customerFile, "utf8"));
  assert.equal(saved.firstChurchName, "Example Church");
  assert.equal(saved.environments.prod.frontendDomain, "admin.example.org");
  assert.equal(saved.environments.staging.frontendDomain, "");
});
