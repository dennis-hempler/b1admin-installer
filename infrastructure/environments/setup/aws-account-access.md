# AWS Account Access

This page takes you from "I can sign in to AWS" to "the deployment roles exist". It assumes the AWS account itself already exists — if it does not, or nobody has ever run AWS commands from a terminal on this computer, do [Setting up a brand-new AWS account](./aws-new-account.md) first; it ends exactly where this page begins.

## Connect The AWS CLI

Install the AWS CLI ([download](https://aws.amazon.com/cli/)) and configure a local profile using your organization's normal sign-in method. Prefer IAM Identity Center or another short-lived credential method over permanent access keys. If there is no "normal method" yet, that is the brand-new-account case — use the page linked above.

Verify the active identity and region before running anything that changes AWS:

```bash
aws sts get-caller-identity
aws configure get region
```

What good output looks like:

- `aws sts get-caller-identity` prints an `Account` value that matches the AWS account where B1Admin will run.
- `aws configure get region` prints the deployment region, normally `us-east-1`.

Common fixes:

- If AWS CLI is not found, install it and open a new terminal.
- If the account number is wrong, sign out or switch profiles before continuing.
- If the region is blank, run `aws configure set region us-east-1`.
- If your organization uses IAM Identity Center and commands fail with an expired token, run `aws sso login`.

The installer scripts do not accept a `--profile` option; they use whatever profile the terminal is already set to. If you use a named profile, export it first (`export AWS_PROFILE=<profile-name>`), or name the profile `default` when you set it up.

## Create The Deployment Roles

GitHub needs permission to deploy B1Admin into AWS. The recommended setup uses GitHub OIDC, which lets GitHub assume short-lived AWS roles without storing long-lived AWS keys in GitHub. Each deployed environment needs:

- a **GitHub deploy role** — trusted by your private repository's GitHub Environment; lets GitHub start and manage the deployment
- a **CloudFormation execution role** — used by CloudFormation to create and update the B1Admin AWS resources

plus, once per AWS account, a **GitHub OIDC provider** for `token.actions.githubusercontent.com`.

Use the installer to render the trust and permission policies instead of editing JSON by hand. For the normal prod-only path:

```bash
npm run installer:aws-roles -- --environment=prod --account-id=<aws-account-id> --repo=<owner>/<private-deploy-repo> --output-dir=../b1admin-deploy/iam/prod --write=true --output=markdown
```

If you chose the optional staging deployment, run it again with `--environment=staging` and `--output-dir=../b1admin-deploy/iam/staging`.

Then create the roles, one of two ways:

**If you manage the AWS account yourself** (the normal case for a small organization): approve the `AWS IAM roles created` step in the guided runner, or re-run the command above with `--apply=true`. The installer creates the OIDC provider and both roles with your AWS sign-in, and safely skips anything that already exists.

**If a separate person manages your AWS account**: generate the handoff document and send it to them:

```bash
npm run installer:aws-handoff -- --customer-file=../b1admin-deploy/customer-values.json --deploy-repo-dir=../b1admin-deploy --write=true --output=markdown
```

They run the printed `aws iam ...` commands from `../b1admin-deploy/aws-admin-handoff.md`. If the account already has the GitHub OIDC provider, they skip the provider creation command. Afterward, run the `AWS IAM roles created` step once yourself to confirm the roles exist.

The rendered trust policies scope access to your private repository and the matching GitHub Environment. The full sample policies are documented in the [IAM setup guide](../../iam/README.md).

## Record The Values

Save these for each deployed environment — you will use them when configuring GitHub secrets:

- AWS account ID and region
- GitHub deploy-role ARN
- CloudFormation execution-role ARN

The installer derives the default ARNs from your account ID. If your administrator chose different role names, pass the actual ARNs when setting GitHub secrets.

## You Are Ready When

- the identity command shows the intended AWS account and the configured region is the deployment region
- the OIDC provider and both roles exist for each environment you plan to deploy
- the trust policies name your private repository and the matching GitHub Environment, normally `aws-prod` and, only if you use staging, `aws-staging`

After the environment files are configured, the installer preflight checks the active AWS CLI identity and any configured frontend certificate/hosted-zone values:

```bash
npm run installer:aws-preflight -- --environment=prod --environment-dir=../b1admin-deploy/environments/prod --account-id=<aws-account-id> --output=markdown
```

[Back to Start Here](../start-here.md)
