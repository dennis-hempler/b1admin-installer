import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The only paths the installer ever stages/commits in the private deployment
// repository. installer-commit stages exactly these; installer-start's
// "Private repository synced" check watches exactly these, so stray files
// (e.g. .DS_Store) neither get committed nor wedge the guided runner.
export const DEPLOY_REPO_SAFE_PATHS = [
  "README.md",
  ".gitignore",
  ".github",
  "customer-values.sample.json",
  "environments",
  "iam",
  "aws-admin-handoff.md",
];

let customerValuesCache;

function rawCliArg(name) {
  const prefix = `--${name}=`;
  const bareFlag = `--${name}`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === bareFlag) {
      const next = process.argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) return next;
    }
  }
  return "";
}

function toCamelCase(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Bare runs (`npm run installer:run` with no flags) pass no --customer-file, so
// the lookup must fall back to the file's standard location in the deploy repo.
// Without this fallback every customer-value check read empty and the guided
// runner looped forever on "answer the customer setup questions".
function defaultCustomerFile() {
  const deployRepoDir = rawCliArg("deploy-repo-dir") || process.env.DEPLOY_REPO_DIR || "../b1admin-deploy";
  return path.join(deployRepoDir, "customer-values.json");
}

function loadCustomerValues() {
  if (customerValuesCache !== undefined) return customerValuesCache;

  const customerFile = rawCliArg("customer-file") || process.env.CUSTOMER_FILE || defaultCustomerFile();
  const resolvedFile = path.resolve(rootDir, customerFile);
  if (!fs.existsSync(resolvedFile)) {
    customerValuesCache = null;
    return customerValuesCache;
  }

  customerValuesCache = JSON.parse(fs.readFileSync(resolvedFile, "utf8"));

  // If the worksheet names an AWS profile, apply it so the operator never has to
  // export AWS_PROFILE by hand — forgetting that export was the most common way an
  // install pointed at the wrong AWS account. An explicit AWS_PROFILE in the
  // environment still wins, and child processes inherit the value.
  if (!process.env.AWS_PROFILE && typeof customerValuesCache?.awsProfile === "string" && customerValuesCache.awsProfile.trim()) {
    process.env.AWS_PROFILE = customerValuesCache.awsProfile.trim();
  }
  return customerValuesCache;
}

function lookupCustomerValue(name) {
  const values = loadCustomerValues();
  if (!values || typeof values !== "object") return "";

  const environment = rawCliArg("environment") || process.env.ENVIRONMENT || "";
  const candidates = [name, toCamelCase(name), name.toUpperCase().replace(/-/g, "_")];
  const scopes = [
    environment && values.environments?.[environment],
    environment && values[environment],
    values,
  ].filter(Boolean);

  for (const scope of scopes) {
    for (const key of candidates) {
      const value = scope?.[key];
      if (value !== undefined && value !== null && value !== "") return String(value);
    }
  }

  return "";
}

export function getArg(name, fallback = "") {
  const cliValue = rawCliArg(name);
  if (cliValue !== "") return cliValue;

  const customerValue = lookupCustomerValue(name);
  if (customerValue !== "") return customerValue;

  if (name === "region") {
    const awsRegion = lookupCustomerValue("aws-region");
    if (awsRegion !== "") return awsRegion;
  }

  const envName = name.toUpperCase().replace(/-/g, "_");
  return process.env[envName] ?? process.env[name.toUpperCase()] ?? fallback;
}

export function boolArg(name, fallback = false) {
  // An explicit value always wins (--flag=false, --flag false), but a bare --flag
  // means true. Without this, `installer:deploy --confirm` was silently ignored and
  // the run stayed in preview mode with no indication why.
  const explicit = rawCliArg(name);
  if (explicit !== "") return explicit.toLowerCase() === "true";
  if (process.argv.includes(`--${name}`)) return true;
  return getArg(name, fallback ? "true" : "false").toLowerCase() === "true";
}

export function resolveEnvironmentDir(environment, explicitDir = "") {
  if (explicitDir) return path.resolve(rootDir, explicitDir);
  const deployEnvDir = process.env.DEPLOY_ENV_DIR;
  if (deployEnvDir) return path.resolve(rootDir, deployEnvDir, environment);
  return path.join(rootDir, "infrastructure", "environments", environment);
}

export function relativeToRoot(targetPath) {
  return path.relative(rootDir, targetPath) || ".";
}

export function runNodeJson(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = null;
  }

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    parsed,
  };
}

