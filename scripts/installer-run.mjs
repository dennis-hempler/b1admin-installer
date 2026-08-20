import { spawnSync } from "node:child_process";
import process from "node:process";
import readline from "node:readline/promises";
import {
  boolArg,
  explainFailure,
  getArg,
  printJson,
  rootDir,
  runNodeJson,
} from "./installer-common.mjs";

const runnerArgs = new Set([
  "approve-gates",
  "dry-run",
  "max-steps",
  "output",
  "yes",
]);

function argName(arg) {
  if (!arg.startsWith("--")) return "";
  return arg.replace(/^--/, "").split("=")[0];
}

function startArgs() {
  const args = [];
  const raw = process.argv.slice(2);
  for (let index = 0; index < raw.length; index += 1) {
    const arg = raw[index];
    const name = argName(arg);
    if (name && runnerArgs.has(name)) {
      if (!arg.includes("=") && raw[index + 1] && !raw[index + 1].startsWith("--")) index += 1;
      continue;
    }
    args.push(arg);
  }
  return [...args, "--output=json"];
}

function splitWords(command) {
  const words = [];
  let current = "";
  let quote = "";
  let escaping = false;

  for (const char of command.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) words.push(current);
  return words;
}

function invocationFromCommand(command) {
  const trimmed = command.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const words = splitWords(trimmed);
  if (words[0] === "yarn" && words[1]) {
    return { command: "yarn", args: words.slice(1).filter((word) => word !== "--") };
  }
  if (words[0] === "npm" && words[1] === "install" && words.length === 2) {
    return { command: "npm", args: ["install"] };
  }
  if (words[0] === "npm" && words[1] === "run" && words[2]) {
    return { command: "npm", args: ["run", words[2], ...words.slice(3)] };
  }
  if (words[0] === "cp" && words.length === 3) {
    return { command: "cp", args: words.slice(1) };
  }
  return null;
}

function isApprovalGate(command) {
  return command.includes("installer:deploy")
    || command.includes("--write-secrets=true")
    || command.includes("--apply=true")
    || command.includes("installer:commit")
    || command.includes("installer:bootstrap-admin")
    || command.includes("installer:browser-smoke")
    || command.includes("installer:adopt-frontend-origin")
    || command.includes("installer:report");
}

function checklistProgress(state, nextCheck) {
  const checks = Array.isArray(state.checks) ? state.checks : [];
  if (checks.length === 0) return null;
  return {
    done: checks.filter((check) => check.ok).length,
    total: checks.length,
    position: nextCheck ? checks.indexOf(nextCheck) + 1 : 0,
  };
}

function progressLine(progress) {
  return progress ? `Checklist: ${progress.done} of ${progress.total} items done.` : "";
}

function renderStep(check, gated, progress) {
  const heading = progress && progress.position > 0
    ? `Next up (item ${progress.position} of ${progress.total}): ${check?.label || "Next command"}`
    : `Next up: ${check?.label || "Next command"}`;
  const lines = [
    "",
    progressLine(progress),
    heading,
    check?.detail ? `Status: ${check.detail}` : "",
    gated ? "Approval: this step can change AWS/GitHub state, create a login, launch browser testing, or write sign-off evidence." : "",
    "Command:",
    check?.command || "",
  ].filter(Boolean);
  return lines.join("\n");
}

async function shouldRun(rl, command, options) {
  if (options.dryRun) return false;
  // Routine steps run without asking. The runner only stops for a person when a
  // step can change AWS/GitHub state (gated), fails, or stalls.
  if (!isApprovalGate(command)) return true;
  if (options.approveGates) return true;

  // Without a terminal there is nobody to answer, and awaiting the question would
  // hang forever on a live pipe or exit silently on closed stdin. Say so instead.
  if (!process.stdin.isTTY) {
    throw new Error([
      "This step needs approval before it can change AWS or GitHub state. No terminal is attached, so the question cannot be asked.",
      "",
      "Run this command yourself:",
      `  ${command}`,
      "",
      "Or re-run the installer in a terminal, adding --approve-gates to pre-approve steps like this one.",
    ].join("\n"));
  }

  const answer = await rl.question("Run this command now? [y/N]: ");
  if (answer === null || answer === undefined) return false;
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}

function runStart() {
  const result = runNodeJson("scripts/installer-start.mjs", startArgs());
  if (!result.ok || !result.parsed) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "installer:next did not return JSON.");
  }
  return result.parsed;
}

