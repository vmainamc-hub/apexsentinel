# Reef Sites runtime configuration

## Production design

The site manager stores tenant-owned draft configuration and creates immutable configuration versions. Publishing commits only the selected site's public configuration to `sites/<site-id>/site.config.json` in the shared GitHub repository. Netlify uses `REEF_SITE_ID` and the ignore script to build only the affected customer site.

The generated trading application loads runtime configuration before rendering. It resolves the site ID supplied by Netlify and calls `public-site-config`. The response contains branding, navigation, legal links, public Deriv application identifiers, feature flags, tools, pages, and bot metadata. It never contains OAuth tokens, provider credentials, payment data, or owner identity data.

## Endpoint

`GET /functions/v1/public-site-config?site_id=<uuid>`

The function:

- resolves an active site and its active configuration version;
- prefers the immutable published snapshot;
- returns a schema-versioned, frontend-safe payload;
- sets restrictive cache and CORS headers;
- returns a correlation ID with sanitized failures.

Hostname lookup remains a migration fallback for verified active domains. New Netlify sites should always provide `REEF_SITE_ID`.

## Security boundary

Anonymous clients cannot read normalized configuration tables directly. Row-level security restricts owner access to organisation members. The public function uses the service role but explicitly constructs its response from allowed fields.

Deriv authentication is not part of public configuration. Generated sites call the same-origin `/api` gateway routes. Netlify proxies those routes to the central Supabase BFF, so the opaque trader session stays in a secure, HttpOnly, SameSite=Lax cookie on the customer's site origin.

## Verification

After applying migrations and deploying functions:

```bash
curl "https://<project-ref>.supabase.co/functions/v1/public-site-config?site_id=<site-uuid>"
```

Verify the response against `packages/site-config-schema`, confirm no secret-like fields exist, and publish one staging site before production rollout.
