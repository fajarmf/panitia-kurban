#!/usr/bin/env bash
# Trigger Passenger restart on cPanel — touches tmp/restart.txt.
#
# Usage:
#   CPANEL_HOST=<host> CPANEL_USER=<user> [REMOTE_PATH=<path>] \
#     ./scripts/cpanel-restart.sh
#
# Required env:
#   CPANEL_HOST   SSH host
#   CPANEL_USER   cPanel username
#
# Optional env:
#   REMOTE_PATH   Default: public_html/kurban.masjidalhijrahcge.id

set -euo pipefail

: "${CPANEL_HOST:?Set CPANEL_HOST=<host>}"
: "${CPANEL_USER:?Set CPANEL_USER=<user>}"
REMOTE_PATH="${REMOTE_PATH:-public_html/kurban.masjidalhijrahcge.id}"

ssh -o LogLevel=ERROR "${CPANEL_USER}@${CPANEL_HOST}" \
  "touch ${REMOTE_PATH}/tmp/restart.txt"

echo "✓ Passenger restart triggered (app cold-starts on next request)"
