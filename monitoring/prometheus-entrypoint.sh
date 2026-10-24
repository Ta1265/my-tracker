#!/bin/sh
set -eu

# Prometheus expands no environment variables in its own config file, so the scrape
# bearer token is materialised here and read back via authorization.credentials_file.
: "${METRICS_SECRET:?METRICS_SECRET is unset - scrapes would 403}"

umask 077
printf '%s' "$METRICS_SECRET" > /etc/prometheus/metrics-secret

exec /bin/prometheus "$@"
