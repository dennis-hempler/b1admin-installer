# Start Here

Use this guide to deploy B1Admin into your AWS account.

This document is for the person doing the installation. You do not need to write code, and you should not push anything back to the B1Admin or Api source repositories.

You will work with two repositories:

- installer repository: this repository, which contains the installer tools, infrastructure templates, and deployment workflow.
- your private repository: the private repository that stores your AWS settings, GitHub workflow, environment files, and deployment evidence.

Do not push customer settings, generated secrets, or deployment evidence back to the B1Admin source repository or the Api source repository.

## Table Of Contents

Read these sections in order the first time through:

1. [Need Help?](#need-help) - how to contact Dennis if you get stuck.
2. [Using An AI Helper](#using-an-ai-helper) - optional instructions for using an AI agent safely.
3. [Conventions Used In This Guide](#conventions-used-in-this-guide) - explains placeholders, regions, environments, and folder names used in commands.
4. [What You Need Before You Start](#what-you-need-before-you-start) - confirms AWS, GitHub, and local computer access before any commands run.
5. [Where The Folders Go](#where-the-folders-go) - explains where the installer and your private repository live on your computer.
6. [Before You Run Commands Checklist](#before-you-run-commands-checklist) - quick checklist before starting.
7. [The Short Version](#the-short-version) - the main step-by-step path most users should follow.
8. [Who Does What](#who-does-what) - shows when the deployment operator, AWS administrator, and GitHub administrator are involved.
9. [Fill Out One File](#fill-out-one-file) - explains the customer setup questions and the local values file the installer creates.
10. [Domains](#domains) - explains generated URLs and optional custom frontend domains.
11. [Choose Staging Or Prod First](#choose-staging-or-prod-first) - helps you decide whether to skip staging or use it as a practice deployment.
12. [Guided Prod Deploy](#guided-prod-deploy) - explains what the prod runner normally does.
13. [Optional Guided Staging Deploy](#optional-guided-staging-deploy) - use only if you want a practice deployment before prod.
14. [Production Notes](#production-notes) - important production behavior and approval suggestions.
15. [What Costs Money?](#what-costs-money) - shows which parts may create AWS charges.
16. [Final Report](#final-report) - writes the deployment sign-off report.
17. [When You Are Done](#when-you-are-done) - final completion checklist. After that, [Operations After Launch](./operations.md) covers updates, backups, secrets, and cost control.
18. [Update An Existing Install](#update-an-existing-install) - deploys newer source code into an already installed AWS stack.
19. [Clean Reset](#clean-reset) - removes AWS resources when testing or starting over.
20. [If Something Fails](#if-something-fails) - troubleshooting entry point.
21. [Reference](#reference) - supporting notes and lower-level command references.

If you are doing the normal prod-only install, follow [The Short Version](#the-short-version), review [What Costs Money?](#what-costs-money), then continue to [Final Report](#final-report) after prod is deployed and tested.

## Need Help?

Dennis is available to help with this deployment process.

Email `dennis.hempler@protonmail.com` and put `B1Admin` in the subject line so the message is easy to find.

## Using An AI Helper

An AI helper can be useful for reading command output, explaining errors, and keeping track of which step is next. It is optional. You can complete the install with this guide and the guided installer commands.

If you use an AI helper, give it this guide and the current terminal output. Do not ask it to guess. Ask it to read the guide, inspect the current folder, and explain before it changes anything.

You can paste this instruction into the AI helper:

```text
I am installing B1Admin into my AWS account.

Please use infrastructure/environments/start-here.md as the main guide.

Important rules:
- Run installer commands from the installer repository folder.
- Your private repository is beside the installer repository, usually ../b1admin-deploy.
- Do not push customer settings, generated secrets, or deployment evidence back to the B1Admin source repository or the Api source repository.
- Do not commit customer-values.json, app-config-secret.json, bootstrap-admin-secret.json, or deployment/.
- Use prod for the normal install. Use staging only if I choose an optional practice deployment.
- The normal backend API uses the generated API Gateway URL. Do not invent a custom internal API domain.
- Stop and explain before approving production deploys, GitHub secret writes, AWS IAM changes, reset commands, first-admin bootstrap, or browser smoke tests.
- If unsure, ask me or tell me to email dennis.hempler@protonmail.com with B1Admin in the subject line.
```

The AI helper may help run checks and explain output, but the human installer is still responsible for approving AWS charges, IAM permissions, GitHub secrets, production deploys, resets, and first-admin credentials.

## Conventions Used In This Guide

The commands in this guide use examples. Replace them when your install uses different values.

| Example in guide | What it means | When to change it |
| --- | --- | --- |
| `us-east-1` | AWS region where B1Admin is deployed | Change this to your chosen AWS region. CloudFront frontend certificates still must be in `us-east-1`. |
| `prod` | Production environment | Use `prod` for the normal install with the smallest AWS footprint. Use `staging` only for the optional practice deployment. |
| `staging` | Optional practice environment | Skip staging if you do not want the extra AWS stack and cost. |
| `../b1admin-deploy` | Your private repository folder, beside `b1admin-installer` | Change this if your private repository folder has a different name or path. |
| `b1admin-installer` | This installer repository — the folder you run every command from | Change this only if you cloned it under a different folder name. |
| `<owner>/<private-deploy-repo>` | GitHub repo name, such as `your-org/b1admin-deploy` | Replace with your private repository name. |
| `<aws-account-id>` | Your 12-digit AWS account ID | Replace with the AWS account where B1Admin will run. |
| `<staging|prod>` | Choose one environment value | Type either `staging` or `prod`; do not include the angle brackets. |

Type or paste the commands into your terminal. Do not type the triple backticks around command examples.

The word `ref` means the B1Admin or Api source branch, tag, or commit to deploy. Most installs accept the installer's suggested default: the exact source version this installer was last verified against (recorded in `tested-source-refs.json` in the installer folder). Use `main` only if the B1Admin team advises it — upstream changes newer than the tested version have broken installs before.

If a command includes `--environment=prod`, it is for production. If you chose the optional staging path, use `--environment=staging` for the staging run, then repeat the prod command after staging is clean.

If a command includes `--region=us-east-1`, use the same AWS region you entered in the customer setup questions. Most installs use `us-east-1`.

## What You Need Before You Start

Have these ready before you run the first command. The linked pages explain each item in more detail.

If you are not sure whether something is ready, use the quick checks in this section. A failed check is not a disaster; it usually means the wrong account is signed in, a tool is missing, or an administrator still needs to grant access.

### AWS

You need an AWS account where B1Admin is allowed to create resources.

**Starting from a brand-new AWS account, or never run AWS commands in a terminal before?** Work through [Setting up a brand-new AWS account](./setup/aws-new-account.md) first. It covers creating the account, protecting the root user, setting a billing alert, choosing your region, creating a sign-in you can use from the terminal, and connecting the AWS CLI. The rest of this section assumes those are done.

Have:

- AWS account ID
- AWS region, normally `us-east-1`
- AWS login with permission to create or approve IAM roles
- permission to deploy CloudFormation stacks
- permission to create S3 buckets, Lambda functions, API Gateway APIs, CloudFront distributions, Secrets Manager secrets, VPC/network resources, and Aurora/RDS resources
- access to Route53 and ACM if you want a custom frontend domain

Quick checks:

```bash
aws sts get-caller-identity
aws configure get region
```

The account in `aws sts get-caller-identity` should match the AWS account where B1Admin will run. The region should match the region you plan to use, normally `us-east-1`.

If these commands fail, ask the AWS administrator how to sign in from the AWS CLI. If nobody else administers the account, [Setting up a brand-new AWS account](./setup/aws-new-account.md) walks through getting these two commands working. If the account number is wrong, stop and switch AWS accounts before continuing.

Read:

- [Setting up a brand-new AWS account](./setup/aws-new-account.md) — start here if the account is new
- [AWS account access](./setup/aws-account-access.md) — connect the CLI and create the deployment roles

### GitHub

You need a GitHub account that can access the B1Admin and Api source repositories and manage your private repository.

Have:

- access to the B1Admin source repository
- access to the `Api` source repository
- a new private repository for this install, for example `your-org/b1admin-deploy` — **you create this yourself**; it does not exist until you make it
- permission to create GitHub Environments named `aws-prod` and, only if you run staging, `aws-staging`
- permission to add GitHub Environment secrets
- a token or GitHub permission setup that lets GitHub Actions check out the private source repositories

Quick checks:

```bash
gh auth status
gh repo view <owner>/<private-deploy-repo>
```

You should see the GitHub account that has access to your private repository.

If the repo check says the repository does not exist, that is expected on a first install — create it now, from your parent folder:

```bash
gh repo create <owner>/b1admin-deploy --private --clone
```

That creates the private repository on GitHub and clones it beside the installer in one step. [Your private repository](./setup/deployment-repository.md) explains what goes in it. If the repo check fails for a repository that does exist, make sure your GitHub account has access and you replaced `<owner>/<private-deploy-repo>` with the real repo name.

Also confirm you can open or view the source repositories:

```bash
gh repo view ChurchApps/B1Admin
gh repo view ChurchApps/Api
```

If your organization uses a fork or private mirror, replace those names with the source repository names you will deploy.

You normally do not need to create your own private Api repository. Your private repository stores deployment settings and the workflow. The workflow checks out the Api source repository during deployment using read-only access.

Read:

- [Your private repository](./setup/deployment-repository.md) — create and fill the deployment repository
- [GitHub access](./setup/github-access.md) — CLI sign-in, environments, secrets, and source repository access

### Your Computer

You need a local computer where you can run terminal commands.

Have:

- Node.js 20 or newer installed ([download](https://nodejs.org/en/download))
- Git installed ([download](https://git-scm.com/downloads))
- GitHub CLI installed and signed in ([download](https://cli.github.com)); the guided runner uses it for GitHub repository, secret, workflow, and evidence steps
- AWS CLI installed and signed in to the target AWS account ([download](https://aws.amazon.com/cli/)); the guided runner uses it for AWS readiness, verification, and reset steps
- a local copy of this installer repository

You do not need a local copy of the B1Admin application source. The deployment checks it out for you.

Quick checks:

```bash
node --version
npm --version
git --version
gh --version
aws --version
```

Each command should print a version number instead of saying the command was not found.

Then clone the installer and install its dependencies:

```bash
git clone https://github.com/dennis-hempler/b1admin-installer.git
cd b1admin-installer
npm install
npm run installer:doctor -- --output=markdown
```

The doctor report is allowed to show later-step items as not ready before the install starts. At this point, focus on whether `node`, `npm`, `git`, `gh`, `aws`, and the folder paths look correct.

Yarn is optional. The doctor lists it because it is needed only if you later choose to build the B1Admin or Api sources on this computer; the normal guided install never uses it.

You normally do not need a local copy of the Api source repository for the guided GitHub Actions deployment. A local `../Api` checkout is useful only for advanced local packaging, local migration work, or troubleshooting outside the normal guided path.

Read:

- [Local runtime](./setup/local-runtime.md)
- [Customer values worksheet](./setup/customer-values.md)

## Where The Folders Go

You need **two folders on your computer**, side by side:

```text
parent-folder/
  b1admin-installer/   <- this installer. Run every command in this guide here.
  b1admin-deploy/      <- your private repository. The installer writes your settings here.
```

**You do not need a copy of the B1Admin application source.** The installer does not contain it and does not build it on your computer — the deployment checks it out on GitHub when it runs. The same is true of the `Api` backend source.

`parent-folder` is not a literal name you have to create. It just means "the folder that holds both", and it can be anywhere you keep work files:

- macOS: `/Users/your-name/Documents/Repos/`
- macOS: `/Users/your-name/Documents/B1Admin-Install/`
- Windows: `C:\Work\B1Admin-Install\`

So if you chose `/Users/your-name/Documents/B1Admin-Install/`, your folders are:

```text
/Users/your-name/Documents/B1Admin-Install/
  b1admin-installer/
  b1admin-deploy/
```

### Which folder to run commands in

**Always `b1admin-installer`.** Every `npm run installer:...` command in this guide is run from there, never from `b1admin-deploy`.

That is why the commands say `../b1admin-deploy`: from inside `b1admin-installer`,

- `..` means "go up one folder to the parent folder"
- `../b1admin-deploy` means "go up to the parent folder, then into `b1admin-deploy/`"
- `../b1admin-deploy/customer-values.json` is the customer worksheet the installer creates
- `../b1admin-deploy/deployment/` is where local deployment evidence is saved

If your private repository folder has a different name, replace every `../b1admin-deploy` in the commands with your folder path.

Your private repository should be **private**. It is the operator workspace for this customer install, and the `.gitignore` the installer generates there keeps customer values, generated secrets, and deployment evidence out of commits.

### Getting the two folders

If they are not on your computer yet, open a terminal in your chosen parent folder and run:

```bash
git clone https://github.com/dennis-hempler/b1admin-installer.git b1admin-installer
gh repo create <owner>/b1admin-deploy --private --clone
cd b1admin-installer
npm install
```

The first command fetches this installer. The second **creates** your private repository on GitHub and clones it beside the installer — on a first install it does not exist yet, so it has to be created, not cloned. Replace `<owner>` with your GitHub user or organization name. [Your private repository](./setup/deployment-repository.md) explains what goes in it; the installer fills it in a later step.

If the private repository already exists on GitHub, clone it instead:

```bash
git clone https://github.com/<owner>/b1admin-deploy.git b1admin-deploy
```

After `cd b1admin-installer`, the rest of this guide's commands work as written.

If the folders already exist, do not clone them again. Open a terminal in the existing `b1admin-installer` folder instead.

### Optional: a local Api checkout

Not needed for the normal guided install. Only an advanced operator doing local backend packaging or migration work needs it, and it goes beside the other two:

```text
parent-folder/
  b1admin-installer/
  b1admin-deploy/
  Api/                 <- optional; not needed for the normal guided path
```

## Before You Run Commands Checklist

Before starting [The Short Version](#the-short-version), confirm:

- [ ] You can sign in to the target AWS account.
- [ ] You know the AWS account ID and region.
- [ ] AWS CLI is installed and signed in to the target AWS account.
- [ ] Git is installed.
- [ ] GitHub CLI is installed and signed in.
- [ ] Node.js and npm are installed.
- [ ] You can access the B1Admin source repository.
- [ ] You can access the Api source repository.
- [ ] Your private repository exists in GitHub and is private.
- [ ] Your private repository is cloned beside this installer repository.
- [ ] You know whether you are deploying `prod` only or optional `staging` first.
- [ ] If using a custom frontend domain, you have the hostname, Route53 hosted zone ID, and CloudFront ACM certificate ARN.

## The Short Version

Run commands from the `b1admin-installer` folder.

If you are not sure where your terminal is, run:

```bash
pwd
```

The output should end with `b1admin-installer`. If it does not, move into the `b1admin-installer` folder before continuing.

Choose your first environment:

- Smallest AWS footprint: start with `prod` and skip staging.
- Practice rollout: start with `staging`, then repeat for `prod` after staging is clean.

Staging creates a second AWS stack, so it costs money while it is running. It is useful when you want a practice deployment before production, but it is not required.
If you skip staging, the first real AWS deployment will be prod, so read the preview and preflight output carefully before approving the real deploy.

1. Make sure your private repository exists in GitHub and is cloned beside this installer repository. If it does not exist yet, create and clone it in one step from the parent folder: `gh repo create <owner>/b1admin-deploy --private --clone`.

Your folders should look like this before you continue, and your terminal should be in `b1admin-installer`:

```text
parent-folder/
  b1admin-installer/   <- run the commands here
  b1admin-deploy/
```

2. Create your private repository workspace files:

```bash
npm run installer:init -- \
  --deploy-repo-dir=../b1admin-deploy \
  --output=markdown
```

3. Tell Git your name and email once, if you have never used Git on this computer:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

You do not need to run any other Git commands. The guided runner commits and pushes the safe private-repository files for you (the `Private repository synced` step), only ever touches the safe file list, and creates the private GitHub repository if it does not exist yet. If you prefer to commit manually, `npm run installer:init` prints the safe commands.

4. Answer the customer setup questions:

```bash
npm run installer:customer-values -- \
  --customer-file=../b1admin-deploy/customer-values.json \
  --write=true \
  --output=markdown
```

5. Start the guided runner:

```bash
npm run installer:run -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=prod \
  --output=markdown
```

The runner checks what is already done, runs the next installer step, then checks again.
Routine steps run on their own without asking.
It pauses and asks only once: before the real AWS deploy, the step that creates AWS resources and starts costing money.

Starting the runner does not mean AWS resources are created immediately. The runner will first check files, GitHub setup, AWS readiness, and preflight results. AWS resources are created when you approve the real deploy step.

When it pauses at the launch step, pressing Enter continues. If you are not ready, type `n`; nothing is lost, and you can run `installer:run` again later.

If the runner stops because an outside task is needed, such as a GitHub administrator approving production, complete that task and run the same `installer:run` command again.
If the runner stops with "the installer still reports the same checklist item as incomplete", a step ran but the installer could not see its result. That is a bug in the installer, not something you did wrong; report it to the B1Admin team along with the command the message shows.
When the runner changes safe files in your private repository, it commits and pushes them for you in the `Private repository synced` step.

The runner does not create your AWS account, clone repositories to your computer, approve protected GitHub deployments, or decide whether a production change is safe. It guides those steps and pauses when a person should review them. It can create the AWS IAM roles and the private GitHub repository itself, and it always asks before doing so.

Example runner pause:

```text
Progress: 12 of 20 steps done, 8 to go.
Next up: Deployment observed
Status: dispatch the real deploy workflow
Ready to launch the real AWS deployment. This creates the B1Admin resources in your AWS account, and they cost money while they run (see What Costs Money in the guide).
Command:
npm run installer:deploy -- --environment=prod --environment-dir=../b1admin-deploy/environments/prod --confirm=true
Launch now? [Y/n]:
```

Pressing Enter (or `y`) launches the real AWS deployment. If you are not ready, type `n` and press Enter; run `installer:run` again when you are.

Repeat until the selected environment is deployed, verified, first-admin bootstrapped, and browser-tested.
If you chose staging first, run the same command again with `--environment=prod` after staging is clean.

If you have not run `npm install` in the installer folder yet, do that before the local first-admin bootstrap and browser smoke steps.

## Who Does What

In a small church or organization, all three roles below are usually the same person: you. That is fine. Read each role as "a hat I put on for that step" rather than a separate person you need to find. When a step says to send something to the AWS administrator or GitHub administrator and that is you, just do that step yourself with the same signed-in accounts you have been using.

The deployment operator runs the installer commands, answers the customer setup questions, commits safe files to your private repository, dispatches workflows, and checks the final report.

The AWS administrator creates or approves the IAM roles. If that is you (the normal case for a small organization), just approve the `AWS IAM roles created` step when the runner asks; it creates the roles with your own AWS sign-in.

If a separate person manages your AWS account, send them this generated file instead, and re-run the `AWS IAM roles created` step afterward to confirm the roles exist:

```text
../b1admin-deploy/aws-admin-handoff.md
```

That file contains the AWS IAM commands and role ARN values needed by the deployment. They do not need to edit B1Admin code.

The GitHub administrator may need to create your private repository, grant repository access, approve production environment protection rules, or create source-repository read tokens.

## Fill Out One File

`installer:init` creates this local file:

```text
../b1admin-deploy/customer-values.json
```

That file is for the installer to read. Use this command to update it:

```bash
npm run installer:customer-values -- \
  --customer-file=../b1admin-deploy/customer-values.json \
  --write=true \
  --output=markdown
```

It asks for:

- AWS account ID
- AWS region, normally `us-east-1`
- your private repository, for example `your-org/b1admin-deploy`
- root domain, for example `example.com`; this is used for generated settings and support values even if you do not use a custom frontend hostname
- support email and support phone
- first admin email, temporary password, and church name
- B1Admin source repository/ref — accept the suggested default (the installer's pinned tested version)
- Api source repository/ref — accept the suggested default (the installer's pinned tested version)
- optional frontend custom domain values

Keep this file local. The generated `.gitignore` prevents it from being committed.

## Domains

The normal install uses the generated API Gateway URL for the backend API. Leave these backend API custom-domain values blank:

- `ApiCustomDomainName`
- `ApiCertificateArn`
- `ApiHostedZoneId`

For the frontend, you have two choices:

- Leave frontend domain values blank and use the generated CloudFront hostname for infrastructure smoke testing.
- Provide a frontend hostname such as `admin.example.com` for the cleanest login-ready install.

If you use a custom frontend hostname, provide:

- `frontendDomain`
- `frontendCertificateArn`
- `frontendHostedZoneId`

The CloudFront certificate must be an ACM certificate in `us-east-1`.

## Choose Staging Or Prod First

You do not have to deploy staging.

Use `prod` first when:

- you want the smallest AWS footprint
- this AWS account is only for the real production install
- you are comfortable using preflight and preview checks before the real deploy

Use `staging` first when:

- you want to practice before production
- a separate test environment is required by your team
- you want to prove GitHub, IAM, AWS, app config, migrations, first-admin bootstrap, and browser login before touching prod

Both paths use the same guided runner. The only difference is the `--environment=` value.

For a normal prod-only install, use `prod` only. You can still keep the generated staging files in your private repository; they do not create AWS resources unless you run the staging deploy.

## Guided Prod Deploy

Use this for the smallest AWS footprint, or after staging is clean.

Run:

```bash
npm run installer:run -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=prod \
  --output=markdown
```

The guided runner checks the current state, runs the next installer step, and keeps going until it reaches an approval gate or an outside task.
If you are troubleshooting and need to see only the next recommendation without running it, use `npm run installer:next -- --customer-file=../b1admin-deploy/customer-values.json --environment=prod --output=markdown`.

The prod flow normally does this:

1. Generate the AWS admin handoff.
2. Configure prod parameter files from `customer-values.json`.
3. Generate the local app-config secret.
4. Create GitHub Environments and store environment secrets.
5. Run local preflight.
6. Dispatch a prod preview workflow.
7. Observe the preview and download evidence.
8. Dispatch the real prod deploy.
9. Observe the deploy, download evidence, and verify URLs.
10. If using a generated CloudFront frontend URL, adopt that frontend origin into the backend parameters and rerun the real deploy.
11. Bootstrap the first admin from the operator machine.
12. Run browser smoke.

Commit and push only safe files in your private repository when the installer asks for it. Do not commit `customer-values.json`, `app-config-secret.json`, `bootstrap-admin-secret.json`, or `deployment/`.

## Optional Guided Staging Deploy

Use this only when you want a practice deployment before prod.

Run:

```bash
npm run installer:run -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=staging \
  --output=markdown
```

The staging flow follows the same pattern as prod, but uses staging-specific parameter files, GitHub Environment secrets, workflow runs, evidence, first-admin bootstrap, and browser smoke.

After staging is clean, run the prod command from the previous section.

## Production Notes

If prod does not use a custom frontend domain yet, the first deploy creates a generated CloudFront URL, and the backend must then be redeployed once so it accepts logins from that URL. The guided runner walks this second pass automatically: it asks to adopt the URL, commits and pushes the parameter change, and reruns the prod deploy. Just keep answering the runner's prompts; the second deploy is expected, not a sign that something failed.

For production, consider adding required reviewers to the `aws-prod` GitHub Environment before the first prod deploy.

## What Costs Money?

Plan for roughly **$80-$90 per month** for a production-only install with the default settings, and roughly double that if you also run staging. These are estimates at low, church-scale traffic in `us-east-1` as of mid-2026; check current AWS pricing and your first month's bill. The largest pieces:

| Resource | Estimated monthly cost |
| --- | --- |
| Aurora Serverless v2 database (0.5 capacity-unit minimum, always on) | ~$44 |
| NAT gateway (default setting `CreateNatGateway: "true"`) | ~$33 plus data charges |
| CloudFront, S3, Lambda, API Gateway, Secrets Manager, logs | ~$3-$10 combined |
| Route53 hosted zone (only with a custom domain) | ~$0.50 |

The NAT gateway is what lets the backend reach services outside AWS: payment gateways such as Stripe, Mautic, YouTube, and outgoing email. Only consider setting `CreateNatGateway` to `"false"` if you use none of those; the trade-offs are explained in [Operations After Launch](./operations.md#cost-control).

Also plan for time: expect the first install to take **2 to 4 focused hours**, longer if you are creating AWS and GitHub accounts from scratch or waiting on someone else to approve access.

After the install, consider creating an AWS billing alarm (AWS console > Billing > Budgets) so an unexpected charge emails you instead of surprising you at the end of the month.

AWS charges depend on your account, region, usage, and current AWS pricing. In general:

- The prod deployment creates AWS resources and can cost money while it is running.
- Optional staging creates a second AWS stack and can cost extra while it is running.
- Aurora/RDS database resources are usually one of the most important cost items.
- CloudFront, S3, Lambda, API Gateway, Secrets Manager, Route53, NAT/networking, and logs may also create charges.
- A reset deletes the Aurora final snapshot it creates, so snapshots no longer pile up after repeated resets. If you override that with `--delete-final-snapshots=false`, the retained snapshots keep costing money until you remove them.
- ACM public certificates are usually free, but Route53 hosted zones and DNS queries can cost money.

To keep the AWS footprint smaller, deploy `prod` only, skip staging, and delete temporary testing resources when you are finished testing.

## Final Report

After your selected environments are deployed, observed, verified, and browser-tested, generate the rollout report.

For the prod-only path with the smallest AWS footprint, run:

```bash
npm run installer:report -- \
  --environment=prod \
  --deployment-root=../b1admin-deploy/deployment \
  --write=true \
  --check-http=true \
  --output=markdown
```

If you deployed both staging and prod, run:

```bash
npm run installer:report -- \
  --environment=all \
  --deployment-root=../b1admin-deploy/deployment \
  --write=true \
  --check-http=true \
  --output=markdown
```

The report writes:

```text
../b1admin-deploy/deployment/deployment-report.md
```

It summarizes:

- staging and/or prod URLs
- GitHub Actions run IDs
- source commit SHAs
- stack names
- saved output files
- verification results
- browser smoke results
- first-admin bootstrap status

The report reads saved dispatch, source metadata, bootstrap, and browser-smoke evidence automatically. If an older deployment evidence folder is missing `source-metadata.json`, rerun the latest deploy or provide the source SHAs with the report command.

Use [first-rollout-checklist.md](./first-rollout-checklist.md) for the detailed verification checklist.

## When You Are Done

Before considering the install complete, confirm:

- [ ] The final report exists at `../b1admin-deploy/deployment/deployment-report.md`.
- [ ] The report status is complete or all remaining notes are understood.
- [ ] Browser smoke passed for each deployed environment.
- [ ] The first admin can sign in.
- [ ] The first admin temporary password has been changed or handed off securely.
- [ ] The deployed frontend URL is the URL the customer will use.
- [ ] The backend accepts the deployed frontend URL for browser login.
- [ ] Safe private repository changes have been committed and pushed.
- [ ] `customer-values.json`, app secret files, bootstrap secret files, and `deployment/` were not committed.
- [ ] If staging was only used for practice, staging has been reset or intentionally left running.
- [ ] Any database snapshots kept with `--delete-final-snapshots=false` are either intentionally kept or cleaned up.

## Update An Existing Install

Use this when B1Admin source code has changed and you want to update an already installed AWS deployment.

Your private repository remains the deployment control center. The user should not push customer settings or deployment evidence back to the B1Admin source repository or the Api source repository.

Open a terminal in the `b1admin-installer` folder.

If you are not sure you are in the right place, run:

```bash
pwd
```

The output should end with `b1admin-installer`.

Then run one command:

```bash
npm run installer:update -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=prod \
  --output=markdown
```

The update command will:

- ask before pulling the latest B1Admin source repository code
- refresh your private repository scaffold
- show private repository changes if safe scaffold files changed
- offer to commit and push safe private repository scaffold changes
- start the guided prod deployment runner

The update command still pauses before approval steps. Read each prompt before answering.

The update deploys the installer's pinned tested source versions by default. To move to newer B1Admin/Api code, update the refs in `customer-values.json` (or pass `--b1admin-ref=`/`--api-ref=`) deliberately — newer upstream code may need installer changes, so prefer waiting for an installer release that has re-pinned and re-verified `tested-source-refs.json`. See [Operations After Launch](./operations.md#source-versions-are-pinned) for the full update guidance.

Important: `installer:update` is a guided update command, not a zero-downtime guarantee. For a production environment with active users, update optional staging first when available, verify login and key workflows, confirm backups or snapshots exist, review the prod preflight and preview output, and run prod during an approved low-traffic or maintenance window. Database migrations, CloudFormation replacements, API changes, and frontend/backend compatibility changes can affect live users if they are not planned carefully.

Do not add `customer-values.json`, `app-config-secret.json`, `bootstrap-admin-secret.json`, or `deployment/`.

If you also maintain the optional staging environment, update staging first:

```bash
npm run installer:update -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=staging \
  --output=markdown
```

After staging is verified, run the prod update command.

## Clean Reset

Use reset only when you intentionally want to remove an environment and start over.
If you deployed prod only, use only the prod reset command. Run staging reset only if you actually deployed staging.
If you used a region other than `us-east-1`, replace `us-east-1` in these commands.

For a prod-only install, preview prod reset first:

```bash
npm run reset:prod -- --region=us-east-1 --dry-run=true
```

Run the real prod reset only after the preview list is understood:

```bash
npm run reset:prod -- --region=us-east-1
```

If you deployed staging, preview and run staging reset separately:

```bash
npm run reset:staging -- --region=us-east-1 --dry-run=true
npm run reset:staging -- --region=us-east-1
```

The reset scripts remove CloudFormation stacks, retained buckets, Lambda log groups, generated Secrets Manager secrets, and the Aurora final snapshot — **which means the database contents are gone for good.** Run the `--dry-run=true` line above first and read what it plans to delete.

Two flags change what a reset touches:

- `--delete-final-snapshots=false` keeps the Aurora snapshot instead of deleting it. The reset then prints what it left behind. Use this if there is any chance you want the data back.
- `--delete-certificates=true` also deletes the TLS certificates the stacks used, plus their DNS validation records. Off by default, because you supplied those certificates yourself and they are free to keep and reuse on the next install. A certificate still attached to something is always skipped and reported rather than force-deleted.

Run a reset while the stacks still exist — the certificate ARNs are read from the live stacks, and once the stacks are gone there is nothing left to read them from. Reset uses your own AWS credentials, not the GitHub deploy role, so it needs an account that can delete these resources.

## If Something Fails

Start with the guided command again:

```bash
npm run installer:run -- \
  --deploy-repo-dir=../b1admin-deploy \
  --deploy-env-dir=../b1admin-deploy/environments \
  --deployment-root=../b1admin-deploy/deployment \
  --customer-file=../b1admin-deploy/customer-values.json \
  --environment=prod \
  --output=markdown
```

Then use the specific checks below:

```bash
npm run installer:doctor -- \
  --customer-file=../b1admin-deploy/customer-values.json \
  --deploy-env-dir=../b1admin-deploy/environments \
  --output=markdown

npm run installer:preflight -- \
  --environment=<staging|prod> \
  --customer-file=../b1admin-deploy/customer-values.json \
  --output=markdown

npm run show:rollout-status -- --output=markdown

gh run view <run-id> --repo <owner>/<private-deploy-repo> --log-failed
```

If you are stuck, email `dennis.hempler@protonmail.com` with `B1Admin` in the subject line.

Common causes:

- wrong GitHub account is authenticated in `gh`
- your private repository is not private or not accessible
- needed GitHub Environment is missing, normally `aws-prod` and, only if you use staging, `aws-staging`
- GitHub Environment secrets are missing
- AWS IAM role trust policy names the wrong repo or environment
- Api source repository cannot be checked out by the workflow
- frontend ACM certificate is not in `us-east-1`
- frontend URL and backend CORS/root URL values do not match after switching from generated CloudFront to a custom domain

## Reference

Use these only when you need detail beyond the guided path:

- [Your private repository](./setup/deployment-repository.md)
- [GitHub Actions setup guide](./github-actions-setup.md)
- [IAM setup guide](../iam/README.md)
