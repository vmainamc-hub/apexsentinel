# Reef Sites platform audit

Date: 2026-07-19

This report records the repository state before the Deriv authentication and platform-architecture migration. It is intentionally conservative: no item is classified for removal until its imports, routes, build inputs, deployment references, and data dependencies have been checked.

## Executive findings

The repository contains two active frontends, one small optional Express service, Supabase as the platform backend, and two experimental/duplicate application trees. The site manager already owns subscriptions, sites, domains, XML bots, support, runtime configuration, GitHub publishing, and Netlify provisioning. The large RSBuild application is the production generated-site runtime, but it still contains both modern and legacy Deriv authentication paths.

The most urgent defects are:

1. Deriv trader tokens are accepted in callback query parameters and persisted in `localStorage` or `sessionStorage`.
2. OAuth code exchange and refresh are performed in the browser.
3. The runtime contains a hardcoded hostname-to-App-ID/client-ID map and a legacy `wss://ws.derivws.com/websockets/v3` fallback.
4. The commission function uses stored personal API tokens, the legacy WebSocket `statement` call, a hardcoded App ID `1089`, and an invented 8% calculation. This is not registered-application markup reporting.
5. Platform-owner Supabase authentication and generated-site trader authentication are conceptually mixed in naming and data models.
6. Current ownership is directly tied to `sites.user_id`; there is no organisation membership model for teams or explicit tenant-scoped roles.
7. The existing onboarding is a purchase/domain flow plus separate setup pages, not a resumable site-creation wizard.
8. Admin authorization is a single `admin` role and the UI reads broad tables directly. The required role/permission matrix and sensitive-action audit trail do not yet exist.
9. The trading app compiles for production, but its full TypeScript check has extensive pre-existing failures, mainly in the Blockly-derived code.

## Repository map and classification

| Area | Current implementation | Classification | Decision |
| --- | --- | --- | --- |
| Site manager | `deriv-sites-ui-kit-main`, React/Vite/Supabase | Keep but refactor | This remains the owner/admin application. Consolidate setup pages into its wizard and move privileged operations behind Edge Functions. |
| Generated-site runtime | `new-user-interface-main`, React/RSBuild/MobX/Blockly | Keep but refactor | This is the production template/runtime. It consumes versioned public configuration and must use the central trader BFF. |
| Runtime configuration | `site_settings`, `site_features`, `site_pages`, `site_deriv_apps`, bots manifest, public config Edge Function | Merge and extend | Retain working fields, add versioned templates, legal/navigation/deployment metadata, feature-scope validation, and organisation ownership. |
| Publishing | GitHub App commit function, one repository with per-site config, Netlify per-site projects/webhook | Keep but refactor | The one-repository/many-sites model is correct. Add adapter contracts, health-check completion, richer logs, and tenant-scoped permissions. |
| Platform owner auth | Supabase email/password and Google OAuth | Keep unchanged at protocol boundary; refactor authorization | Keep Supabase sessions. Add organisation memberships and backend-enforced permissions. Development login stays development-only. |
| Trader OAuth | Browser PKCE, browser token exchange, legacy URL-token parsing | Replace | Use central server-side PKCE state, callback exchange, encrypted server-side token record, opaque HttpOnly site-scoped session, and BFF endpoints. |
| Trader account API | Browser REST calls using bearer token | Migrate | BFF calls `GET /trading/v1/options/accounts` with Bearer and `Deriv-App-ID`; browser receives account data, never the bearer token. |
| Authenticated Options WS | Browser requests OTP with bearer token; legacy classic WS alternative | Migrate | BFF requests account OTP and returns only the short-lived ready-to-use WebSocket URL. Remove legacy authorization messages and token storage after dependent runtime code is migrated. |
| Public market WS | Current `/trading/v1/options/ws/public` configuration | Keep but refactor | Centralize in a managed connection with request correlation/subscription cleanup. |
| Revenue reporting | `fetch-deriv-commissions`, `useDerivCommissions`, `useAdminCommissions` | Replace | Implement typed `GET /applications/v1/markup-statistics`; show unavailable/empty states. Keep partner commission and platform billing as separate domains. |
| Admin dashboard | One large `Admin.tsx`, direct Supabase queries, single admin role | Keep but refactor | Split data hooks/views, enforce permission matrix in database/functions, add organisations, integrations, deployments, audit and markup. |
| Owner dashboard | `Dashboard.tsx` with site/subscription counts | Keep but refactor | Expand with deployment/domain/OAuth/API health and real markup summary. |
| Existing setup pages | `/setup/app-id`, `/setup/token`, `/setup/bots`, `/setup/summary` | Merge, then remove after verification | Preserve valid App ID/bots/settings logic inside the new 10-step wizard. Do not retain manual PAT entry as default onboarding. |
| Domain purchase/M-Pesa | Supabase Edge Functions and onboarding component | Keep but refactor | Commercial onboarding is separate from technical site setup. Several unauthenticated functions and old broad policies require a dedicated security pass. |
| XML bots | Table/storage/UI and manifest integration | Keep but refactor | Retain as a feature with file type/size validation and tenant ownership. |
| Express backend | Bot ideas, scanner, bot statistics, PostgreSQL | Requires clarification; isolate | It is not the auth/deployment BFF. Keep while active runtime references exist; later fold into the platform backend or document as a separately deployed feature service. |
| `digits-no-chart-app` | Next-based alternate UI and a minimal core package | Remove after dependency verification | It is outside root workspaces and appears experimental/duplicated. Confirm no deployment points at it before deletion. |
| `repo-push-new-user-interface` | Separate repository-shaped directory | Remove after dependency verification | Root workspace no longer targets it. Confirm it contains no unique uncommitted source or provider build base before deletion. |
| `packages/deriv-auth` | Empty package shell | Replace/implement | Becomes shared scope, error, and public BFF contract code; secret/session implementation remains server-only. |
| `packages/shared-types` | Empty package shell | Implement | Shared tenant, templates, runtime, deployment, audit, and markup DTOs. |
| `packages/site-config-schema` | Public runtime TypeScript model | Keep but refactor | Add explicit schema version, tenant/template/navigation/legal and guarantee secret exclusion. |

