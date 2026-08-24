import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Single source of truth for the default B1Admin/Api versions the installer deploys.
// The defaults are pinned to the last end-to-end-verified SHAs (see tested-source-refs.json
// at the repo root) so a fresh install is not exposed to whatever landed on upstream main
// an hour ago. Operators can still pass --b1admin-ref=main / --api-ref=main explicitly.
const refsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "tested-source-refs.json");
const refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));

export const testedB1AdminRepo = refs.b1admin.repo;
export const testedB1AdminRef = refs.b1admin.ref;
export const testedApiRepo = refs.api.repo;
export const testedApiRef = refs.api.ref;
export const testedAt = refs.testedAt;
