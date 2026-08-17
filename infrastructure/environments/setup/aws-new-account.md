# Setting Up A Brand-New AWS Account

Use this page if the AWS account is new, or if nobody has ever run AWS commands from a terminal on this computer. It takes you from "no AWS account" to the point where `aws sts get-caller-identity` prints your account number — which is where every other AWS page in this guide begins.

If someone else already manages your AWS account and has given you a working sign-in, you can skip this page and go to [AWS account access](./aws-account-access.md).

Work through the steps in order. Steps 1 through 6 are required. Step 7 is optional and can be done later.

You do **not** need a domain name to finish your first install. B1Admin will be reachable at an address AWS gives you, and you can add your own domain afterward. See step 7.

## Before You Start

Have ready:

- an email address nobody else uses for AWS, and that you can receive mail at
- a credit or debit card
- a phone that can receive a call or text

AWS asks for a card even though a new account starts with no charges. B1Admin costs roughly $80-90 per month once running; see [What Costs Money?](../start-here.md#what-costs-money).

## Step 1: Create The AWS Account

Go to [aws.amazon.com](https://aws.amazon.com) and choose **Create an AWS Account**.

The email address you sign up with becomes the **root user**. This is the most powerful login the account has, and it cannot be replaced later without a lot of trouble. Use an address that:

- belongs to your organization, not to one person who might leave
- more than one trusted person can reach if needed
- is not a personal inbox

AWS asks you to choose a support plan. **Basic Support** is free and is enough for B1Admin.

**New accounts are not usable immediately.** AWS verifies your card and phone first. This usually takes a few minutes but can take several hours. Until verification finishes, commands that create resources fail with confusing permission or validation errors. Wait until you receive the confirmation email before continuing.

## Step 2: Protect The Root User

Sign in as the root user and turn on multi-factor authentication (MFA). In the AWS console this is under your account name (top right) > **Security credentials** > **Multi-factor authentication (MFA)**. An authenticator app on your phone is the easiest option.

Then **stop using the root user.** After this page you will not need it again for a normal install. Everything else uses the sign-in you create in step 5.

Root access is worth protecting carefully: it can close the account, change billing, and undo any restriction you set elsewhere.

## Step 3: Turn On A Billing Alert

Do this before you deploy anything, not after.

In the AWS console go to **Billing and Cost Management** > **Budgets** > **Create budget**. Create a monthly cost budget with an email alert at an amount you would want to know about — for a normal B1Admin install, something like $120 gives you warning without alerting constantly.

This is the single cheapest thing you can do to avoid a surprise. A misconfiguration that leaves resources running is much easier to catch in week one than in month three.

## Step 4: Choose Your Region

Do this before creating your sign-in. Some of what comes next is permanent and inherits whatever region you happen to be looking at.

A region is the physical location your data and servers live in. Pick one and use it consistently; mixing regions is a common cause of confusing failures.

Use `us-east-1` unless you have a reason not to. It is the default everywhere in this guide, and it avoids one specific complication: if you later add your own domain name, the certificate for it **must** live in `us-east-1` regardless of where everything else runs. Choosing `us-east-1` for everything keeps that from being something you have to think about.

If you do choose a different region, keep in mind:

- use the same region every time you are asked for one, including in `customer-values.json`
- a frontend certificate still has to be created in `us-east-1`
- not every AWS feature exists in every region

**Set the console to that region now**, using the region menu in the top-right corner of the AWS console. The next step reads it and cannot be changed afterward.

## Step 5: Create A Sign-In You Can Use From The Terminal

The root user cannot be used for the installer, and should not be. You need a separate identity with permission to create AWS resources.

There are two ways. Pick one.

### Option A: IAM Identity Center (recommended)

This gives you logins that expire on their own, so there is no permanent password or key sitting on your computer. It is AWS's recommended approach and it is what larger organizations expect.

Check the region menu in the top-right corner of the console first. It must already say the region you chose in step 4 — Identity Center's home region is set from it and **can never be changed**.

Search the console for **IAM Identity Center** and choose **Enable**.

**Enable is not a single click.** A confirmation page appears with an *Instance configuration* choice, and the pre-selected option is not the one you want:

- **Multi-Region instance** is pre-selected. It copies your instance to a second region and encrypts it with a key you own, which carries an ongoing charge — the page says so, in a yellow "AWS KMS charges apply" box.
- **Single-Region instance** is the right choice for a B1Admin install. It uses a key AWS manages at no cost. Selecting it makes the KMS warning disappear.

Check that **Primary Region** on that page shows the region from step 4 before continuing. If it does not, cancel, change the region in the top-right menu, and start again — this value is marked *"Can be changed later: No"*.

Then create the sign-in itself. **All three parts are required.** A user on its own can sign in to nothing:

1. **Create a user** for yourself under **Users**, with your real email address. Leave the password option on *Send an email to this user with password setup instructions* — you set your own password, and nobody else ever sees it. The emailed link is valid for 7 days.
2. **Create a permission set** under **Permission sets**. Choose *Predefined permission set* and **AdministratorAccess** — see the note on permissions below. The default session duration is 1 hour, which means signing in again every hour while you work; **4 hours** is a more comfortable choice for an install day.
3. **Assign the user to the account.** Go to **AWS accounts**, tick your account, choose **Assign users or groups**, pick your user, then pick the permission set. Skipping this is the most common mistake: `aws configure sso` will happily sign you in and then show an empty list of accounts.

Finally, note the **AWS access portal URL** shown on the Identity Center dashboard. You need it in step 6.

> **A false alarm to expect.** After a successful assignment, the permission set's summary box may still read **"Not provisioned"**, and stay that way even after refreshing. Ignore it. The reliable indicator is the **AWS accounts** tab on the permission set, which will list your account with the status **Up to date**. Do not re-run the assignment trying to clear the header.

### Option B: An IAM User With Access Keys (simpler)

This is easier to set up but creates a long-lived key file on your computer. It is a reasonable choice for a single operator doing one install, provided you treat the key carefully.

In the AWS console go to **IAM** > **Users** > **Create user**:

1. Give the user a name such as `b1admin-installer`.
2. Attach the **AdministratorAccess** policy directly — see the note on permissions below.
3. After the user is created, open it, go to **Security credentials** > **Create access key**, and choose **Command Line Interface (CLI)**.
4. Copy the **Access key ID** and **Secret access key** somewhere safe immediately. AWS shows the secret only once.

Treat those two values like a password to your whole AWS account. Do not email them, paste them into a chat, or commit them to a repository. When the install is finished and you no longer need to run installer commands, delete the access key in the same screen where you created it — you can always create a new one later.

### A Note On Permissions

Both options above use **AdministratorAccess**, which allows everything.

The installer genuinely needs broad permissions: it creates IAM roles, networking, databases, functions, storage, and a CDN. Narrowing this down correctly before your first install usually causes failures partway through that are hard to diagnose, so administrator access is the practical starting point for a new account.

If your organization requires tighter permissions, the exact actions the deployment itself needs are listed in the sample policies under [`infrastructure/iam/`](../../iam/README.md). Those policies cover the deployment. The person running the installer additionally needs to be able to create IAM roles.

## Step 6: Connect The AWS CLI

Install the AWS CLI if you have not already: [download](https://aws.amazon.com/cli/). Open a new terminal afterward so it is on your path.

```bash
aws --version
```

Set your password first if you chose Option A — use the link in the invitation email, and enroll in MFA when prompted. Then connect the CLI, matching the option you chose in step 5.

### If you chose Option A (Identity Center)

```bash
aws configure sso
```

It asks for the **AWS access portal URL** from step 5, then an **SSO region**. The SSO region is where Identity Center itself lives, which — if you followed step 4 — is the same region you are deploying into. It then opens your browser to sign in and asks which account and permission set to use. When it asks for a **profile name**, the simplest choice is `default` — the installer then works with no extra setup.

If you give it any other name, you must tell every terminal session to use it:

```bash
export AWS_PROFILE=<your-profile-name>
```

The installer scripts do not take a `--profile` option — they use whatever profile the terminal is already set to, which is why naming it `default` is simplest.

Identity Center sessions expire. When commands start failing with an expired-token message, run `aws sso login` and continue.

### If you chose Option B (access keys)

```bash
aws configure
```

Enter the access key ID and secret access key from step 5. For **Default region name** enter your region from step 4 — normally `us-east-1`. For **Default output format** enter `json`.

### Either way, check it worked

```bash
aws sts get-caller-identity
aws configure get region
```

The first should print a block of JSON containing `"Account"` followed by your 12-digit account number, and the second your region. If the region is blank, set it:

```bash
aws configure set region us-east-1
```

**Check the account number carefully.** If you have more than one AWS account, this is the moment to confirm the CLI is pointed at the one you intend to deploy into — the installer acts on whatever this command reports, not on whatever account your browser happens to be showing. The two can differ.

Once both commands look right, the hard part is over — every other AWS page in this guide starts from here.

## Step 7: Your Own Domain Name (optional, can be done later)

**Skip this for a first install.** B1Admin works without it — AWS gives you a working address, and the install finishes normally. Come back when you are ready to use your own domain.

When you are ready, you need three things, in this order:

1. **A hosted zone** for your domain in Route53. If you register the domain through Route53, this is created for you. If your domain is registered somewhere else, create a hosted zone for it in Route53 and then update the nameservers at your existing registrar to the four Route53 gives you. DNS changes can take up to a day to spread.
2. **A certificate** in AWS Certificate Manager, in **`us-east-1`**, for the exact name you will use (for example `admin.example.org`). Choose DNS validation. If the hosted zone is in the same account, ACM offers a button to create the validation records for you — use it.
3. **Both values recorded** in your `customer-values.json`: the certificate ARN and the hosted zone ID, under the environment you are deploying.

The certificate must show status **Issued** before you deploy. A certificate stuck in **Pending validation** means the DNS validation record is missing or has not spread yet.

Important: certificates are something *you* create and *you* own. The installer only points at them. It never creates them, and a reset never deletes them unless you explicitly ask it to, so they are safe to reuse across reinstalls. See [Operations After Launch](../operations.md).

## Quick Checks

```bash
aws sts get-caller-identity
aws configure get region
```

What good output looks like:

- the first command prints your 12-digit account number under `"Account"`
- the second prints your region, normally `us-east-1`

Write down the account number. You will be asked for it as `<aws-account-id>` throughout the rest of the guide, and the installer uses it to generate storage names that have to be unique across all of AWS.

## Common Fixes

- **`aws: command not found`** — the AWS CLI is not installed, or the terminal was open before you installed it. Install it and open a new terminal.
- **`Unable to locate credentials`** — step 6 has not been completed in this terminal. If you used a named profile, set `AWS_PROFILE`.
- **`The security token included in the request is expired`** — an Identity Center session ran out. Run `aws sso login`.
- **`InvalidClientTokenId` or `SignatureDoesNotMatch`** — the access key was mistyped or has been deleted. Run `aws configure` again, or create a new access key.
- **`aws configure sso` signs you in but lists no accounts** — the user exists but has no access yet. Part 2 or part 3 of step 5 Option A is missing: a permission set has to exist *and* be assigned to your account.
- **The permission set says "Not provisioned"** — usually nothing is wrong. Open the permission set's **AWS accounts** tab; if your account is listed as **Up to date**, the assignment worked and the summary box is just stale.
- **The account number is wrong** — you are signed in to a different AWS account. Stop and switch before running anything that creates resources; deploying into the wrong account is tedious to unwind. Note that your terminal and your browser can be signed in to *different* accounts at the same time; the installer follows the terminal.
- **Errors that mention your account is not verified, or resource creation fails for no clear reason on a very new account** — verification from step 1 has probably not finished. Wait for the confirmation email and try again.
- **`AccessDenied` when the installer creates IAM roles** — the identity from step 5 does not have permission to create roles. Review the permissions note in step 5.

## You Are Ready When

- `aws sts get-caller-identity` prints the account where B1Admin will run — and you have checked it is the right one
- `aws configure get region` prints the region you chose
- if you used Identity Center, `aws configure sso` listed your account and the `AdministratorAccess` role, rather than an empty list
- the root user has MFA turned on and you are no longer signed in as root
- a billing alert exists

Next: [AWS account access](./aws-account-access.md) creates the deployment roles B1Admin needs.

[Back to Start Here](../start-here.md)
