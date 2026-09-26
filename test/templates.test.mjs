import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { rootDir } from "./helpers.mjs";

// CloudFormation short-form intrinsics (!Ref, !Sub, ...) are custom YAML tags.
// Each one is resolved to its long form ({ "Fn::Sub": ... }) so the checks below
// see the same structure CloudFormation does.
const intrinsics = [
  "And", "Base64", "Cidr", "Equals", "FindInMap", "GetAtt", "GetAZs", "If", "ImportValue",
  "Join", "Not", "Or", "Select", "Split", "Sub", "Transform",
];

function longForm(name, value) {
  if (name === "Ref" || name === "Condition") return { [name]: value };
  if (name === "GetAtt" && typeof value === "string") return { "Fn::GetAtt": value.split(".", 2) };
  return { [`Fn::${name}`]: value };
}

const cloudFormationTags = ["Ref", "Condition", ...intrinsics].flatMap((name) => [
  { tag: `!${name}`, resolve: (value) => longForm(name, value) },
  { tag: `!${name}`, collection: "seq", resolve: (seq) => longForm(name, seq.toJSON()) },
  { tag: `!${name}`, collection: "map", resolve: (map) => longForm(name, map.toJSON()) },
]);

function parseTemplate(file) {
  return parse(fs.readFileSync(file, "utf8"), { customTags: cloudFormationTags, maxAliasCount: -1 });
}

const pseudoParameters = new Set([
  "AWS::AccountId", "AWS::NotificationARNs", "AWS::NoValue", "AWS::Partition",
  "AWS::Region", "AWS::StackId", "AWS::StackName", "AWS::URLSuffix",
]);

// Walks the template and reports every Ref, GetAtt, Sub variable and condition
// name that does not point at something the template declares. This is the
// class of typo CloudFormation otherwise only reports during a real deploy.
function findDanglingReferences(template) {
  const parameters = new Set(Object.keys(template.Parameters || {}));
  const resources = new Set(Object.keys(template.Resources || {}));
  const conditions = new Set(Object.keys(template.Conditions || {}));
  const problems = [];

  const checkRef = (name, where) => {
    if (!parameters.has(name) && !resources.has(name) && !pseudoParameters.has(name)) {
      problems.push(`${where}: Ref to unknown "${name}"`);
    }
  };
  const checkCondition = (name, where) => {
    if (!conditions.has(name)) problems.push(`${where}: unknown condition "${name}"`);
  };

  const walk = (node, where) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${where}[${index}]`));
      return;
    }
    if (!node || typeof node !== "object") return;

    if (typeof node.Ref === "string") checkRef(node.Ref, where);
    if (typeof node.Condition === "string") checkCondition(node.Condition, where);
    if (Array.isArray(node["Fn::If"])) checkCondition(node["Fn::If"][0], where);
    if (Array.isArray(node["Fn::GetAtt"]) && !resources.has(node["Fn::GetAtt"][0])) {
      problems.push(`${where}: GetAtt on unknown resource "${node["Fn::GetAtt"][0]}"`);
    }
    if (node["Fn::Sub"] !== undefined) {
      const [text, variables = {}] = Array.isArray(node["Fn::Sub"]) ? node["Fn::Sub"] : [node["Fn::Sub"]];
      for (const [, name] of String(text).matchAll(/\$\{([^!}][^}]*)\}/g)) {
        if (name in variables) continue;
        const [target, attribute] = name.split(".");
        if (attribute !== undefined && !name.startsWith("AWS::")) {
          if (!resources.has(target)) problems.push(`${where}: Sub \${${name}} on unknown resource`);
        } else {
          checkRef(name, where);
        }
      }
    }

    for (const [key, value] of Object.entries(node)) walk(value, `${where}.${key}`);
  };

  for (const section of ["Conditions", "Resources", "Outputs"]) walk(template[section], section);
  return problems;
}

const templateDir = path.join(rootDir, "infrastructure", "cloudformation");
const templates = fs.readdirSync(templateDir).filter((name) => name.endsWith(".yaml")).sort();

test("finds the three CloudFormation templates", () => {
  assert.deepEqual(templates, ["backend-api.yaml", "bootstrap.yaml", "frontend-site.yaml"]);
});

for (const name of templates) {
  test(`CloudFormation template parses and its references resolve: ${name}`, () => {
    const template = parseTemplate(path.join(templateDir, name));
    assert.equal(template.AWSTemplateFormatVersion, "2010-09-09");
    assert.ok(Object.keys(template.Resources || {}).length > 0, "template has no Resources");
    for (const [logicalId, resource] of Object.entries(template.Resources)) {
      assert.match(resource.Type || "", /^(AWS|Custom)::/, `${logicalId} has no resource Type`);
    }
    assert.deepEqual(findDanglingReferences(template), []);
  });
}

const workflowFiles = [
  ".github/workflows/deploy-aws-self-hosted.yml",
  "infrastructure/environments/private-deployment-workflow.sample.yml",
];

for (const file of workflowFiles) {
  test(`GitHub Actions workflow parses: ${file}`, () => {
    const workflow = parse(fs.readFileSync(path.join(rootDir, file), "utf8"));
    assert.ok(workflow.on, "workflow has no trigger");
    assert.ok(Object.keys(workflow.jobs || {}).length > 0, "workflow has no jobs");
  });
}

const jsonFiles = [
  "tested-source-refs.json",
  ...fs.readdirSync(path.join(rootDir, "infrastructure"), { recursive: true })
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join("infrastructure", name))
    .sort(),
];

for (const file of jsonFiles) {
  test(`JSON parses: ${file}`, () => {
    JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8"));
  });
}
