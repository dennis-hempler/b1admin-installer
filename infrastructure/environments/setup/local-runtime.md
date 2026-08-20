# Local Runtime

Install Node.js and npm on the machine where you will run the installer commands.

Use the version supported by this repository's `package.json` (Node.js 20 or newer). If your organization already has a standard Node installer or version manager, use that. Otherwise, install the current long-term support Node.js release from [nodejs.org](https://nodejs.org/en/download). Git is available from [git-scm.com](https://git-scm.com/downloads) if it is not already installed.

This installer uses **npm**, which ships with Node.js. No other package manager is needed for the normal guided install.

Confirm the local tools are available:

```bash
node --version
npm --version
git --version
gh --version
aws --version
```

Each command should print a version number. If a command says it was not found, install that tool and open a new terminal before continuing.

Then install the installer's own dependencies, from the `b1admin-installer` folder:

```bash
npm install
```

The first installer steps work before `npm install` has run, but the first-admin bootstrap and browser smoke steps need it. If the browser smoke step reports that it cannot launch a test browser, run `npx playwright install chromium` once and try again.

You can run the local readiness report any time:

```bash
npm run installer:doctor -- --output=markdown
```

Before dependencies are installed, the doctor may report dependency-related TODO items. That is expected early in the install.

About Yarn: the doctor lists it as an **optional** tool. It is needed only if you later choose to build the B1Admin or Api application sources on this computer, which the normal guided install never does — the deployment builds them on GitHub. If you do go down that advanced path, those repositories manage their own Yarn version through Corepack (`corepack enable`); do not install Yarn with `npm install -g yarn`.

You are ready when `node`, `npm`, `git`, `gh`, and `aws` are installed and `npm install` has completed in the `b1admin-installer` folder. You do not need a copy of the B1Admin or Api application source on this computer.

[Back to Start Here](../start-here.md)
