#!/usr/bin/env bash
# Assembles every project into _site/<slug>/ for GitHub Pages.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site && mkdir -p _site
while IFS=$'\t' read -r dir slug kind; do
  [ -z "$dir" ] && continue
  echo "==> $dir -> $slug ($kind)"
  if [ "$kind" = vite ]; then
    (cd "$dir" && npm ci --no-audit --no-fund && npm run build)
    cp -r "$dir/dist" "_site/$slug"
  else
    mkdir -p "_site/$slug"
    (cd "$dir" && tar --exclude=node_modules --exclude='*.md' --exclude=server.js --exclude=package.json -cf - .) | tar -xf - -C "_site/$slug"
  fi
done < scripts/projects.tsv
cp index.html _site/index.html
cp -r screenshots _site/screenshots
mkdir -p _site/profile && cp profile/avatar.jpg _site/profile/
touch _site/.nojekyll
