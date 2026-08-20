# GitHub Access

This page covers everything GitHub-side: signing in the GitHub CLI, creating the deployment environments, storing the deployment secrets, and letting the workflow read the source repositories. Your private repository must already exist — see [Your private repository](./deployment-repository.md).

## Sign In The GitHub CLI

Install GitHub CLI ([download](https://cli.github.com)). The installer uses `gh` to check repository access, prepare GitHub Environments and secrets, dispatch deployments, watch workflow runs, and download deployment evidence. It is optional only if an advanced operator does all GitHub steps by hand on the website.

```bash
gh auth login
gh auth status
gh repo view <owner>/<private-deploy-repo>
```

What good output looks like:

- `gh auth status` shows the GitHub account that can access your private repository.
- `gh repo view` prints repository information instead of `not found` or `HTTP 404`.

Common fixes:

- If `gh` is not found, install GitHub CLI and open a new terminal.
- If the wrong account is signed in, run `gh auth logout`, then `gh auth login`.
- If the repository is not found, confirm the name and your access. Authentication to a different GitHub account is a common cause of repository or workflow lookup failures.
- If the repository exists but Actions are disabled, enable Actions in the repository settings.

## Create The GitHub Environments

In your private repository, open **Settings > Environments** and create:

- `aws-prod`
- `aws-staging`, only if you chose the optional staging deployment

Or let the installer create them, from the `b1admin-installer` folder:

```bash
npm run installer:github-setup -- --repo=<owner>/<private-deploy-repo> --write=true --output=markdown
```

The workflow selects `aws-staging` for a staging run and `aws-prod` for a production run; environment-level secrets keep the two separate even though they share one workflow. Do not rename the environments — the workflow expects the `aws-<environment>` pattern.

For production, consider adding required reviewers so a workflow cannot deploy until an authorized person approves it, and branch restrictions if your organization requires deployments from a protected branch.

## Store The Deployment Secrets

Each environment gets its own secrets, under **Settings > Environments > Environment secrets**. For the recommended OIDC setup:

- `AWS_ROLE_TO_ASSUME` — the environment's GitHub deploy-role ARN
- `AWS_CLOUDFORMATION_EXECUTION_ROLE_ARN` — the environment's CloudFormation execution-role ARN
- `AWS_APP_CONFIG_SECRET_JSON` — the backend application configuration as one valid JSON object

The normal path is to let the installer generate the app-config JSON (with random `jwtSecret` and `encryptionKey` values) and write all required secrets:

```bash
npm run installer:app-config-secret -- --environment=prod --environment-dir=../b1admin-deploy/environments/prod --customer-file=../b1admin-deploy/customer-values.json --write=true --output=markdown
npm run installer:github-setup -- --environment=prod --repo=<owner>/<private-deploy-repo> --account-id=<aws-account-id> --deploy-env-dir=../b1admin-deploy/environments --write=true --write-secrets=true --output=markdown
npm run installer:github-readiness -- --environment=prod --repo=<owner>/<private-deploy-repo> --write=true --output=markdown
```

If you use staging, repeat with `--environment=staging` and different generated secret values.

Rules that keep this safe:

- Do not add static AWS keys when OIDC is configured. If your organization cannot use OIDC yet, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` replace `AWS_ROLE_TO_ASSUME` as a temporary fallback — see the [GitHub Actions reference](../github-actions-setup.md).
- Do not add `AWS_BOOTSTRAP_ADMIN_SECRET_JSON` unless you deliberately chose runner-side admin bootstrap. The normal path seeds the first admin later from your own machine, keeping those credentials out of GitHub.
- Staging and prod values must be separate, especially role ARNs and application secrets.
- Never commit `app-config-secret.json` anywhere.

## Source Repository Access

The workflow checks out the B1Admin source (normally `ChurchApps/B1Admin`) and the Api source (normally `ChurchApps/Api`) during the run. Neither needs to be on your computer, and you normally do not need your own forks of them — use a private fork or mirror only if your organization maintains customized code or cannot let the workflow read the upstream repositories.

Confirm you can open both in GitHub:

```bash
gh repo view ChurchApps/B1Admin
gh repo view ChurchApps/Api
```

If a source repository is **public**, no extra secret is needed. If one is **private**, the workflow's default token cannot read it — create a fine-grained personal access token (or GitHub App token) with read-only contents access, and save it as an environment secret:

- `API_REPO_CHECKOUT_TOKEN` for the Api repository
- `B1ADMIN_REPO_CHECKOUT_TOKEN` for the B1Admin repository

If one read-only token can read both, you may reuse the same value for both secrets. Do not give these tokens write access — the installer deploys a selected commit but never pushes back.

## You Are Ready When

- `gh auth status` shows the right account and `gh repo view` finds your private repository
- the needed environments exist, each with its own AWS role ARNs and app-config JSON
- the workflow can read both source repositories, via public access or a checkout token

[Back to Start Here](../start-here.md)
