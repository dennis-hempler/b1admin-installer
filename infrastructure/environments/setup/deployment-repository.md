# Your Private Repository

Every install gets one private GitHub repository of its own. It is the deployment control center: it holds the deployment workflow, the environment parameter files, the GitHub Environments and their secrets, and the workflow run history. A name such as `b1admin-deploy` works well.

It does **not** hold application source code, and nothing in it gets pushed back to the B1Admin or Api repositories.

## Create It

Create the repository first — nothing else in the install can proceed without it. From your parent folder (the one that holds `b1admin-installer`):

```bash
gh repo create <owner>/b1admin-deploy --private --clone
```

Replace `<owner>` with your GitHub user or organization name. This creates the repository on GitHub **and** clones it beside the installer, which is exactly the layout the commands expect:

```text
parent-folder/
  b1admin-installer/
  b1admin-deploy/
```

If you prefer the GitHub website, create a new **private** repository there instead, then clone it from the parent folder:

```bash
git clone https://github.com/<owner>/b1admin-deploy.git b1admin-deploy
```

The HTTPS address works with the same GitHub CLI sign-in you already have. Only use the SSH form (`git@github.com:...`) if you have already set up SSH keys with GitHub.

If you skip this step, the guided runner can also create the repository for you when the `Private repository synced` step runs — but creating it up front keeps the folder layout obvious from the start.

## Fill It

From the `b1admin-installer` folder, scaffold the contents and create the local customer worksheet:

```bash
npm run installer:init -- --deploy-repo-dir=../b1admin-deploy --output=markdown
```

That creates:

```text
b1admin-deploy/
  .github/workflows/deploy-aws-self-hosted.yml
  .gitignore
  README.md
  customer-values.json
  customer-values.sample.json
  environments/
    staging/
    prod/
```

The generated `.gitignore` keeps `customer-values.json`, `environments/*/app-config-secret.json`, `environments/*/bootstrap-admin-secret.json`, and `deployment/` out of commits. Runtime secret values belong in GitHub Environment secrets or in an operator-controlled local step, never in Git.

Commit and push the safe scaffold files before any workflow dispatch (the guided runner offers to do this for you in the `Private repository synced` step):

```bash
git -C ../b1admin-deploy add README.md .gitignore .github/workflows/deploy-aws-self-hosted.yml customer-values.sample.json environments
git -C ../b1admin-deploy commit -m "Add B1Admin deployment scaffold"
git -C ../b1admin-deploy push
```

You are ready when the repository contains the workflow and environment folders, and its Actions tab shows the `Deploy AWS From Private Repo` workflow. If the Actions tab does not show it after pushing, confirm the file exists at `.github/workflows/deploy-aws-self-hosted.yml` and that GitHub Actions are enabled for the repository.

## What The Workflow Checks Out

The workflow checks out three things when it runs: your private repository, the B1Admin source (normally `ChurchApps/B1Admin`), and the Api source (normally `ChurchApps/Api`). The workflow inputs `b1admin_repo` / `b1admin_ref` / `api_repo` / `api_ref` control which repository and branch, tag, or commit.

Do not copy B1Admin or Api source code into your private repository, and you normally do not need private forks of them — see [GitHub access](./github-access.md) for the one case where a checkout token is needed.

## OIDC Trust

The AWS OIDC trust policy must reference **your private repository**, not the B1Admin source repository:

```json
{
  "StringLike": {
    "token.actions.githubusercontent.com:sub": [
      "repo:<owner>/<private-deploy-repo>:environment:aws-staging",
      "repo:<owner>/<private-deploy-repo>:environment:aws-prod",
      "repo:<owner>@*/<private-deploy-repo>@*:environment:aws-staging",
      "repo:<owner>@*/<private-deploy-repo>@*:environment:aws-prod"
    ]
  }
}
```

The `@*` entries matter: GitHub's OIDC token now presents the subject as `repo:<owner>@<owner-id>/<repo>@<repo-id>:environment:<name>` (seen 2026-08-22), and a trust policy that only lists the classic form fails with `Not authorized to perform sts:AssumeRoleWithWebIdentity`.

The installer renders this for you — see [AWS account access](./aws-account-access.md). Policy templates live in [`../../iam/README.md`](../../iam/README.md).

## Updating Later

After the first install, keep using this repository for updates. From the `b1admin-installer` folder:

```bash
npm run installer:update -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=prod \
  --output=markdown
```

That pulls source code when approved, refreshes the safe scaffold files, offers to commit and push them, then starts the guided deployment runner.

`installer:update` is a guided update command, not a zero-downtime guarantee. For a production environment with active users, update optional staging first when available, verify login and key workflows, confirm backups or snapshots exist, review the prod preflight and preview output, and run prod during an approved low-traffic or maintenance window.

[Back to Start Here](../start-here.md)
