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

Then **stop using the root user.** After this page you will not need it again for a normal install. Everything else uses the sign-in you create in step 4.

Root access is worth protecting carefully: it can close the account, change billing, and undo any restriction you set elsewhere.

## Step 3: Turn On A Billing Alert

Do this before you deploy anything, not after.

In the AWS console go to **Billing and Cost Management** > **Budgets** > **Create budget**. Create a monthly cost budget with an email alert at an amount you would want to know about — for a normal B1Admin install, something like $120 gives you warning without alerting constantly.

This is the single cheapest thing you can do to avoid a surprise. A misconfiguration that leaves resources running is much easier to catch in week one than in month three.

## Step 4: Create A Sign-In You Can Use From The Terminal

The root user cannot be used for the installer, and should not be. You need a separate identity with permission to create AWS resources.

There are two ways. Pick one.

### Option A: IAM Identity Center (recommended)

This gives you logins that expire on their own, so there is no permanent password or key sitting on your computer. It is AWS's recommended approach and it is what larger organizations expect.

In the AWS console, search for **IAM Identity Center** and enable it. Then:

1. Create a user for yourself, with your real email address.
2. Create a permission set. For a first install, use the predefined **AdministratorAccess** permission set — see the note on permissions below.
3. Assign your user to the account with that permission set.
4. Note the **AWS access portal URL** that Identity Center shows you. You will need it in step 5.

You will receive an email to set your password and enroll in MFA.

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

## Step 5: Connect The AWS CLI

Install the AWS CLI if you have not already: [download](https://aws.amazon.com/cli/). Open a new terminal afterward so it is on your path.

```bash
aws --version
```

Now connect it to your account, matching the option you chose in step 4.

### If you chose Option A (Identity Center)

```bash
aws configure sso
```

It asks for the **AWS access portal URL** from step 4 and an SSO region, opens your browser to sign in, then asks which account and permission set to use. When it asks for a **profile name**, the simplest choice is `default` — the installer then works with no extra setup.

If you give it any other name, you must tell every terminal session to use it:

```bash
export AWS_PROFILE=<your-profile-name>
```

Identity Center sessions expire. When commands start failing with an expired-token message, run `aws sso login` and continue.

### If you chose Option B (access keys)

```bash
aws configure
```

Enter the access key ID and secret access key from step 4. For **Default region name** enter your region from step 6 — normally `us-east-1`. For **Default output format** enter `json`.

### Either way, check it worked

```bash
aws sts get-caller-identity
```

This should print a block of JSON containing `"Account"` followed by your 12-digit account number. If it does, the hard part is over — every other AWS page in this guide starts from here.

## Step 6: Choose Your Region

A region is the physical location your data and servers live in. Pick one and use it consistently; mixing regions is a common cause of confusing failures.

Use `us-east-1` unless you have a reason not to. It is the default everywhere in this guide, and it avoids one specific complication: if you later add your own domain name, the certificate for it **must** live in `us-east-1` regardless of where everything else runs. Choosing `us-east-1` for everything keeps that from being something you have to think about.

If you do choose a different region, keep in mind:

- use the same region every time you are asked for one, including in `customer-values.json`
- a frontend certificate still has to be created in `us-east-1`
- not every AWS feature exists in every region

Set it as your default so you do not have to pass it every time:

```bash
aws configure set region us-east-1
aws configure get region
```

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
- **`Unable to locate credentials`** — step 5 has not been completed in this terminal. If you used a named profile, set `AWS_PROFILE`.
- **`The security token included in the request is expired`** — an Identity Center session ran out. Run `aws sso login`.
- **`InvalidClientTokenId` or `SignatureDoesNotMatch`** — the access key was mistyped or has been deleted. Run `aws configure` again, or create a new access key.
- **The account number is wrong** — you are signed in to a different AWS account. Stop and switch before running anything that creates resources; deploying into the wrong account is tedious to unwind.
- **Errors that mention your account is not verified, or resource creation fails for no clear reason on a very new account** — verification from step 1 has probably not finished. Wait for the confirmation email and try again.
- **`AccessDenied` when the installer creates IAM roles** — the identity from step 4 does not have permission to create roles. Review the permissions note in step 4.

## You Are Ready When

- `aws sts get-caller-identity` prints the account where B1Admin will run
- `aws configure get region` prints the region you chose
- the root user has MFA turned on and you are no longer signed in as root
- a billing alert exists

Next: [AWS account access](./aws-account-access.md) creates the deployment roles B1Admin needs.

[Back to Start Here](../start-here.md)