## Authentication map

### Platform owner

- Provider: Supabase Auth.
- Frontend context: `deriv-sites-ui-kit-main/src/contexts/AuthContext.tsx`.
- Current authorization: `user_roles` with `admin` and direct ownership via `sites.user_id`.
- Required migration: organisations, memberships, explicit roles and permission checks. Owner cookies/tokens remain Supabase-owned and must never be reused as trader sessions.

### Generated-site trader

- Login URL generation is spread through shared config, header, main page, run panel, and invalid-token handling.
- Callback parsing is in `src/hooks/useOAuthCallback.ts`.
- Legacy callbacks accept `acctN`, `tokenN`, and `curN` query parameters.
- `src/app/App.tsx` copies tokens to `accountsList`, `clientAccounts`, and `authToken` in `localStorage`.
- `OAuthTokenExchangeService` exchanges and refreshes OAuth tokens in the browser and stores `auth_info` in `sessionStorage`.
- Account and OTP services receive the bearer token in browser JavaScript. They also omit the required `Deriv-App-ID` header.
- The legacy bot API retrieves tokens through `external/bot-skeleton/services/api/appId.js` and sends `authorize` over the classic WebSocket.
- Multiple logout/account-switching/layout paths directly manipulate token-bearing storage.

Decision: introduce the BFF first, route login/session/accounts/OTP through it, then remove legacy branches only after the trading request layer no longer depends on `api.authorize(token)`.

## Current Deriv API baseline

Verified against the official Deriv developer documentation on 2026-07-19:

- Authorization: `https://auth.deriv.com/oauth2/auth` using Authorization Code + PKCE S256.
- Token exchange: `https://auth.deriv.com/oauth2/token`, performed by the BFF.
- API base: `https://api.derivws.com`.
- Account list: `GET /trading/v1/options/accounts`, Bearer token, `Deriv-App-ID`, `trade` scope.
- Account creation: `POST /trading/v1/options/accounts`, Bearer token, `Deriv-App-ID`, `account_manage` scope.
- Authenticated Options socket: `POST /trading/v1/options/accounts/{accountId}/otp`, Bearer token, `Deriv-App-ID`, `trade` scope; connect immediately to `data.url`.
- Public market socket: `wss://api.derivws.com/trading/v1/options/ws/public`.
- Markup reporting: `GET /applications/v1/markup-statistics?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`, Bearer token, `Deriv-App-ID`, `application_read` scope.

The documentation UI does not expose a stable machine-readable markup response model in the repository. The adapter must therefore tolerate unknown fields, preserve a sanitized raw payload/version, and only normalize fields positively present in a real response fixture.

## Data model and RLS findings

Existing migration history includes profiles, subscriptions, sites, generic commissions, domains, settings, features, pages, Deriv app mapping, bots, publish versions, deployments, tools and integrations. RLS exists on most tables, but it is primarily `sites.user_id = auth.uid()` plus a broad admin bypass.

Required migration:

- Add `organisations` and `organisation_members` and backfill one personal organisation per existing site owner.
- Add `organisation_id` to every tenant-owned root record, starting with `sites`.
- Add reusable membership/permission helper functions.
- Add templates/template versions, feature definitions, configuration versions, Deriv OAuth applications/connections, encrypted trader token records, opaque trader sessions, OAuth transactions, markup snapshots, audit logs and system notices.
- Never grant browser SELECT access to encrypted token tables or provider secrets.
- Keep service-role operations server-side and replace wildcard CORS.

