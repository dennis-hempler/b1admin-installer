# Customer Values Worksheet

Collect these values before configuring prod or optional staging.

The guided installer stores these values in `../b1admin-deploy/customer-values.json`.
You do not need to edit that JSON file by hand.

The normal setup command creates the file when it does not already exist:

```bash
npm run installer:init -- --deploy-repo-dir=../b1admin-deploy --output=markdown
```

Then answer the customer setup questions:

```bash
npm run installer:customer-values -- --customer-file=../b1admin-deploy/customer-values.json --write=true --output=markdown
```

Keep `customer-values.json` local. Do not commit it.

Required:

- AWS account ID
- AWS region, normally `us-east-1`
- private deployment repository name, for example `your-org/b1admin-deploy`
- root domain, for example `example.com`
- support email address, for example `support@example.com`
- support phone number
- first admin email address
- temporary first admin password
- first church name

Recommended:

- B1Admin source repo and ref — accept the suggested defaults: `ChurchApps/B1Admin` at the installer's pinned tested version
- Api source repo and ref — accept the suggested defaults: `ChurchApps/Api` at the installer's pinned tested version

The installer suggests exact source versions it was last verified against end to end (recorded in `tested-source-refs.json` at the installer repo root). Accepting them protects your install from changes that landed on the upstream `main` branches after that verification. Enter `main` only if the B1Admin team advises it.

Optional frontend custom domain:

- frontend hostname, for example `admin.example.com`
- ACM certificate ARN for that hostname
- Route53 hosted zone ID

The frontend ACM certificate must be in `us-east-1` because CloudFront requires it there.

You may leave frontend custom-domain values blank. In that case the first deploy uses a generated CloudFront URL. After that first deploy, the guided runner will ask you to adopt that generated frontend URL so the backend accepts it for browser login.

Leave API custom-domain values blank for the normal install. The stack will use the generated API Gateway URL.

[Back to Start Here](../start-here.md)
