#!/usr/bin/env bash
set -euo pipefail

# setup_local_https.sh
# Purpose: configure your Mac + project to serve the app locally at
# https://www.tubesock.xyz using mkcert and the existing nginx Docker service.
# Assumptions: macOS, Homebrew installed, Docker + docker-compose installed.
#
# Usage:
#   chmod +x setup_local_https.sh
#   sudo ./setup_local_https.sh

# Paths and hostnames used by the script.
CERT_DIR="./nginx/letsencrypt/live/tubesock.xyz"
LOCAL_HOSTNAME="www.tubesock.xyz"
LOCAL_ALTNAME="tubesock.xyz"

# The IP address of the machine actually running the app on the local network.
APP_HOST_IP="192.168.1.167"

# The WireGuard / DNS hub IP. If clients connect through this host for DNS or routing,
# include it in the TLS SANs so the certificate remains valid.
WIREGUARD_HUB_IP="192.168.1.163"

# This IP is used only locally on this Mac as a host alias for www.tubesock.xyz.
# It is not necessarily the same as the app host IP or the WireGuard hub IP.
HOSTS_ALIAS_IP="192.168.200.1"

echo "1) Ensure running on macOS and as root"
if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script is intended for macOS only." >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Please run this script with sudo." >&2
  exit 1
fi

echo "2) Add hosts entry for tubesock.xyz (maps the domain locally)"
# This entry ensures the local Mac resolves www.tubesock.xyz to a known IP
# for local development. It is mainly needed when the domain is not otherwise
# available via DNS for this machine.
if grep -q "tubesock.xyz" /etc/hosts; then
  echo "- /etc/hosts already contains tubesock.xyz entry"
else
  echo "- Adding ${HOSTS_ALIAS_IP} ${LOCAL_HOSTNAME} ${LOCAL_ALTNAME} to /etc/hosts"
  sh -c "printf '\n${HOSTS_ALIAS_IP} ${LOCAL_HOSTNAME} ${LOCAL_ALTNAME}\n' >> /etc/hosts"
  # Flush local DNS cache if needed
  # dscacheutil -flushcache || true
  # killall -HUP mDNSResponder || true
fi

echo "3) Install mkcert (if needed) and install local CA"
if ! command -v mkcert >/dev/null 2>&1; then
  echo "- Installing mkcert via Homebrew"
  brew install mkcert
fi

if [[ -z "${SUDO_USER-}" || "${SUDO_USER}" == "root" ]]; then
  echo "Please run this script through sudo from your login user, not as root directly." >&2
  exit 1
fi
MKCERT_USER="$SUDO_USER"
MKCERT_DIR="/Users/${MKCERT_USER}/Library/Application Support/mkcert"

echo "- Cleaning up any previous root-owned mkcert CA files"
if [[ -d "$MKCERT_DIR" ]]; then
  rm -rf "$MKCERT_DIR"
fi

echo "- Ensuring mkcert CA is installed in the current user's trust store"
sudo -u "$MKCERT_USER" mkcert -install

echo "4) Generate local DH params and locally-trusted certs for tubesock.xyz"
mkdir -p "$CERT_DIR"

if [[ ! -f ./nginx/dhparam.pem ]]; then
  echo "- Generating DH params for nginx into ./nginx/dhparam.pem"
  openssl dhparam -out ./nginx/dhparam.pem 2048
else
  echo "- ./nginx/dhparam.pem already exists"
fi

echo "- Generating cert files into $CERT_DIR"
# Include both the app host IP and the WireGuard hub IP if the hub may be
# used as a network endpoint for the same service. This helps keep the cert
# valid when clients connect through either route.
mkcert -cert-file "$CERT_DIR/fullchain.pem" -key-file "$CERT_DIR/privkey.pem" \
  "$LOCAL_HOSTNAME" "$LOCAL_ALTNAME" "$APP_HOST_IP" "$WIREGUARD_HUB_IP"

echo "- Copying fullchain.pem to chain.pem (nginx expects chain.pem path)"
cp "$CERT_DIR/fullchain.pem" "$CERT_DIR/chain.pem"

echo "- Set readable permissions on generated certs"
chmod 644 "$CERT_DIR"/*.pem || true
chmod 644 ./nginx/dhparam.pem || true

echo "5) Install loopback alias plist so it persists across restarts"

cp ./com.tubesock.loopbackalias.plist /Library/LaunchDaemons/com.tubesock.loopbackalias.plist
chown root:wheel /Library/LaunchDaemons/com.tubesock.loopbackalias.plist
chmod 644 /Library/LaunchDaemons/com.tubesock.loopbackalias.plist

launchctl unload /Library/LaunchDaemons/com.tubesock.loopbackalias.plist >/dev/null 2>&1 || true
launchctl load -w /Library/LaunchDaemons/com.tubesock.loopbackalias.plist

echo "
Setup complete. Open https://www.tubesock.xyz in your browser on this Mac. If the browser
shows a cert warning, quit and reopen the browser so the system trust change takes effect.
Note: generated certs are stored under ./nginx/letsencrypt and should NOT be committed.
"

exit 0
