#!/usr/bin/env bash
set -euo pipefail

# Build Apex Sentinel from the exact RiskManagers platform source revision.
# The current Apex Sentinel repo contains other application work; this build
# deliberately uses only the RiskManagers/Dsites trading runtime.

SOURCE_COMMIT="8fd7570b84f34fc0cbbd38611cea762fd6a713e9"
SOURCE_URL="https://github.com/DukeNyamasege/Full-Dsites-code/archive/${SOURCE_COMMIT}.tar.gz"
SITE_ID="apex-sentinel"
APEX_HOSTNAME="${APEX_HOSTNAME:-apexsentinell.netlify.app}"
DERIV_APP_ID="${DERIV_APP_ID:-}"
DERIV_OAUTH_CLIENT_ID="${DERIV_OAUTH_CLIENT_ID:-}"

rm -rf .riskmanagers-source new-user-interface-main sites
mkdir -p .riskmanagers-source

curl -fsSL "$SOURCE_URL" | tar -xz -C .riskmanagers-source --strip-components=1
cp -a .riskmanagers-source/new-user-interface-main ./new-user-interface-main

mkdir -p "sites/$SITE_ID"
cat > "sites/$SITE_ID/site.config.json" <<EOF
{
  "schemaVersion": 1,
  "tenantId": "9e44c400-2a83-4cbc-a561-9e8a97e4c633",
  "template": { "id": "riskmanagers", "version": "$SOURCE_COMMIT" },
  "site": {
    "id": "$SITE_ID",
    "name": "Apex Sentinel",
    "hostname": "$APEX_HOSTNAME"
  },
  "branding": {
    "brandName": "Apex Sentinel",
    "darkModeDefault": false
  },
  "deriv": {
    "oauthClientId": "$DERIV_OAUTH_CLIENT_ID",
    "appId": "$DERIV_APP_ID",
    "gatewayUrl": "/api",
    "requiredScopes": ["trade"],
    "environment": "production"
  },
  "features": {
    "bot_ideas": true,
    "best_bots": true,
    "dashboard": true,
    "bot_builder": true,
    "auto_trades": true,
    "combo_trades": true,
    "scanner": true,
    "chart": true,
    "analysistool": true,
    "tradingview": true,
    "tutorials": true,
    "manual_trading": true
  }
}
EOF

# Preserve the complete RiskManagers bot directory byte-for-byte under the
# Apex tenant folder; no bot is renamed, rewritten, or selectively removed.
cp -a new-user-interface-main/public/riskmanagers.site "new-user-interface-main/public/$SITE_ID"

# Tenant-only runtime substitutions. Trading logic and application code are
# otherwise left at the pinned RiskManagers source revision.
python3 - "$SITE_ID" "$APEX_HOSTNAME" <<'PY'
from pathlib import Path
import json, sys

site_id, hostname = sys.argv[1:3]

best = Path("new-user-interface-main/src/pages/best-bots/best-bots.tsx")
s = best.read_text(encoding="utf-8")
s = s.replace("'riskmanagers.site': RISK_MANAGERS_BOTS,", f"'{site_id}': RISK_MANAGERS_BOTS,")
best.write_text(s, encoding="utf-8")

brand = Path("new-user-interface-main/src/components/shared/utils/brand/brand.ts")
if brand.exists():
    s = brand.read_text(encoding="utf-8")
    s = s.replace("'riskmanagers.site',", f"'{hostname}',")
    brand.write_text(s, encoding="utf-8")

cfg = Path("new-user-interface-main/brand.config.json")
if cfg.exists():
    data = json.loads(cfg.read_text(encoding="utf-8"))
    data["brand_name"] = "Apex Sentinel"
    data["brand_domain"] = hostname
    if isinstance(data.get("brand_hostname"), dict):
        data["brand_hostname"]["staging"] = hostname
        data["brand_hostname"]["production"] = hostname
    cfg.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")
PY

cd new-user-interface-main
npm ci
REEF_SITE_ID="$SITE_ID" REEF_SITE_CONFIG_URL="/site.config.json" npm run build