async function main() {
  const outputMode = getArg("output", "text").toLowerCase();
  // --yes is still accepted (and stripped by runnerArgs) but no longer read:
  // routine steps always run without asking now, which is what it used to enable.
  const options = {
    approveGates: boolArg("approve-gates", false),
    dryRun: boolArg("dry-run", false),
    maxSteps: Number(getArg("max-steps", "30")),
  };
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [];
  let lastRun = null;

  try {
    for (let step = 1; step <= options.maxSteps; step += 1) {
      const state = runStart();
      const nextCommand = String(state.nextCommand || "").trim();
      const nextCheck = state.checks?.find((check) => !check.ok && check.command === nextCommand)
        || state.checks?.find((check) => !check.ok)
        || null;
      const progress = checklistProgress(state, nextCheck);

      if (state.ok || !nextCommand || nextCommand.startsWith("#")) {
        history.push({ step, action: "complete", command: nextCommand });
        if (outputMode === "json") printJson({ ok: true, complete: true, history, state });
        else console.log([progressLine(progress), nextCommand || "Installer run complete."].filter(Boolean).join("\n"));
        return;
      }

      // A command that exits 0 without clearing the checklist item it was meant
      // to fix would otherwise re-run forever with only the step number changing.
      // Stop and say so instead; label is compared too because several checklist
      // items legitimately share one command (the customer-values questionnaire).
      if (lastRun && lastRun.command === nextCommand && lastRun.label === (nextCheck?.label || "")) {
        history.push({ step, action: "stalled", command: nextCommand });
        if (outputMode === "json") {
          printJson({ ok: false, complete: false, stalled: true, command: nextCommand, check: nextCheck?.label || "", history, state });
        } else {
          console.error([
            "",
            "The last command finished successfully, but the installer still reports the same checklist item as incomplete:",
            `  ${nextCheck?.label || nextCommand}`,
            "",
            "Stopping instead of running it again — repeating it would not help.",
            "This usually means the installer is not detecting that step's result, which is a bug in the installer itself.",
            "Please report it to the B1Admin team, including this command:",
            `  ${nextCommand}`,
          ].join("\n"));
        }
        process.exit(1);
      }

      const invocation = invocationFromCommand(nextCommand);
      if (!invocation) {
        history.push({ step, action: "manual", command: nextCommand });
        if (outputMode === "json") printJson({ ok: false, complete: false, manualCommand: nextCommand, history, state });
        else console.log(`Run this command manually, then start installer:run again:\n${nextCommand}`);
        process.exit(1);
      }

      const gated = isApprovalGate(nextCommand);
      if (outputMode !== "json") {
        console.log(renderStep(nextCheck, gated, progress));
        if (!gated && !options.dryRun) console.log("Running it now (no action needed).");
      }
      const runIt = await shouldRun(rl, nextCommand, options);
      if (!runIt) {
        history.push({ step, action: "paused", command: nextCommand });
        if (outputMode === "json") printJson({ ok: true, complete: false, paused: true, command: nextCommand, history, state });
        else console.log([progressLine(progress), "Paused. Run installer:run again when you are ready to continue."].filter(Boolean).join("\n"));
        return;
      }

      history.push({ step, action: "run", command: nextCommand });
      lastRun = { command: nextCommand, label: nextCheck?.label || "" };
      // On Windows, npm is a .cmd shim that spawnSync cannot execute without a shell.
      // Quoting only args containing whitespace left cmd.exe metacharacters live, so
      // any arg with a character cmd treats specially is quoted, and embedded quotes
      // are escaped rather than ending the quoted run.
      const isWindows = process.platform === "win32";
      const quoteForCmd = (arg) => (
        /[\s&|<>^%()"]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg
      );
      const spawnArgs = isWindows ? invocation.args.map(quoteForCmd) : invocation.args;
      const result = spawnSync(invocation.command, spawnArgs, {
        cwd: rootDir,
        encoding: "utf8",
        shell: isWindows,
        stdio: outputMode === "json" ? "pipe" : ["inherit", "inherit", "pipe"],
        maxBuffer: 20 * 1024 * 1024,
      });

      if ((result.status ?? 1) !== 0) {
        const hint = explainFailure(`${result.stdout || ""}\n${result.stderr || ""}`);
        if (outputMode === "json") {
          printJson({
            ok: false,
            complete: false,
            failedCommand: nextCommand,
            status: result.status ?? 1,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            hint,
            history,
          });
        } else {
          if (result.stderr) process.stderr.write(result.stderr);
          console.error("\nThat command did not finish successfully.");
          if (hint) console.error(hint);
          console.error("After fixing the issue, run installer:run again. It will continue from this step.");
        }
        process.exit(result.status ?? 1);
      }
      if (outputMode !== "json" && result.stderr) process.stderr.write(result.stderr);
    }

    const message = `Paused after ${options.maxSteps} step(s). Re-run installer:run to continue.`;
    if (outputMode === "json") {
      printJson({ ok: true, complete: false, paused: true, reason: "max-steps", history });
    } else {
      console.log(message);
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const hint = explainFailure(message);
  console.error(`The installer hit a problem it could not recover from: ${message}`);
  if (hint) console.error(hint);
  console.error("Run `npm run installer:doctor -- --output=markdown` for a readiness report, then run installer:run again.");
  process.exit(1);
});
