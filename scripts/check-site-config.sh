#!/usr/bin/env bash
set -euo pipefail

site_directory="site"

if rg --fixed-strings --quiet "replace-this-project" "$site_directory"; then
  echo "The site still has the Supabase URL placeholder." >&2
  exit 1
fi

if rg --fixed-strings --quiet "replace-with-your-supabase-publishable-key" "$site_directory"; then
  echo "The site still has the Supabase publishable key placeholder." >&2
  exit 1
fi

if [[ "$(tr -d '\r\n' < "$site_directory/CNAME")" != "bitspire.studio" ]]; then
  echo "The CNAME file must contain bitspire.studio." >&2
  exit 1
fi

echo "The public site configuration is set."
