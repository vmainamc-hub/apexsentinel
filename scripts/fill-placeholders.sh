#!/usr/bin/env bash
set -euo pipefail
: "${APEX_HOSTNAME:?}" "${APEX_SUPABASE_REF:?}" "${APEX_BACKEND_URL:?}" "${ORGANISATION_UUID:?}" "${AUTH_USER_UUID:?}" "${SITES_ROW_UUID:?}" "${DERIV_APP_ID:?}" "${DERIV_OAUTH_CLIENT_ID:?}"
files=$(grep -rIl '<APEX_\|<ORGANISATION_UUID>\|<AUTH_USER_UUID>\|<SITES_ROW_UUID>\|<YOUR_DERIV' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=fill-placeholders.sh)
while IFS= read -r f; do sed -i -e "s|<APEX_HOSTNAME>|$APEX_HOSTNAME|g" -e "s|<APEX_SUPABASE_REF>|$APEX_SUPABASE_REF|g" -e "s|<APEX_BACKEND_URL>|${APEX_BACKEND_URL%/}|g" -e "s|<ORGANISATION_UUID>|$ORGANISATION_UUID|g" -e "s|<AUTH_USER_UUID>|$AUTH_USER_UUID|g" -e "s|<SITES_ROW_UUID>|$SITES_ROW_UUID|g" -e "s|<YOUR_DERIV_APP_ID>|$DERIV_APP_ID|g" -e "s|<YOUR_DERIV_OAUTH_CLIENT_ID>|$DERIV_OAUTH_CLIENT_ID|g" "$f"; done <<< "$files"
if grep -rIn '<APEX_\|<ORGANISATION_UUID>\|<AUTH_USER_UUID>\|<SITES_ROW_UUID>\|<YOUR_DERIV' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=fill-placeholders.sh; then echo 'Placeholders remain' >&2; exit 1; fi
echo 'All placeholders filled.'