Historical migrations must remain. Old permissive policies are corrected by new migrations rather than editing migration history.

## Configuration, templates and deployment

- Runtime config loading by `REEF_SITE_ID` and hostname is active and should be retained.
- A single repository contains `sites/<site-id>/site.config.json`; each Netlify site builds the same runtime with its own `REEF_SITE_ID`.
- The Netlify ignore script prevents unrelated site config commits from rebuilding every site.
- GitHub uses a GitHub App and short-lived installation tokens. A classic account PAT is not the intended production credential.
- Public runtime config currently supports branding/features/pages/Deriv public IDs/bots/tools. It must gain a schema version, tenant ID, template version, legal/navigation and a central gateway URL.
- Hardcoded production domains, client IDs, App IDs and visual defaults remain in the trading config as compatibility fallbacks. Production must use database-generated runtime config; the map will be removed after all deployed sites have migrated.

## Dashboards and mock/unsupported data

- Owner site/subscription counts are real Supabase queries.
- Admin sites, profiles, tickets and messages are real Supabase queries.
- The commission cards are not authoritative markup statistics. Labels such as “8% Today” imply a commercial entitlement not established by the API.
- Several trading tests use mocks appropriately. Production-facing mock totals must not be used; unavailable integrations need explicit empty/error states.

## Cleanup candidates and safety checks

No bulk deletions should occur in the authentication phase. Candidates are:

- `digits-no-chart-app` and `repo-push-new-user-interface` after deployment/import comparison.
- Legacy callback parser, OAuth token exchange service, classic WebSocket URL, `legacy-request.js`, token storage helpers and storage keys after the current trading request layer is converted.
- `/setup/token` after configuration migration and route analytics/deep-link checks.
- `fetch-deriv-commissions` after the new markup function and dashboards are live.
- Debug `console.log` statements that expose auth state shape (even where token values are not printed).
- Empty package shells once implemented, or removed if no longer required.

## Architecture decision

Use Supabase Edge Functions as the central multi-tenant BFF because the platform already relies on Supabase for identity, RLS, data, publishing and webhooks. The central Deriv callback is registered once per Deriv application configuration, while an opaque, one-time state record binds the tenant, site, validated hostname, return path, nonce, requested scopes and expiry. Tokens are encrypted with a server-only key. The browser receives only an HttpOnly trader-session cookie and short-lived OTP WebSocket URLs.

The implemented deployment uses a same-origin gateway on every generated site. Netlify proxies `/api/*` to the central Supabase BFF, allowing an HttpOnly, Secure, SameSite=Lax cookie scoped to `/api`. The BFF still validates the configured site origin and site identifier. This avoids depending on third-party cookies for unrelated customer domains.

## Migration order and compatibility

1. Add new schema, registries, permission helpers and audit records without breaking existing tables.
2. Add central OAuth/BFF functions and a safe client contract.
3. Migrate generated-site login, account list and OTP connection to the BFF.
4. Add the resumable wizard and write versioned configuration while preserving existing config tables.
5. Replace commission UI/function with markup reporting.
6. Expand owner/admin dashboards and enforce role permissions server-side.
7. Add provider interfaces, deployment health checks and audit logs around existing GitHub/Netlify code.
8. Remove legacy auth and experiments after runtime/deployment verification.
9. Resolve the legacy TypeScript baseline, run tests/builds/security checks, and publish a cleanup report.

## Assumptions

- Supabase remains the platform database and owner identity provider.
- Generated sites may use unrelated customer domains, so each site exposes the central gateway through a same-origin `/api` proxy.
- One GitHub repository remains the source for hundreds of sites; configuration changes are per-site files, not per-customer code forks.
- A site may use its own Deriv application mapping, but all OAuth callbacks can route through the central gateway when that exact callback is registered for the application.
- No partner/referral commission API is assumed. Only documented markup statistics will be automated.

## Post-implementation outcome

The migration added organisation tenancy and permissions, versioned site configuration, template/feature/deployment registries, audit logs, encrypted owner/trader OAuth records, opaque trader sessions, the Deriv PKCE BFF, real markup reporting, the ten-step resumable wizard, GitHub App publishing, Netlify provisioning/webhooks, and generated-site runtime integration. Legacy browser token exchange/storage, URL token callbacks, classic authenticated WebSocket authorization, manual personal-token setup, fake commission calculations, and the isolated `digits-no-chart-app` tree were removed. Production builds and focused gateway contract tests pass; external provider activation, migration application, staging end-to-end testing, the inherited trading strict-TypeScript backlog, and a successful npm advisory query remain release gates.
