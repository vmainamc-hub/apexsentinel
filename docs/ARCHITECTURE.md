# Architecture

## Boundaries

The platform has two identities that are never interchangeable:

- Platform owners/staff authenticate with Supabase Auth. Organisation membership and explicit platform permissions authorize site-manager actions.
- End traders authenticate with Deriv OAuth. Their token records and sessions are site-bound, origin-bound, encrypted, and service-role-only.

One GitHub repository contains the runtime plus public configuration for every site. A customer is not assigned a code fork. Netlify creates one project per site and sets `REEF_SITE_ID`; the build copies only `sites/<id>/site.config.json` into the runtime.

## Trader OAuth and Options connection

```text
generated site /api/deriv-oauth-start
  -> server creates state + PKCE S256 transaction
  -> https://auth.deriv.com/oauth2/auth
  -> https://customer-domain/api/deriv-oauth-callback
  -> server validates/consumes state and exchanges code
  -> AES-GCM encrypted token record + opaque HttpOnly cookie
  -> BFF lists Options accounts
  -> BFF validates the selected account and requests an OTP URL
  -> browser connects directly to the short-lived wss://api.derivws.com URL
```

Netlify reverse-proxies `/api/deriv-*` to the central Edge Functions. This makes `SameSite=Lax; Secure; HttpOnly; Path=/api` a first-party site cookie. CSRF tokens are returned by the session endpoint, held only in memory, and required for OTP and logout mutations.

## Tenant and permission model

`organisations` own sites. `organisation_members` supports tenant owner/developer/viewer plus super-admin, operations, support, and finance roles. Database RLS protects tenant reads/writes; Edge Functions re-check membership or a named permission before privileged provider calls.

Platform permission summary:

| Role | Sites/deployments | Support | Markup finance | Platform configuration |
| --- | --- | --- | --- | --- |
| Super admin / legacy admin | Manage | Manage | Read | Manage |
| Operations admin | Manage | No | No | Templates/features/notices |
| Support admin | Read | Manage | No | No |
| Finance viewer | Read | No | Read-only | No |

## Registries and configuration

- `packages/template-registry`: approved runtime versions and compatibility.
- `packages/feature-registry`: API/capability metadata combined with scope requirements.
- `packages/deriv-auth`: public BFF contract and centralized scope mapping.
- `packages/site-config-schema`: secret-free runtime contract.
- `packages/deployment-adapters`: provider interface for future deployment providers.

Drafts are stored in `site_configurations`; published versions are immutable snapshots. Public config includes tenant/site/template/version/branding/features/navigation/bots/tools and public Deriv application identifiers. It excludes tokens, provider credentials, encryption keys, and owner identities.

## Revenue domains

Registered-application markup comes only from Deriv's application markup-statistics API and is stored with its raw source version. Partner/referral commission is marked unavailable unless a separately approved provider API is added. Platform subscriptions are a third, unrelated billing domain.
