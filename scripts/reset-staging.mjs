#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getArg, getBooleanArg } from "./lib/arg-utils.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runAws(args, options = {}) {
  const result = spawnSync("aws", args, {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 64,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`aws ${args.join(" ")} failed.\nSTDOUT:\n${result.stdout || ""}\nSTDERR:\n${result.stderr || result.error?.message || ""}`);
  }

  return (result.stdout || "").trim();
}

function runAwsJson(args) {
  const output = runAws(args);
  return output ? JSON.parse(output) : {};
}

function stackExists(stackName, region) {
  try {
    runAws(["cloudformation", "describe-stacks", "--stack-name", stackName, "--region", region, "--output", "json"]);
    return true;
  } catch {
    return false;
  }
}

function secretExists(secretId, region) {
  try {
    runAws(["secretsmanager", "describe-secret", "--secret-id", secretId, "--region", region, "--output", "json"]);
    return true;
  } catch {
    return false;
  }
}

function uniq(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function getStackResource(stackName, logicalId, region) {
  const output = runAwsJson([
    "cloudformation", "describe-stack-resources",
    "--stack-name", stackName,
    "--region", region,
    "--output", "json",
  ]);

  const resources = Array.isArray(output.StackResources) ? output.StackResources : [];
  const match = resources.find((resource) => resource.LogicalResourceId === logicalId);
  return match?.PhysicalResourceId || "";
}

function listBucketNames() {
  const output = runAwsJson(["s3api", "list-buckets", "--output", "json"]);
  return Array.isArray(output.Buckets) ? output.Buckets.map((bucket) => bucket.Name).filter(Boolean) : [];
}

function findBucketsByPrefix(prefixes) {
  const bucketNames = listBucketNames();
  return uniq(bucketNames.filter((name) => prefixes.some((prefix) => name.startsWith(prefix))));
}

function listBucketObjectVersions(bucketName, region) {
  const args = [
    "s3api",
    "list-object-versions",
    "--bucket", bucketName,
    "--region", region,
    "--max-items", "500",
    "--output", "json",
  ];

  return runAwsJson(args);
}

function deleteBucketBatch(bucketName, region, objects) {
  if (objects.length === 0) return;

  const payload = JSON.stringify({
    Objects: objects.map((entry) => ({
      Key: entry.Key,
      VersionId: entry.VersionId,
    })),
    Quiet: true,
  });

  runAws([
    "s3api",
    "delete-objects",
    "--bucket", bucketName,
    "--region", region,
    "--delete", payload,
  ]);
}

function emptyBucket(bucketName, region) {
  if (!bucketName) return;
  if (!bucketExists(bucketName, region)) return;

  while (true) {
    let page;
    try {
      page = listBucketObjectVersions(bucketName, region);
    } catch (error) {
      if (String(error.message || "").includes("NoSuchBucket")) return;
      throw error;
    }
    const objects = [
      ...(page.Versions || []),
      ...(page.DeleteMarkers || []),
    ];

    if (objects.length === 0) break;

    for (let index = 0; index < objects.length; index += 1000) {
      deleteBucketBatch(bucketName, region, objects.slice(index, index + 1000));
    }
  }

  try {
    runAws(["s3", "rm", `s3://${bucketName}`, "--recursive", "--region", region]);
  } catch {
    // `s3 rm` is only a final sweep for any non-versioned remnants.
  }
}

function bucketExists(bucketName, region) {
  try {
    runAws(["s3api", "head-bucket", "--bucket", bucketName, "--region", region]);
    return true;
  } catch {
    return false;
  }
}

function deleteBucket(bucketName, region) {
  if (!bucketName) return;
  if (!bucketExists(bucketName, region)) return;
  runAws(["s3api", "delete-bucket", "--bucket", bucketName, "--region", region]);
}

function listLogGroupsByPrefix(prefix, region) {
  const names = [];
  let nextToken = "";

  while (true) {
    const args = [
      "logs",
      "describe-log-groups",
      "--region", region,
      "--log-group-name-prefix", prefix,
      "--output", "json",
    ];
    if (nextToken) args.push("--next-token", nextToken);

    const output = runAwsJson(args);
    const groups = Array.isArray(output.logGroups) ? output.logGroups : [];
    names.push(...groups.map((group) => group.logGroupName).filter(Boolean));

    nextToken = output.nextToken || "";
    if (!nextToken) break;
  }

  return uniq(names);
}

function deleteLogGroup(logGroupName, region) {
  if (!logGroupName) return;
  try {
    runAws(["logs", "delete-log-group", "--log-group-name", logGroupName, "--region", region]);
  } catch (error) {
    if (String(error.message || "").includes("ResourceNotFoundException")) return;
    throw error;
  }
}

function deleteStack(stackName, region) {
  runAws(["cloudformation", "delete-stack", "--stack-name", stackName, "--region", region]);
  runAws(["cloudformation", "wait", "stack-delete-complete", "--stack-name", stackName, "--region", region], { stdio: "inherit" });
}

function deleteSecret(secretId, region, forceDelete) {
  const args = ["secretsmanager", "delete-secret", "--secret-id", secretId, "--region", region];
  if (forceDelete) args.push("--force-delete-without-recovery");
  else args.push("--recovery-window-in-days", "7");
  runAws(args, { stdio: "inherit" });
}

function getStackParameters(stackName, region) {
  try {
    const output = runAwsJson([
      "cloudformation", "describe-stacks",
      "--stack-name", stackName,
      "--region", region,
      "--output", "json",
    ]);

    const stack = Array.isArray(output.Stacks) ? output.Stacks[0] : null;
    const parameters = Array.isArray(stack?.Parameters) ? stack.Parameters : [];
    const values = {};
    for (const parameter of parameters) {
      if (parameter?.ParameterKey) values[parameter.ParameterKey] = parameter.ParameterValue || "";
    }
    return values;
  } catch {
    return {};
  }
}

// The backend template sets DeletionPolicy: Snapshot on DatabaseCluster, so every teardown
// strands one manual cluster snapshot that CloudFormation will never reclaim. Only the cluster
// carries that policy; the writer instance does not produce its own snapshot.
function listFinalClusterSnapshots(snapshotPrefix, region) {
  const output = runAwsJson([
    "rds", "describe-db-cluster-snapshots",
    "--snapshot-type", "manual",
    "--region", region,
    "--output", "json",
  ]);

  const snapshots = Array.isArray(output.DBClusterSnapshots) ? output.DBClusterSnapshots : [];
  return uniq(snapshots
    .map((snapshot) => snapshot.DBClusterSnapshotIdentifier)
    .filter((identifier) => identifier && identifier.startsWith(snapshotPrefix)));
}

function deleteClusterSnapshot(snapshotId, region) {
  try {
    runAws([
      "rds", "delete-db-cluster-snapshot",
      "--db-cluster-snapshot-identifier", snapshotId,
      "--region", region,
    ]);
  } catch (error) {
    if (String(error.message || "").includes("DBClusterSnapshotNotFoundFault")) return;
    throw error;
  }
}

function parseCertificateRegion(certificateArn) {
  const match = String(certificateArn).match(/^arn:aws:acm:([^:]+):\d{12}:certificate\/.+$/);
  return match ? match[1] : "";
}

function describeCertificate(certificateArn, region) {
  try {
    const output = runAwsJson([
      "acm", "describe-certificate",
      "--certificate-arn", certificateArn,
      "--region", region,
      "--output", "json",
    ]);
    return output.Certificate || null;
  } catch {
    return null;
  }
}

// A `_hash.<sub>.<domain>` name does not say which certificate owns it, and one certificate can
// own several (a SAN adds a record per name), so validation records are always resolved from the
// certificate itself rather than matched by name.
function certificateValidationRecords(certificate) {
  const options = Array.isArray(certificate?.DomainValidationOptions) ? certificate.DomainValidationOptions : [];
  return options
    .map((option) => option.ResourceRecord)
    .filter((record) => record?.Name && record?.Type);
}

function findRecordSet(hostedZoneId, recordName, recordType) {
  try {
    const output = runAwsJson([
      "route53", "list-resource-record-sets",
      "--hosted-zone-id", hostedZoneId,
      "--start-record-name", recordName,
      "--start-record-type", recordType,
      "--max-items", "1",
      "--output", "json",
    ]);

    const sets = Array.isArray(output.ResourceRecordSets) ? output.ResourceRecordSets : [];
    const match = sets[0];
    // --start-record-name returns the first record at OR AFTER the requested name, so a record
    // that does not exist comes back as an unrelated neighbour (verified 2026-08-14: asking for a
    // missing "_hash.gone.<domain>" CNAME returned the live "n8n.<domain>" A record). Deleting
    // that blind would take out a live record, so the exact name+type match below is required.
    if (!match || match.Name !== recordName || match.Type !== recordType) return null;
    return match;
  } catch {
    return null;
  }
}

function deleteRecordSet(hostedZoneId, recordSet) {
  const changeBatch = JSON.stringify({
    Comment: "Remove ACM validation record for a certificate deleted during reset",
    Changes: [{ Action: "DELETE", ResourceRecordSet: recordSet }],
  });

  runAws([
    "route53", "change-resource-record-sets",
    "--hosted-zone-id", hostedZoneId,
    "--change-batch", changeBatch,
  ]);
}

function buildResetPlan(options) {
  const {
    region,
    stackPrefix,
    appConfigSecretName,
    forceDeleteSecret,
    removeLocalEvidence,
    deleteFinalSnapshots,
    deleteCertificates,
  } = options;
  const frontendStack = `${stackPrefix}-frontend`;
  const backendStack = `${stackPrefix}-backend`;
  const bootstrapStack = `${stackPrefix}-bootstrap`;
  const deploymentDir = path.join(rootDir, "deployment", options.environment);
  const lambdaLogGroups = listLogGroupsByPrefix(`/aws/lambda/${stackPrefix}`, region);

  const frontendExists = stackExists(frontendStack, region);
  const backendExists = stackExists(backendStack, region);
  const bootstrapExists = stackExists(bootstrapStack, region);

  const frontendBucket = frontendExists ? getStackResource(frontendStack, "SiteBucket", region) : "";
  const backendBucket = backendExists ? getStackResource(backendStack, "ManagedAssetBucket", region) : "";
  const databaseMasterSecret = backendExists ? getStackResource(backendStack, "DatabaseMasterSecret", region) : "";
  const bootstrapArtifactBucket = bootstrapExists ? getStackResource(bootstrapStack, "ArtifactBucket", region) : "";
  const bootstrapTemplateBucket = bootstrapExists ? getStackResource(bootstrapStack, "TemplateBucket", region) : "";
  const frontendBuckets = uniq([
    frontendBucket,
    ...findBucketsByPrefix([`${frontendStack.toLowerCase()}-sitebucket-`]),
  ]);
  const backendBuckets = uniq([
    backendBucket,
    ...findBucketsByPrefix([`${backendStack.toLowerCase()}-managedassetbucket-`]),
  ]);
  const bootstrapArtifactBuckets = uniq([
    bootstrapArtifactBucket,
    ...findBucketsByPrefix([`${stackPrefix.toLowerCase()}-artifacts-`]),
  ]);
  const bootstrapTemplateBuckets = uniq([
    bootstrapTemplateBucket,
    ...findBucketsByPrefix([`${stackPrefix.toLowerCase()}-templates-`]),
  ]);

  // CloudFormation names final snapshots "<stack>-snapshot-<logicalid>-<random>".
  const finalSnapshotPrefix = `${backendStack}-snapshot-`;
  const existingFinalSnapshots = listFinalClusterSnapshots(finalSnapshotPrefix, region);

  // Certificates are customer-supplied stack parameters, not resources this installer creates,
  // so they are read from the live stacks. Once the stacks are gone there is nothing left to
  // read them from, which is why a rerun against an already-deleted environment cannot find them.
  const frontendParameters = frontendExists ? getStackParameters(frontendStack, region) : {};
  const backendParameters = backendExists ? getStackParameters(backendStack, region) : {};
  const certificateArns = uniq([
    frontendParameters.AcmCertificateArn,
    backendParameters.ApiCertificateArn,
  ]);
  const hostedZoneIds = uniq([
    frontendParameters.HostedZoneId,
    backendParameters.ApiHostedZoneId,
  ]);

  const actions = [];

  frontendBuckets.forEach((bucket) => actions.push(`Empty frontend site bucket ${bucket}`));
  if (frontendExists) actions.push(`Delete stack ${frontendStack}`);
  backendBuckets.forEach((bucket) => actions.push(`Empty backend managed asset bucket ${bucket}`));
  if (backendExists) actions.push(`Delete stack ${backendStack}`);
  if (deleteFinalSnapshots) {
    const pending = backendExists ? existingFinalSnapshots.length + 1 : existingFinalSnapshots.length;
    if (pending > 0) {
      actions.push(`Delete ${pending} Aurora final snapshot(s) matching ${finalSnapshotPrefix}*${backendExists ? " (including the one this teardown creates)" : ""} — THIS DESTROYS THE DATABASE CONTENTS PERMANENTLY`);
    }
  } else if (existingFinalSnapshots.length > 0 || backendExists) {
    actions.push(`Keep Aurora final snapshot(s) matching ${finalSnapshotPrefix}* (${existingFinalSnapshots.length} already present); they bill monthly until deleted`);
  }
  lambdaLogGroups.forEach((logGroupName) => actions.push(`Delete Lambda log group ${logGroupName}`));
  if (databaseMasterSecret) {
    actions.push(`Delete database master secret ${databaseMasterSecret}${forceDeleteSecret ? " immediately" : " with recovery window"}`);
  }
  if (secretExists(appConfigSecretName, region)) {
    actions.push(`Delete app config secret ${appConfigSecretName}${forceDeleteSecret ? " immediately" : " with recovery window"}`);
  }
  bootstrapArtifactBuckets.forEach((bucket) => actions.push(`Empty bootstrap artifact bucket ${bucket}`));
  bootstrapTemplateBuckets.forEach((bucket) => actions.push(`Empty bootstrap template bucket ${bucket}`));
  if (bootstrapExists) actions.push(`Delete stack ${bootstrapStack}`);
  certificateArns.forEach((certificateArn) => {
    actions.push(deleteCertificates
      ? `Delete ACM certificate ${certificateArn} and its DNS validation records, if nothing else is using it`
      : `Report ACM certificate ${certificateArn} as unused (pass --delete-certificates=true to remove it)`);
  });
  if (removeLocalEvidence && fs.existsSync(deploymentDir)) {
    actions.push(`Remove local deployment evidence in ${path.relative(rootDir, deploymentDir)}`);
  }

  return {
    frontendStack,
    backendStack,
    bootstrapStack,
    frontendExists,
    backendExists,
    bootstrapExists,
    frontendBuckets,
    backendBuckets,
    lambdaLogGroups,
    databaseMasterSecret,
    bootstrapArtifactBuckets,
    bootstrapTemplateBuckets,
    finalSnapshotPrefix,
    existingFinalSnapshots,
    certificateArns,
    hostedZoneIds,
    deploymentDir,
    actions,
  };
}

function cleanUpFinalSnapshots(plan, region) {
  const snapshotIds = listFinalClusterSnapshots(plan.finalSnapshotPrefix, region);
  for (const snapshotId of snapshotIds) {
    deleteClusterSnapshot(snapshotId, region);
    console.log(`Deleted Aurora final snapshot ${snapshotId}.`);
  }
  return snapshotIds.length;
}

function cleanUpCertificates(plan, region, deleteCertificates) {
  const notes = [];

  for (const certificateArn of plan.certificateArns) {
    const certificateRegion = parseCertificateRegion(certificateArn);
    if (!certificateRegion) {
      notes.push(`Could not parse a region from certificate ARN ${certificateArn}; left in place.`);
      continue;
    }

    const certificate = describeCertificate(certificateArn, certificateRegion);
    if (!certificate) continue;

    const inUseBy = Array.isArray(certificate.InUseBy) ? certificate.InUseBy : [];
    if (inUseBy.length > 0) {
      notes.push(`ACM certificate ${certificateArn} is still attached to ${inUseBy.join(", ")}; left in place. AWS can take a while to release a certificate after a CloudFront distribution is deleted, so retry later if you expected it to be free.`);
      continue;
    }

    if (!deleteCertificates) {
      notes.push(`ACM certificate ${certificateArn} is now unused. It costs nothing to keep and is reusable on the next install; rerun with --delete-certificates=true to remove it.`);
      continue;
    }

    const validationRecords = certificateValidationRecords(certificate);

    try {
      runAws(["acm", "delete-certificate", "--certificate-arn", certificateArn, "--region", certificateRegion]);
    } catch (error) {
      notes.push(`Could not delete ACM certificate ${certificateArn}: ${String(error.message || "").split("\n")[0]}`);
      continue;
    }
    console.log(`Deleted ACM certificate ${certificateArn}.`);

    for (const record of validationRecords) {
      let removed = false;
      for (const hostedZoneId of plan.hostedZoneIds) {
        const recordSet = findRecordSet(hostedZoneId, record.Name, record.Type);
        if (!recordSet) continue;
        deleteRecordSet(hostedZoneId, recordSet);
        console.log(`Deleted DNS validation record ${record.Name} from hosted zone ${hostedZoneId}.`);
        removed = true;
        break;
      }
      if (!removed) {
        notes.push(`Validation record ${record.Name} was not found in any hosted zone this stack referenced; remove it by hand if it still exists.`);
      }
    }
  }

  return notes;
}

function main() {
  const region = getArg("region", "us-east-1");
  const projectName = getArg("project-name", "b1admin");
  const environment = getArg("environment", "staging");
  const stackPrefix = `${projectName}-${environment}`;
  const appConfigSecretName = `${projectName}/${environment}/app-config`;
  const forceDeleteSecret = getBooleanArg("force-delete-secret", true);
  const removeLocalEvidence = getBooleanArg("remove-local-evidence", true);
  // On by default: this script already force-deletes the database master secret, so a surviving
  // snapshot has no credentials to restore with. Set to false to keep the snapshot as a safety net.
  const deleteFinalSnapshots = getBooleanArg("delete-final-snapshots", true);
  // Off by default: certificates are supplied by the customer as stack parameters, may be shared
  // with resources this installer does not manage, and are free to keep.
  const deleteCertificates = getBooleanArg("delete-certificates", false);
  const dryRun = getBooleanArg("dry-run", false);

  const plan = buildResetPlan({
    region,
    environment,
    stackPrefix,
    appConfigSecretName,
    forceDeleteSecret,
    removeLocalEvidence,
    deleteFinalSnapshots,
    deleteCertificates,
  });

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      region,
      environment,
      actions: plan.actions,
    }, null, 2));
    return;
  }

  for (const bucket of plan.frontendBuckets) emptyBucket(bucket, region);
  if (plan.frontendExists) deleteStack(plan.frontendStack, region);
  for (const bucket of plan.frontendBuckets) {
    if (bucketExists(bucket, region)) deleteBucket(bucket, region);
  }

  for (const bucket of plan.backendBuckets) emptyBucket(bucket, region);
  if (plan.backendExists) deleteStack(plan.backendStack, region);
  for (const bucket of plan.backendBuckets) {
    if (bucketExists(bucket, region)) deleteBucket(bucket, region);
  }
  // Runs after the backend stack is gone: the final snapshot does not exist until CloudFormation
  // takes it on the way out, so it cannot be enumerated at plan time.
  if (deleteFinalSnapshots) cleanUpFinalSnapshots(plan, region);

  for (const logGroupName of plan.lambdaLogGroups) deleteLogGroup(logGroupName, region);

  if (plan.databaseMasterSecret && secretExists(plan.databaseMasterSecret, region)) {
    deleteSecret(plan.databaseMasterSecret, region, forceDeleteSecret);
  }

  if (secretExists(appConfigSecretName, region)) {
    deleteSecret(appConfigSecretName, region, forceDeleteSecret);
  }

  for (const bucket of plan.bootstrapArtifactBuckets) emptyBucket(bucket, region);
  for (const bucket of plan.bootstrapTemplateBuckets) emptyBucket(bucket, region);
  if (plan.bootstrapExists) deleteStack(plan.bootstrapStack, region);
  for (const bucket of plan.bootstrapArtifactBuckets) {
    if (bucketExists(bucket, region)) deleteBucket(bucket, region);
  }
  for (const bucket of plan.bootstrapTemplateBuckets) {
    if (bucketExists(bucket, region)) deleteBucket(bucket, region);
  }

  // Runs last: a certificate stays attached until the CloudFront distribution and the API
  // custom domain that reference it are fully deleted.
  const certificateNotes = cleanUpCertificates(plan, region, deleteCertificates);

  if (removeLocalEvidence && fs.existsSync(plan.deploymentDir)) {
    fs.rmSync(plan.deploymentDir, { recursive: true, force: true });
  }

  console.log(`Reset complete for ${environment} in ${region}.`);

  if (!deleteFinalSnapshots) {
    const remaining = listFinalClusterSnapshots(plan.finalSnapshotPrefix, region);
    if (remaining.length > 0) {
      console.log(`\nAurora snapshots kept (these bill monthly until deleted):`);
      for (const snapshotId of remaining) {
        console.log(`  ${snapshotId}`);
      }
      console.log(`  Delete one with: aws rds delete-db-cluster-snapshot --region ${region} --db-cluster-snapshot-identifier <id>`);
    }
  }

  if (certificateNotes.length > 0) {
    console.log(`\nCertificate notes:`);
    for (const note of certificateNotes) {
      console.log(`  ${note}`);
    }
  }
}

main();
