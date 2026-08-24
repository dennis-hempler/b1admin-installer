# B1Admin AWS Installer

A guided installer that deploys [B1Admin](https://github.com/ChurchApps/B1Admin) into your own AWS account.

You do not need to be a developer to use it. The installer asks you a short list of questions, then tells you exactly one command to run at a time, checking its own work as it goes.

## Start Here

**[👉 Read the Start Here guide](./infrastructure/environments/start-here.md)** — the full walkthrough, written for the person doing the installation.

The short version:

```bash
git clone https://github.com/dhempler/b1admin-installer.git
cd b1admin-installer
npm install
npm run installer:doctor   # checks your computer has the required tools
npm run installer:start    # tells you the next step, every time
```

`npm run installer:start` is the only command you need to remember. Run it whenever you are unsure what comes next — it looks at how far along you are and prints the next command to run.

## What You Need

- An AWS account you can create resources in (this will incur AWS charges — see [What Costs Money](./infrastructure/environments/start-here.md#what-costs-money)). Brand new to AWS? [Setting up a brand-new AWS account](./infrastructure/environments/setup/aws-new-account.md) covers it from scratch.
- A GitHub account
- Node.js 20 or newer
- The `aws` and `gh` command-line tools (the doctor command checks these for you)

## How It Works

This repository contains only the installer — the tooling, the AWS CloudFormation templates, and the deployment workflow. It does not contain the B1Admin application code.

When you deploy, the installer pulls the application source from its own repositories at a version this installer has been tested against (the exact commits are pinned in [`tested-source-refs.json`](./tested-source-refs.json) and verified by a full clean-room install):

| What | Comes from |
| --- | --- |
| Frontend | [ChurchApps/B1Admin](https://github.com/ChurchApps/B1Admin) |
| Backend API | [ChurchApps/Api](https://github.com/ChurchApps/Api) |
| Installer, infrastructure, workflow | this repository |

Those source versions are recorded in your `customer-values.json` as `b1adminRef` and `apiRef`, so an install is reproducible and an update is a deliberate choice rather than a surprise.

The installer also creates a **separate private repository** for you. Your AWS settings, generated secrets, and deployment records live there — never in this public repository.

## Your Secrets Stay Yours

Files named `customer-values.json`, `app-config-secret.json`, and `bootstrap-admin-secret.json` are ignored by git at any depth in this repository. They belong in your own private deployment repository, which the installer sets up for you.

## Documentation

- [Start Here](./infrastructure/environments/start-here.md) — the main installation walkthrough
- [Operations After Launch](./infrastructure/environments/operations.md) — updates, backups, secrets, cost control
- [First Rollout Checklist](./infrastructure/environments/first-rollout-checklist.md)
- [Setting Up A Brand-New AWS Account](./infrastructure/environments/setup/aws-new-account.md) — from no AWS account to a working `aws` command
- [Setup Guides](./infrastructure/environments/setup/) — AWS access, IAM roles, GitHub secrets, and CLI setup, one topic per page
- [Your Private Repository](./infrastructure/environments/setup/deployment-repository.md)

## Need Help?

Email `dennis.hempler@protonmail.com` with `B1Admin` in the subject line.

## Relationship To ChurchApps

B1Admin is built by [ChurchApps](https://churchapps.org). This installer is maintained separately so it can be updated on its own schedule; it is not an official ChurchApps project.

## License

MIT