export function runNodeText(scriptPath, args, options = {}) {
  const stdio = options.inherit ? "inherit" : "pipe";
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    stdio,
    maxBuffer: 20 * 1024 * 1024,
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export function runCommandJson(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = null;
  }

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    parsed,
  };
}

export function inferDeployRepo(explicitRepo = "") {
  if (explicitRepo) return explicitRepo;
  if (process.env.DEPLOY_REPO) return process.env.DEPLOY_REPO;
  return "";
}

export function defaultStackNames(environment) {
  return {
    backend: `b1admin-${environment}-backend`,
    frontend: `b1admin-${environment}-frontend`,
  };
}

export function requireEnvironmentDir(environmentDir) {
  if (fs.existsSync(environmentDir)) return;
  throw new Error(`Environment directory does not exist: ${relativeToRoot(environmentDir)}`);
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function printJson(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export function failText(message, outputMode = "text", extra = {}) {
  if (outputMode === "json") {
    printJson({ ok: false, errors: [message], ...extra });
  } else {
    console.error(message);
  }
  process.exit(1);
}

const failureHints = [
  {
    pattern: /Unable to locate credentials|InvalidClientTokenId|ExpiredToken|security token.*(?:invalid|expired)|SSO session.*expired|Token has expired/i,
    hint: "This looks like an AWS sign-in problem. Sign in to the AWS CLI again using your normal method (for example `aws configure` or your organization's AWS sign-in), then retry.",
  },
  {
    pattern: /AccessDenied|not authorized to perform/i,
    hint: "Your AWS sign-in does not have permission for this action. Sign in as someone who can manage this AWS account, or send `aws-admin-handoff.md` to whoever manages it.",
  },
  {
    pattern: /gh auth login|not logged into any GitHub hosts|Bad credentials|HTTP 401/i,
    hint: "This looks like a GitHub sign-in problem. Run `gh auth login -h github.com`, finish signing in, then retry.",
  },
  {
    pattern: /command not found|is not recognized as an internal or external command|spawn .* ENOENT/i,
    hint: "A required tool is missing on this computer. Run `npm run installer:doctor -- --output=markdown` to see which tools still need to be installed.",
  },
  {
    pattern: /Could not resolve host|getaddrinfo|ETIMEDOUT|ECONNRESET|ENETUNREACH|network is unreachable/i,
    hint: "This looks like a network problem. Check your internet connection, then retry.",
  },
  {
    pattern: /Could not connect to the endpoint URL|InvalidRegion/i,
    hint: "The AWS region looks wrong. Check the AWS region answer in `npm run installer:customer-values` (normally `us-east-1`).",
  },
];

export function explainFailure(text) {
  const combined = String(text || "");
  for (const { pattern, hint } of failureHints) {
    if (pattern.test(combined)) return hint;
  }
  return "";
}

export function latestWorkflowRunId(repo) {
  return listRecentWorkflowRuns(repo)[0]?.databaseId?.toString() || "";
}

function listRecentWorkflowRuns(repo) {
  const args = [
    "run",
    "list",
    "--workflow",
    "deploy-aws-self-hosted.yml",
    "--limit",
    "20",
    "--json",
    "databaseId,createdAt",
  ];
  if (repo) args.push("--repo", repo);
  try {
    const parsed = JSON.parse(execFileSync("gh", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 4 * 1024 * 1024,
    }));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Resolves the run id for a dispatch that was just issued.
 *
 * GitHub registers dispatched runs asynchronously, so the top of `gh run list` is
 * often still the *previous* run of this workflow — and a previous run almost always
 * exists, because the guided flow dispatches preview and then confirm. Selecting by
 * "newer than the moment we dispatched" and waiting for one to appear avoids watching
 * the wrong run and downloading its evidence.
 *
 * Falls back to the newest run only after the wait elapses, so behavior degrades to
 * the previous best-effort guess rather than failing the deploy.
 */
export function workflowRunIdSince(repo, dispatchedAtMs, { attempts = 10, delayMs = 3000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidates = listRecentWorkflowRuns(repo)
      .filter((run) => {
        const createdAt = Date.parse(run.createdAt);
        return Number.isFinite(createdAt) && createdAt >= dispatchedAtMs;
      })
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    if (candidates.length > 0) {
      return { runId: candidates[0].databaseId.toString(), correlated: true };
    }
    if (attempt < attempts - 1) sleepSync(delayMs);
  }

  return { runId: latestWorkflowRunId(repo), correlated: false };
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
