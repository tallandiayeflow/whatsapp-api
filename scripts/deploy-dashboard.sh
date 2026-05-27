#!/usr/bin/env bash
# Copies the built dashboard to the nginx web root.
# This script is called with sudo from CI/CD — keep it minimal.
set -euo pipefail
DIST_DIR="$(dirname "$0")/../dashboard/dist"
WEB_ROOT="/var/www/openwa-dashboard"
cp -r "$DIST_DIR"/. "$WEB_ROOT/"
echo "Dashboard deployed to $WEB_ROOT"
