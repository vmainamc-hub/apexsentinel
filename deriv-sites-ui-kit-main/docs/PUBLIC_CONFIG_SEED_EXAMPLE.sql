-- Example seed script for local or staging verification only.
-- Do not insert private Deriv API tokens or user/session secrets here.

-- 1. Replace these ids with real local/staging ids from your project.
-- 2. Keep the hostname frontend-safe and publicly resolvable only in test environments.

-- Example:
--   site_id = an existing public.sites.id row that is already active
--   hostname = local-staging-riskmanagers.site

INSERT INTO public.site_domains (site_id, hostname, is_primary, is_verified, status, ssl_status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'local-staging-riskmanagers.site',
  true,
  true,
  'active',
  'ready'
);

INSERT INTO public.site_settings (
  site_id,
  site_name,
  brand_name,
  logo_url,
  favicon_url,
  primary_color,
  secondary_color,
  accent_color,
  header_bg_color,
  header_text_color,
  custom_css_vars_json
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Risk Managers',
  'Risk Managers',
  'https://example.com/assets/riskmanagers-logo.png',
  'https://example.com/assets/riskmanagers-favicon.ico',
  '#00c2ff',
  '#111827',
  '#22c55e',
  '#0b1220',
  '#f8fafc',
  '{"--brand-glow":"rgba(0,194,255,0.35)"}'::jsonb
);

INSERT INTO public.site_features (
  site_id,
  bot_ideas,
  print_popups,
  auto_trades,
  manual_trading,
  scanner,
  chart,
  best_bots,
  copy_trading,
  percentage_tool
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  false,
  true
);

INSERT INTO public.site_pages (site_id, page_key, label, enabled, sort_order) VALUES
('00000000-0000-0000-0000-000000000000', 'bot_ideas', 'Bot Ideas', true, 0),
('00000000-0000-0000-0000-000000000000', 'auto_trades', 'Auto Trades', true, 1),
('00000000-0000-0000-0000-000000000000', 'manual_trading', 'Manual Trading', true, 2),
('00000000-0000-0000-0000-000000000000', 'scanner', 'Scanner', true, 3);

INSERT INTO public.site_deriv_apps (
  site_id,
  oauth_client_id,
  deriv_app_id,
  redirect_uri,
  use_legacy_oauth_login,
  include_legacy_app_id_in_oauth
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'safe-public-client-id',
  '12345',
  'https://local-staging-riskmanagers.site/',
  false,
  false
);

INSERT INTO public.site_bots_manifest (
  site_id,
  bot_id,
  display_name,
  description,
  file_path,
  category,
  display_order,
  is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'volatility-bot-1',
  'Volatility Bot 1',
  'Local verification bot manifest entry',
  '/bots/volatility-bot-1.xml',
  'volatility',
  0,
  true
);
