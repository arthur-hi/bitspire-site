#!/usr/bin/env bash
set -euo pipefail

site_directory="site"

if rg --fixed-strings --quiet \
  'supabaseUrl: "https://replace-this-project.supabase.co"' \
  "$site_directory/assets/js/config.js"; then
  echo "The site still has the Supabase URL placeholder." >&2
  exit 1
fi

if rg --fixed-strings --quiet \
  'supabasePublishableKey: "replace-with-your-supabase-publishable-key"' \
  "$site_directory/assets/js/config.js"; then
  echo "The site still has the Supabase publishable key placeholder." >&2
  exit 1
fi

if [[ "$(tr -d '\r\n' < "$site_directory/CNAME")" != "bitspire.studio" ]]; then
  echo "The CNAME file must contain bitspire.studio." >&2
  exit 1
fi

echo "The public site configuration is set."
