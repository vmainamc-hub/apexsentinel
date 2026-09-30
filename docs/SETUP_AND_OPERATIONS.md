# Setup and operations

## 1. Local prerequisites

- Node.js 20 and npm. The repository includes `.nvmrc`; do not use the Node 23
  development release used by this workstation for production/CI verification.
- Supabase CLI for migrations/function deployment.
- A Supabase project.
- A GitHub App installed only on the shared repository.
- A Netlify team with its GitHub App connected to that repository.
- One Deriv OAuth application configuration per generated site/application mapping.

Copy `.env.example` values into untracked environment files. Browser variables are public; every credential belongs in Supabase secrets.

Generate the AES-256 token key once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Set all server values shown in `.env.example` with `supabase secrets set`.

## 2. Database and Edge Functions

From `deriv-sites-ui-kit-main`:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy deriv-oauth-start --no-verify-jwt
supabase functions deploy deriv-oauth-callback --no-verify-jwt
supabase functions deploy deriv-trader-session --no-verify-jwt
supabase functions deploy deriv-trader-accounts --no-verify-jwt
supabase functions deploy deriv-trader-otp --no-verify-jwt
supabase functions deploy deriv-owner-oauth-start
supabase functions deploy fetch-markup-statistics
supabase functions deploy public-site-config --no-verify-jwt
supabase functions deploy publish-site-to-github
supabase functions deploy provision-site-netlify
supabase functions deploy netlify-deploy-webhook --no-verify-jwt
```

Migration `20260719000300_multitenant_deriv_platform.sql` backfills organisations, removes stored personal Deriv API tokens, installs RLS/RBAC, and creates configuration/auth/reporting/audit tables.

## 3. Deriv application setup

For each site, register its exact HTTPS callback in the Deriv application dashboard:

```text
https://customer-domain.example/api/deriv-oauth-callback
```

Enter the public App ID, OAuth client ID, exact callback, and environment in wizard step 5. Do not enter a Deriv password, access token, refresh token, or client secret.

Feature scopes:

| Feature | Scope | Session |
| --- | --- | --- |
| Public market data | None | Public socket |
| Options account list | `trade` | Trader |
| Options trading / OTP socket | `trade` | Trader |
| Options account creation | `account_manage` | Trader |
| Wallet data (experimental) | `payment` | Trader |
| Markup statistics | `application_read` | Owner reporting connection |
| Application metadata (experimental) | `application_read` | Owner reporting connection |

Trader login never requests owner-only `application_read`. The owner connects reporting separately in wizard step 8.

## 4. GitHub and Netlify

Use the detailed [GitHub App guide](../deriv-sites-ui-kit-main/docs/GITHUB_PUBLISHING_SETUP.md). The GitHub App needs repository Contents read/write; a classic PAT is not used for publishing.

Netlify uses `new-user-interface-main` as the base, `npm run build`, and `dist`. Each site gets `REEF_SITE_ID`. The repository's `netlify.toml` contains the `/api` BFF proxies before the SPA fallback. If the Supabase project ref changes, update those five proxy targets before deployment.

After `deploy_succeeded`, the signed webhook marks the domain/site active, stores a deployment log, and performs an HTTP health check. A site is not considered live merely because GitHub accepted a commit.

## 5. Rollback and troubleshooting

- Retry a failed provider run from the site's deployment history.
- Restore a prior published snapshot; this creates a new, auditable revert commit rather than rewriting Git history.
- Use the returned correlation ID to find sanitized server logs and `audit_logs`/`deployment_logs`.
- `origin_denied`: verify the primary domain is active or add only the exact preview origin to `TRADER_CORS_ORIGINS`.
- `scope_missing`: enable the feature, update configured scopes, and reconnect the relevant Deriv identity.
- `deriv_connection_required`: connect the owner's reporting identity in wizard step 8.
- Cookie/session failures: ensure HTTPS and that `/api/deriv-oauth-callback` is the exact registered callback.
- GitHub rate limits/provider errors: retry after the logged provider condition clears; credentials remain server-side.

Offline browsers cannot contact GitHub or Supabase. Once an Update request reaches the server, it completes independently of the tab. Unsynchronized browser changes must reconnect before they can be saved or published.

## Known limitations

- Live OAuth/provider verification requires the real Deriv, GitHub, Netlify, DNS, and Supabase credentials.
- The inherited Blockly runtime builds successfully but still has a large legacy strict-TypeScript backlog outside the migrated auth/config files.
- The repository contains an empty broken historical gitlink named `repo-push-new-user-interface`; it has no runtime files or `.gitmodules` mapping and should be removed in a repository-maintenance commit.
- Wallet and application-management features remain explicitly experimental until their exact provider contracts are implemented and tested.
- The 2026-07-19 production dependency audit reports eight inherited advisories
  (two high, six moderate) in the Deriv Quill UI UUID/release-tool chain. Patched
  direct/runtime versions are pinned; review the upstream package before launch
  and do not use `npm audit fix --force` to downgrade the UI blindly. The full
  tree additionally reports one critical, five high, and thirteen moderate
  advisories in development/release tooling.
