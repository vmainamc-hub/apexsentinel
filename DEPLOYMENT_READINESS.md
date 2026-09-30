# Reef Sites deployment readiness

## Implemented

- One shared GitHub repository for all managed sites
- Per-site generated configuration directories
- GitHub App server authentication and atomic multi-file commits
- Publish versions, deployment history, retries, and rollback commits
- Scalable tool catalogue and per-site tool installation
- Separate Netlify project provisioning for each site
- Per-site Netlify build environment configuration
- Site-aware ignored builds for shared-repository scalability
- Netlify deployment callbacks and domain/SSL status updates
- Runtime configuration loading before the trading React application renders
- Legacy domain configuration fallback during migration
- Branding, favicon, OAuth, feature, tool, page, and bot runtime payloads
- Draft preview, production URL, GitHub commit, deploy log, retry, and restore UI

## External activation required

The source code cannot create provider credentials itself. Before production:

1. Create and install the Reef Sites GitHub App.
2. Install the Netlify GitHub App on the shared repository.
3. Create a Netlify personal access token for the platform account.
4. Set the documented Supabase secrets.
5. Apply all three `20260719` database migrations in filename order.
6. Deploy the new and updated Supabase Edge Functions listed in `docs/SETUP_AND_OPERATIONS.md`.
7. Test one staging domain end to end before onboarding production sites.

## Verification gates

- Admin Vite production build: passing
- Admin TypeScript check: passing
- Admin ESLint: passing with eight existing Fast Refresh advisory warnings
- Trading RSBuild production build: passing
- Deriv gateway/config contract tests: passing
- Trading legacy full TypeScript check: currently has pre-existing errors outside
  this integration; RSBuild remains the production build gate used by the project
- Live GitHub/Netlify/Supabase request: requires owner credentials and cannot be
  executed until external activation is complete
- npm production dependency audit: reduced from 14 to 8 advisories (2 high,
  6 moderate). The remaining findings are inherited through Deriv Quill UI's
  UUID/release-tool dependency chain; removing them requires an upstream-safe UI
  upgrade rather than an unsafe forced downgrade.
- The full dependency tree, including development/release tooling, reports 19
  advisories (1 critical, 5 high, 13 moderate). CI should review and update that
  tooling independently of the browser production bundle.
- Deno Edge Function check: the on-demand Deno executable/import resolution
  timed out in this environment. Run `deno check` or Supabase's function checks
  in CI/staging before production deployment.
- Local manager dev server: HTTP 200 on `http://127.0.0.1:8080/`; the in-app
  browser was unavailable for a visual smoke test.
